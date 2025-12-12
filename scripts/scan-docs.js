#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Scan Documentation for Screenshot References
 *
 * Scans markdown files in Operaton documentation to:
 * 1. Find all image references
 * 2. Identify webapp screenshots (cockpit, tasklist, admin, welcome)
 * 3. Group by category
 * 4. Generate screenshot configuration files
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration - uses .env values with sensible defaults
const config = {
  // Path to documentation
  docsPath: process.env.DOCS_PATH || path.join(__dirname, '..', '..', 'documentation', 'docs'),
  // Output directory for generated configs
  outputDir: process.env.GENERATED_CONFIG_DIR || path.join(__dirname, '..', 'config', 'generated'),
  // Debug mode
  debug: process.env.DEBUG === 'true',
  // Webapp screenshot patterns
  webappPatterns: {
    cockpit: [
      /cockpit/i,
      /process-definition/i,
      /process-instance/i,
      /decision/i,
      /batch/i,
      /migration/i,
      /dashboard/i,
      /deployment/i,
      /incident/i,
      /job/i,
      /heatmap/i,
    ],
    tasklist: [/tasklist/i, /task-/i, /filter/i, /form/i],
    admin: [
      /admin/i,
      /user/i,
      /group/i,
      /tenant/i,
      /authorization/i,
      /system/i,
      /execution-metrics/i,
    ],
    welcome: [/welcome/i, /profile/i],
  },
  // Image extensions to look for
  imageExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
};

// Results storage
const results = {
  totalFiles: 0,
  totalImages: 0,
  byCategory: {
    cockpit: [],
    tasklist: [],
    admin: [],
    welcome: [],
    other: [],
  },
  byDocSection: {},
};

/**
 * Extract image references from markdown content
 */
function extractImageReferences(content, filePath) {
  const images = [];
  const relativeFilePath = path.relative(config.docsPath, filePath);

  // Match markdown image syntax: ![alt](path)
  const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = mdImageRegex.exec(content)) !== null) {
    const alt = match[1];
    const imagePath = match[2].split(' ')[0]; // Remove title if present
    const lineNumber = content.substring(0, match.index).split('\n').length;

    // Skip external URLs
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      continue;
    }

    // Check if it's an image file
    const ext = path.extname(imagePath).toLowerCase();
    if (!config.imageExtensions.includes(ext)) {
      continue;
    }

    images.push({
      alt,
      path: imagePath,
      sourceFile: relativeFilePath,
      lineNumber,
      fullMatch: match[0],
    });
  }

  // Match HTML img tags
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']+)["'])?[^>]*>/gi;

  while ((match = htmlImgRegex.exec(content)) !== null) {
    const imagePath = match[1];
    const alt = match[2] || '';
    const lineNumber = content.substring(0, match.index).split('\n').length;

    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      continue;
    }

    const ext = path.extname(imagePath).toLowerCase();
    if (!config.imageExtensions.includes(ext)) {
      continue;
    }

    images.push({
      alt,
      path: imagePath,
      sourceFile: relativeFilePath,
      lineNumber,
      fullMatch: match[0].substring(0, 100),
    });
  }

  return images;
}

/**
 * Categorize an image based on its path and alt text
 */
function categorizeImage(image) {
  const searchText = `${image.path} ${image.alt} ${image.sourceFile}`.toLowerCase();

  for (const [category, patterns] of Object.entries(config.webappPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(searchText)) {
        return category;
      }
    }
  }

  return 'other';
}

/**
 * Get document section from file path
 */
function getDocSection(filePath) {
  const parts = filePath.split(path.sep);
  if (parts.length >= 2) {
    return parts.slice(0, 2).join('/');
  }
  return parts[0] || 'root';
}

/**
 * Find all markdown files recursively
 */
async function findMarkdownFiles(dir) {
  const files = [];

  async function search(currentDir) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          // Skip hidden directories and node_modules
          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue;
          }
          await search(fullPath);
        } else if (entry.isFile()) {
          if (entry.name.match(/\.(md|mdx)$/i)) {
            files.push(fullPath);
          }
        }
      }
      // eslint-disable-next-line no-unused-vars
    } catch (err) {
      // Ignore directory read errors
    }
  }

  await search(dir);
  return files;
}

/**
 * Scan all markdown files for image references
 */
async function scanDocumentation() {
  console.log('='.repeat(60));
  console.log('  Documentation Screenshot Scanner');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Docs path: ${config.docsPath}`);
  console.log('');

  // Check if docs path exists
  try {
    await fs.access(config.docsPath);
  } catch {
    console.error(`! Documentation path not found: ${config.docsPath}`);
    console.error('');
    console.error('Set DOCS_PATH environment variable to point to your documentation folder.');
    console.error('Example: DOCS_PATH=/path/to/documentation/docs node scan-docs.js');
    process.exit(1);
  }

  // Find all markdown files
  console.log('Finding markdown files...');
  const mdFiles = await findMarkdownFiles(config.docsPath);
  results.totalFiles = mdFiles.length;
  console.log(`  Found ${mdFiles.length} markdown files`);
  console.log('');

  // Scan each file
  console.log('Scanning for image references...');
  for (const file of mdFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const images = extractImageReferences(content, file);

      for (const image of images) {
        results.totalImages++;

        // Categorize
        const category = categorizeImage(image);
        results.byCategory[category].push(image);

        // Track by doc section
        const section = getDocSection(image.sourceFile);
        if (!results.byDocSection[section]) {
          results.byDocSection[section] = [];
        }
        results.byDocSection[section].push({ ...image, category });
      }
      // eslint-disable-next-line no-unused-vars
    } catch (err) {
      // Skip files that can't be read
    }
  }

  console.log(`  Found ${results.totalImages} image references`);
  console.log('');
}

/**
 * Generate screenshot ID from image path
 */
function generateScreenshotId(image) {
  const basename = path.basename(image.path, path.extname(image.path));
  // Clean up the name
  return basename
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Try to infer the webapp URL path from the image
 */
function inferUrlPath(image) {
  const imagePath = image.path.toLowerCase();
  const alt = (image.alt || '').toLowerCase();

  // Common patterns
  if (imagePath.includes('dashboard') || alt.includes('dashboard')) {
    return '#/dashboard';
  }
  if (imagePath.includes('process-definition') || alt.includes('process definition')) {
    return '#/process-definition/{processDefinitionKey}';
  }
  if (imagePath.includes('process-instance') || alt.includes('process instance')) {
    return '#/process-instance/{processInstanceId}';
  }
  if (imagePath.includes('decision') || alt.includes('decision')) {
    return '#/decisions';
  }
  if (imagePath.includes('deployment') || alt.includes('deployment')) {
    return '#/repository';
  }
  if (imagePath.includes('batch')) {
    return '#/batch';
  }
  if (imagePath.includes('migration')) {
    return '#/migration';
  }
  if (imagePath.includes('user')) {
    return '#/users';
  }
  if (imagePath.includes('group')) {
    return '#/groups';
  }
  if (imagePath.includes('tenant')) {
    return '#/tenants';
  }
  if (imagePath.includes('authorization')) {
    return '#/authorization';
  }
  if (imagePath.includes('system')) {
    return '#/system';
  }

  return '#/';
}

/**
 * Generate screenshot config for a category
 */
function generateCategoryConfig(category, images) {
  const baseUrls = {
    cockpit: '/operaton/app/cockpit/default',
    tasklist: '/operaton/app/tasklist/default',
    admin: '/operaton/app/admin/default',
    welcome: '/operaton/app/welcome/default',
  };

  const screenshots = images.map(image => {
    const id = generateScreenshotId(image);
    const urlPath = inferUrlPath(image);

    return {
      id: `${category}-${id}`,
      category,
      description: image.alt || `Screenshot from ${image.sourceFile}`,
      path: urlPath,
      outputFile: image.path.startsWith('/') ? image.path.substring(1) : image.path,
      sourceDoc: image.sourceFile,
      sourceLine: image.lineNumber,
      // Mark as needing review if URL couldn't be determined
      needsReview: urlPath === '#/',
    };
  });

  // Remove duplicates by outputFile
  const unique = [];
  const seen = new Set();
  for (const s of screenshots) {
    if (!seen.has(s.outputFile)) {
      seen.add(s.outputFile);
      unique.push(s);
    }
  }

  return {
    version: '1.0.0',
    description: `Screenshot definitions for ${category} webapp - generated from documentation`,
    generatedAt: new Date().toISOString(),
    categories: {
      [category]: {
        description: `${category.charAt(0).toUpperCase() + category.slice(1)} webapp screenshots`,
        baseUrl: baseUrls[category] || '/operaton/app/cockpit/default',
      },
    },
    screenshots: unique,
    users: [],
    groups: [],
  };
}

/**
 * Generate combined config with all categories
 */
function generateCombinedConfig() {
  const allScreenshots = [];
  const categories = {};

  const baseUrls = {
    cockpit: '/operaton/app/cockpit/default',
    tasklist: '/operaton/app/tasklist/default',
    admin: '/operaton/app/admin/default',
    welcome: '/operaton/app/welcome/default',
  };

  for (const [category, images] of Object.entries(results.byCategory)) {
    if (category === 'other' || images.length === 0) continue;

    categories[category] = {
      description: `${category.charAt(0).toUpperCase() + category.slice(1)} webapp screenshots`,
      baseUrl: baseUrls[category],
    };

    for (const image of images) {
      const id = generateScreenshotId(image);
      const urlPath = inferUrlPath(image);

      allScreenshots.push({
        id: `${category}-${id}`,
        category,
        description: image.alt || `Screenshot from ${image.sourceFile}`,
        path: urlPath,
        outputFile: image.path.startsWith('/') ? image.path.substring(1) : image.path,
        sourceDoc: image.sourceFile,
        sourceLine: image.lineNumber,
        needsReview: urlPath === '#/',
      });
    }
  }

  // Remove duplicates
  const unique = [];
  const seen = new Set();
  for (const s of allScreenshots) {
    if (!seen.has(s.outputFile)) {
      seen.add(s.outputFile);
      unique.push(s);
    }
  }

  return {
    version: '1.0.0',
    description: 'Screenshot definitions generated from documentation scan',
    generatedAt: new Date().toISOString(),
    categories,
    screenshots: unique,
    users: [],
    groups: [],
  };
}

/**
 * Write config files
 */
async function writeConfigs() {
  // Ensure output directory exists
  await fs.mkdir(config.outputDir, { recursive: true });

  console.log('Generating configuration files...');
  console.log('');

  // Write per-category configs
  for (const [category, images] of Object.entries(results.byCategory)) {
    if (category === 'other' || images.length === 0) continue;

    const categoryConfig = generateCategoryConfig(category, images);
    const outputPath = path.join(config.outputDir, `screenshots-${category}.json`);

    await fs.writeFile(outputPath, JSON.stringify(categoryConfig, null, 2));
    console.log(
      `  + screenshots-${category}.json (${categoryConfig.screenshots.length} screenshots)`
    );
  }

  // Write combined config
  const combinedConfig = generateCombinedConfig();
  const combinedPath = path.join(config.outputDir, 'screenshots-all.json');
  await fs.writeFile(combinedPath, JSON.stringify(combinedConfig, null, 2));
  console.log(`  + screenshots-all.json (${combinedConfig.screenshots.length} screenshots)`);

  // Write summary report
  const reportPath = path.join(config.outputDir, 'scan-report.md');
  await fs.writeFile(reportPath, generateReport());
  console.log(`  + scan-report.md`);

  console.log('');
  console.log(`Output directory: ${config.outputDir}`);
}

/**
 * Generate markdown report
 */
function generateReport() {
  let md = '# Documentation Screenshot Scan Report\n\n';
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `**Documentation path:** ${config.docsPath}\n\n`;

  md += '## Summary\n\n';
  md += `- Markdown files scanned: ${results.totalFiles}\n`;
  md += `- Total image references: ${results.totalImages}\n\n`;

  md += '## Images by Category\n\n';
  md += '| Category | Count |\n';
  md += '|----------|-------|\n';

  for (const [category, images] of Object.entries(results.byCategory)) {
    md += `| ${category} | ${images.length} |\n`;
  }

  md += '\n## Images by Documentation Section\n\n';

  const sortedSections = Object.entries(results.byDocSection).sort(
    (a, b) => b[1].length - a[1].length
  );

  for (const [section, images] of sortedSections) {
    md += `### ${section} (${images.length} images)\n\n`;

    // Group by category within section
    const byCategory = {};
    for (const img of images) {
      if (!byCategory[img.category]) {
        byCategory[img.category] = [];
      }
      byCategory[img.category].push(img);
    }

    for (const [cat, catImages] of Object.entries(byCategory)) {
      md += `**${cat}:** ${catImages.length}\n`;
    }
    md += '\n';
  }

  md += '## Generated Config Files\n\n';
  md += '| File | Description | Screenshots |\n';
  md += '|------|-------------|-------------|\n';

  for (const [category, images] of Object.entries(results.byCategory)) {
    if (category === 'other' || images.length === 0) continue;
    md += `| screenshots-${category}.json | ${category} webapp screenshots | ${images.length} |\n`;
  }

  const totalWebapp =
    results.byCategory.cockpit.length +
    results.byCategory.tasklist.length +
    results.byCategory.admin.length +
    results.byCategory.welcome.length;

  md += `| screenshots-all.json | All webapp screenshots | ${totalWebapp} |\n`;

  md += '\n## Usage\n\n';
  md += '```bash\n';
  md += '# Copy desired config to screenshots.json\n';
  md += 'cp config/generated/screenshots-cockpit.json config/screenshots.json\n';
  md += '\n';
  md += '# Or use all screenshots\n';
  md += 'cp config/generated/screenshots-all.json config/screenshots.json\n';
  md += '\n';
  md += '# Then run capture\n';
  md += 'make capture\n';
  md += '```\n';

  md += '\n## Notes\n\n';
  md += '- Screenshots marked with `needsReview: true` need manual URL path configuration\n';
  md += '- The `sourceDoc` and `sourceLine` fields indicate where each image is referenced\n';
  md += '- Duplicate images (same output path) are automatically deduplicated\n';

  return md;
}

/**
 * Print summary to console
 */
function printSummary() {
  console.log('='.repeat(60));
  console.log('  Scan Summary');
  console.log('='.repeat(60));
  console.log('');
  console.log('Images by category:');
  console.log('');

  for (const [category, images] of Object.entries(results.byCategory)) {
    const bar = '#'.repeat(Math.min(images.length, 50));
    console.log(`  ${category.padEnd(10)} ${images.length.toString().padStart(4)}  ${bar}`);
  }

  console.log('');
  console.log('='.repeat(60));

  const needsReview = Object.values(results.byCategory)
    .flat()
    .filter(img => inferUrlPath(img) === '#/').length;

  if (needsReview > 0) {
    console.log('');
    console.log(`! ${needsReview} screenshots need manual URL path configuration`);
  }
}

/**
 * Main execution
 */
async function main() {
  await scanDocumentation();
  await writeConfigs();
  printSummary();

  console.log('');
  console.log('+ Scan complete!');
  console.log('');
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
