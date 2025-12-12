#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Scan Documentation for Screenshot References (v2)
 *
 * Improved version that:
 * 1. Focuses on actual webapp screenshots (from webapps docs)
 * 2. Better categorization based on file path, not keywords
 * 3. Smarter URL inference from image filenames
 * 4. Separates webapp screenshots from other images
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const config = {
  docsPath: process.env.DOCS_PATH || path.join(__dirname, '..', '..', 'documentation', 'docs'),
  outputDir: process.env.GENERATED_CONFIG_DIR || path.join(__dirname, '..', 'config', 'generated'),
  debug: process.env.DEBUG === 'true',
  imageExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
};

// Results storage
const results = {
  totalFiles: 0,
  totalImages: 0,
  webappScreenshots: {
    cockpit: [],
    tasklist: [],
    admin: [],
    welcome: [],
  },
  otherImages: [],
  byDocSection: {},
};

/**
 * Determine webapp category from image path
 * Only categorizes images that are actual webapp screenshots
 */
function getWebappCategory(imagePath, sourceFile) {
  const imgLower = imagePath.toLowerCase();
  const srcLower = sourceFile.toLowerCase();

  // Method 1: Check if image is in webapps documentation section
  if (srcLower.includes('webapps/cockpit') || imgLower.includes('webapps/cockpit')) {
    return 'cockpit';
  }
  if (srcLower.includes('webapps/tasklist') || imgLower.includes('webapps/tasklist')) {
    return 'tasklist';
  }
  if (srcLower.includes('webapps/admin') || imgLower.includes('webapps/admin')) {
    return 'admin';
  }
  if (srcLower.includes('webapps/welcome') || imgLower.includes('webapps/welcome')) {
    return 'welcome';
  }

  // Method 2: Check image filename prefixes (common naming convention)
  const basename = path.basename(imgLower);
  if (basename.startsWith('cockpit-') || basename.startsWith('cockpit_')) {
    return 'cockpit';
  }
  if (basename.startsWith('tasklist-') || basename.startsWith('tasklist_')) {
    return 'tasklist';
  }
  if (basename.startsWith('admin-') || basename.startsWith('admin_')) {
    return 'admin';
  }
  if (basename.startsWith('welcome-') || basename.startsWith('welcome_')) {
    return 'welcome';
  }

  // Not a webapp screenshot
  return null;
}

/**
 * Infer URL path from image filename for cockpit
 */
function inferCockpitUrl(imagePath) {
  const img = imagePath.toLowerCase();

  // Dashboard
  if (img.includes('dashboard')) return '#/dashboard';

  // Process views
  if (img.includes('process-definition') || img.includes('process_definition')) {
    return '#/process-definition/{processDefinitionKey}';
  }
  if (img.includes('process-instance') || img.includes('process_instance')) {
    return '#/process-instance/{processInstanceId}';
  }
  if (img.includes('processes')) return '#/processes';

  // Decision views
  if (img.includes('decision-definition') || img.includes('decision_definition')) {
    return '#/decision-definition/{decisionDefinitionKey}';
  }
  if (img.includes('decision-instance') || img.includes('decision_instance')) {
    return '#/decision-instance/{decisionInstanceId}';
  }
  if (img.includes('decision')) return '#/decisions';

  // Case views
  if (img.includes('case-definition') || img.includes('case_definition')) {
    return '#/case-definition/{caseDefinitionKey}';
  }
  if (img.includes('case-instance') || img.includes('case_instance')) {
    return '#/case-instance/{caseInstanceId}';
  }
  if (img.includes('case')) return '#/cases';

  // Other views
  if (img.includes('deployment') || img.includes('repository')) return '#/repository';
  if (img.includes('batch')) return '#/batch';
  if (img.includes('migration')) return '#/migration';
  if (img.includes('incident')) return '#/dashboard';
  if (img.includes('job')) return '#/dashboard';
  if (img.includes('history')) return '#/process-definition/{processDefinitionKey}/history';
  if (img.includes('heatmap')) return '#/process-definition/{processDefinitionKey}/history';
  if (img.includes('cleanup')) return '#/cleanup';
  if (img.includes('report')) return '#/reports';

  return '#/dashboard';
}

/**
 * Infer URL path from image filename for tasklist
 */
function inferTasklistUrl(imagePath) {
  const img = imagePath.toLowerCase();

  if (img.includes('filter')) return '#/';
  if (img.includes('form')) return '#/?task={taskId}';
  if (img.includes('task')) return '#/?task={taskId}';

  return '#/';
}

/**
 * Infer URL path from image filename for admin
 */
function inferAdminUrl(imagePath) {
  const img = imagePath.toLowerCase();

  if (img.includes('user')) return '#/users';
  if (img.includes('group')) return '#/groups';
  if (img.includes('tenant')) return '#/tenants';
  if (img.includes('authorization') || img.includes('auth')) return '#/authorization?resource=0';
  if (img.includes('system')) return '#/system';
  if (img.includes('metric')) return '#/system?section=execution-metrics';
  if (img.includes('diagnostic')) return '#/system?section=diagnostics';

  return '#/users';
}

/**
 * Infer URL path based on category
 */
function inferUrlPath(category, imagePath) {
  switch (category) {
    case 'cockpit':
      return inferCockpitUrl(imagePath);
    case 'tasklist':
      return inferTasklistUrl(imagePath);
    case 'admin':
      return inferAdminUrl(imagePath);
    case 'welcome':
      return '#/welcome';
    default:
      return '#/';
  }
}

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
    const imagePath = match[2].split(' ')[0].split('#')[0]; // Remove title and anchors
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
    });
  }

  // Match HTML img tags
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*?)["'])?[^>]*>/gi;

  while ((match = htmlImgRegex.exec(content)) !== null) {
    const imagePath = match[1].split('#')[0];
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
    });
  }

  return images;
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
    } catch {
      // Ignore
    }
  }

  await search(dir);
  return files;
}

/**
 * Generate screenshot ID from image path
 */
function generateScreenshotId(category, imagePath) {
  const basename = path.basename(imagePath, path.extname(imagePath));
  const cleanName = basename
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  // Avoid duplicate prefix
  if (cleanName.startsWith(category)) {
    return cleanName;
  }
  return `${category}-${cleanName}`;
}

/**
 * Scan all markdown files
 */
async function scanDocumentation() {
  console.log('='.repeat(60));
  console.log('  Documentation Screenshot Scanner v2');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Docs path: ${config.docsPath}`);
  console.log('');

  try {
    await fs.access(config.docsPath);
  } catch {
    console.error(`! Documentation path not found: ${config.docsPath}`);
    console.error('');
    console.error('Set DOCS_PATH in your .env file or as environment variable.');
    process.exit(1);
  }

  console.log('Finding markdown files...');
  const mdFiles = await findMarkdownFiles(config.docsPath);
  results.totalFiles = mdFiles.length;
  console.log(`  Found ${mdFiles.length} markdown files`);
  console.log('');

  console.log('Scanning for image references...');
  for (const file of mdFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const images = extractImageReferences(content, file);

      for (const image of images) {
        results.totalImages++;

        // Determine if it's a webapp screenshot
        const category = getWebappCategory(image.path, image.sourceFile);

        if (category) {
          results.webappScreenshots[category].push(image);
        } else {
          results.otherImages.push(image);
        }

        // Track by doc section
        const section = image.sourceFile.split(/[\\/]/).slice(0, 2).join('/');
        if (!results.byDocSection[section]) {
          results.byDocSection[section] = { webapp: 0, other: 0 };
        }
        if (category) {
          results.byDocSection[section].webapp++;
        } else {
          results.byDocSection[section].other++;
        }
      }
    } catch {
      // Skip
    }
  }

  const webappTotal = Object.values(results.webappScreenshots).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  console.log(`  Found ${results.totalImages} image references`);
  console.log(`  Webapp screenshots: ${webappTotal}`);
  console.log(`  Other images: ${results.otherImages.length}`);
  console.log('');
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

  const screenshots = [];
  const seenOutputFiles = new Set();

  for (const image of images) {
    // Normalize output file path
    let outputFile = image.path;
    if (outputFile.startsWith('/')) {
      outputFile = outputFile.substring(1);
    }

    // Skip duplicates
    if (seenOutputFiles.has(outputFile)) {
      continue;
    }
    seenOutputFiles.add(outputFile);

    const urlPath = inferUrlPath(category, image.path);

    screenshots.push({
      id: generateScreenshotId(category, image.path),
      category,
      description:
        image.alt || path.basename(image.path, path.extname(image.path)).replace(/[-_]/g, ' '),
      path: urlPath,
      outputFile,
      sourceDoc: image.sourceFile,
      sourceLine: image.lineNumber,
      needsReview: urlPath.includes('{'),
    });
  }

  return {
    version: '1.0.0',
    description: `${category.charAt(0).toUpperCase() + category.slice(1)} webapp screenshots - generated from documentation`,
    generatedAt: new Date().toISOString(),
    categories: {
      [category]: {
        description: `${category.charAt(0).toUpperCase() + category.slice(1)} webapp screenshots`,
        baseUrl: baseUrls[category],
      },
    },
    screenshots,
    users: [],
    groups: [],
  };
}

/**
 * Generate combined config
 */
function generateCombinedConfig() {
  const baseUrls = {
    cockpit: '/operaton/app/cockpit/default',
    tasklist: '/operaton/app/tasklist/default',
    admin: '/operaton/app/admin/default',
    welcome: '/operaton/app/welcome/default',
  };

  const categories = {};
  const allScreenshots = [];
  const seenOutputFiles = new Set();

  for (const [category, images] of Object.entries(results.webappScreenshots)) {
    if (images.length === 0) continue;

    categories[category] = {
      description: `${category.charAt(0).toUpperCase() + category.slice(1)} webapp screenshots`,
      baseUrl: baseUrls[category],
    };

    for (const image of images) {
      let outputFile = image.path;
      if (outputFile.startsWith('/')) {
        outputFile = outputFile.substring(1);
      }

      if (seenOutputFiles.has(outputFile)) {
        continue;
      }
      seenOutputFiles.add(outputFile);

      const urlPath = inferUrlPath(category, image.path);

      allScreenshots.push({
        id: generateScreenshotId(category, image.path),
        category,
        description:
          image.alt || path.basename(image.path, path.extname(image.path)).replace(/[-_]/g, ' '),
        path: urlPath,
        outputFile,
        sourceDoc: image.sourceFile,
        sourceLine: image.lineNumber,
        needsReview: urlPath.includes('{'),
      });
    }
  }

  return {
    version: '1.0.0',
    description: 'All webapp screenshots - generated from documentation',
    generatedAt: new Date().toISOString(),
    categories,
    screenshots: allScreenshots,
    users: [],
    groups: [],
  };
}

/**
 * Write config files
 */
async function writeConfigs() {
  await fs.mkdir(config.outputDir, { recursive: true });

  console.log('Generating configuration files...');
  console.log('');

  for (const [category, images] of Object.entries(results.webappScreenshots)) {
    if (images.length === 0) continue;

    const categoryConfig = generateCategoryConfig(category, images);
    const outputPath = path.join(config.outputDir, `screenshots-${category}.json`);

    await fs.writeFile(outputPath, JSON.stringify(categoryConfig, null, 2));
    console.log(
      `  + screenshots-${category}.json (${categoryConfig.screenshots.length} screenshots)`
    );
  }

  const combinedConfig = generateCombinedConfig();
  const combinedPath = path.join(config.outputDir, 'screenshots-all.json');
  await fs.writeFile(combinedPath, JSON.stringify(combinedConfig, null, 2));
  console.log(`  + screenshots-all.json (${combinedConfig.screenshots.length} screenshots)`);

  // Write report
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
  const webappTotal = Object.values(results.webappScreenshots).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  let md = '# Documentation Screenshot Scan Report\n\n';
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `**Documentation path:** ${config.docsPath}\n\n`;

  md += '## Summary\n\n';
  md += `- Markdown files scanned: ${results.totalFiles}\n`;
  md += `- Total image references: ${results.totalImages}\n`;
  md += `- **Webapp screenshots: ${webappTotal}**\n`;
  md += `- Other images: ${results.otherImages.length}\n\n`;

  md += '## Webapp Screenshots by Category\n\n';
  md += '| Category | Count |\n';
  md += '|----------|-------|\n';

  for (const [category, images] of Object.entries(results.webappScreenshots)) {
    md += `| ${category} | ${images.length} |\n`;
  }
  md += `| **Total** | **${webappTotal}** |\n`;

  md += '\n## Generated Config Files\n\n';
  md += '| File | Description | Screenshots |\n';
  md += '|------|-------------|-------------|\n';

  for (const [category, images] of Object.entries(results.webappScreenshots)) {
    if (images.length === 0) continue;
    md += `| screenshots-${category}.json | ${category} webapp | ${images.length} |\n`;
  }
  md += `| screenshots-all.json | All webapps | ${webappTotal} |\n`;

  md += '\n## Usage\n\n';
  md += '```bash\n';
  md += '# Copy desired config\n';
  md += 'cp config/generated/screenshots-cockpit.json config/screenshots.json\n';
  md += '\n';
  md += '# Or use all\n';
  md += 'cp config/generated/screenshots-all.json config/screenshots.json\n';
  md += '\n';
  md += '# Capture screenshots\n';
  md += 'make capture\n';
  md += '\n';
  md += '# Replace in docs\n';
  md += 'make replace-screenshots-live\n';
  md += '```\n';

  md += '\n## Notes\n\n';
  md += '- Only images from `webapps/` documentation sections are included\n';
  md += '- Screenshots with `needsReview: true` have dynamic URL parameters\n';
  md += '- Duplicate images (same output path) are automatically deduplicated\n';

  return md;
}

/**
 * Print summary
 */
function printSummary() {
  const webappTotal = Object.values(results.webappScreenshots).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  console.log('');
  console.log('='.repeat(60));
  console.log('  Scan Summary');
  console.log('='.repeat(60));
  console.log('');
  console.log('Webapp screenshots by category:');
  console.log('');

  for (const [category, images] of Object.entries(results.webappScreenshots)) {
    const bar = '#'.repeat(Math.min(Math.ceil(images.length / 2), 40));
    console.log(`  ${category.padEnd(10)} ${images.length.toString().padStart(4)}  ${bar}`);
  }

  console.log('');
  console.log(`  Total webapp screenshots: ${webappTotal}`);
  console.log(`  Other images (not captured): ${results.otherImages.length}`);
  console.log('');
  console.log('='.repeat(60));
}

/**
 * Main
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
