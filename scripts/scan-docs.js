#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Scan Documentation for Screenshots
 *
 * Scans documentation for all image references:
 * 1. Identifies webapp screenshots (cockpit, tasklist, admin, welcome)
 * 2. Generates capture configurations and reports
 *
 * All output goes to output/scan/ (untracked)
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const config = {
  docsPath: process.env.DOCS_PATH || path.join(__dirname, '..', '..', 'documentation', 'docs'),
  assetsPath:
    process.env.ASSETS_PATH || path.join(__dirname, '..', '..', 'documentation', 'docs', 'assets'),
  // Legacy static path (optional)
  staticPath: process.env.STATIC_PATH || null,
  outputDir: process.env.SCAN_OUTPUT_DIR || path.join(__dirname, '..', 'output', 'scan'),
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
  statistics: {
    byCategory: {},
    byDocSection: {},
  },
};

/**
 * Determine webapp category from image path
 */
function getWebappCategory(imagePath, sourceFile) {
  const imgLower = imagePath.toLowerCase();
  const srcLower = sourceFile.toLowerCase();

  // Check if image is in webapps documentation section
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

  // Check image filename prefixes
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

  return null;
}

/**
 * Infer URL path from image filename for cockpit
 */
function inferCockpitUrl(imagePath) {
  const img = imagePath.toLowerCase();

  if (img.includes('dashboard')) return '#/dashboard';
  if (img.includes('process-definition') || img.includes('process_definition')) {
    return '#/process-definition/{processDefinitionKey}';
  }
  if (img.includes('process-instance') || img.includes('process_instance')) {
    return '#/process-instance/{processInstanceId}';
  }
  if (img.includes('processes')) return '#/processes';
  if (img.includes('decision-definition') || img.includes('decision_definition')) {
    return '#/decision-definition/{decisionDefinitionKey}';
  }
  if (img.includes('decision-instance') || img.includes('decision_instance')) {
    return '#/decision-instance/{decisionInstanceId}';
  }
  if (img.includes('decision')) return '#/decisions';
  if (img.includes('case-definition') || img.includes('case_definition')) {
    return '#/case-definition/{caseDefinitionKey}';
  }
  if (img.includes('case-instance') || img.includes('case_instance')) {
    return '#/case-instance/{caseInstanceId}';
  }
  if (img.includes('case')) return '#/cases';
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
    const imagePath = match[2].split(' ')[0].split('#')[0];
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

  if (cleanName.startsWith(category)) {
    return cleanName;
  }
  return `${category}-${cleanName}`;
}

/**
 * Normalize output path to remove relative components
 * Converts paths like "../../../assets/documentation/webapps/welcome/img.png"
 * to "assets/documentation/webapps/welcome/img.png"
 */
function normalizeOutputPath(imagePath) {
  // Remove leading relative path components (../, ./)
  let normalized = imagePath
    .replace(/^(\.\.\/)+/g, '') // Remove leading ../
    .replace(/^(\.\/)+/g, ''); // Remove leading ./

  // Remove leading slash
  if (normalized.startsWith('/')) {
    normalized = normalized.substring(1);
  }

  // Normalize path separators
  normalized = normalized.replace(/\\/g, '/');

  return normalized;
}

/**
 * Scan all markdown files
 */
async function scanDocumentation() {
  console.log('='.repeat(60));
  console.log('  Documentation Screenshot Scanner');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Docs path: ${config.docsPath}`);
  console.log('');

  try {
    await fs.access(config.docsPath);
  } catch {
    console.error(`! Documentation path not found: ${config.docsPath}`);
    console.error('');
    console.error('Set DOCS_PATH in your .env file.');
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

        // Determine category
        const category = getWebappCategory(image.path, image.sourceFile);

        if (category) {
          results.webappScreenshots[category].push(image);
          results.statistics.byCategory[category] =
            (results.statistics.byCategory[category] || 0) + 1;
        } else {
          results.otherImages.push(image);
        }

        // Track by doc section
        const section = image.sourceFile.split(/[\\/]/).slice(0, 2).join('/');
        results.statistics.byDocSection[section] =
          (results.statistics.byDocSection[section] || 0) + 1;
      }
    } catch {
      // Skip
    }
  }

  const webappTotal = Object.values(results.webappScreenshots).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  console.log(`  Total images: ${results.totalImages}`);
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
    const outputFile = normalizeOutputPath(image.path);

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
    description: `${category.charAt(0).toUpperCase() + category.slice(1)} webapp screenshots`,
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
      const outputFile = normalizeOutputPath(image.path);

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
    description: 'All webapp screenshots',
    generatedAt: new Date().toISOString(),
    categories,
    screenshots: allScreenshots,
    users: [],
    groups: [],
  };
}

/**
 * Generate scan report
 */
function generateScanReport() {
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
  md += `- Webapp screenshots: ${webappTotal}\n`;
  md += `- Other images: ${results.otherImages.length}\n\n`;

  md += '## Webapp Screenshots by Category\n\n';
  md += '```\n';
  md += 'Category     Count\n';
  md += '------------ -----\n';
  for (const [category, images] of Object.entries(results.webappScreenshots)) {
    md += `${category.padEnd(12)} ${images.length}\n`;
  }
  md += `${'TOTAL'.padEnd(12)} ${webappTotal}\n`;
  md += '```\n\n';

  md += '## Generated Files\n\n';
  md += '```\n';
  md += 'File                          Screenshots\n';
  md += '----------------------------- -----------\n';
  for (const [category, images] of Object.entries(results.webappScreenshots)) {
    if (images.length === 0) continue;
    md += `${`screenshots-${category}.json`.padEnd(30)}${images.length}\n`;
  }
  md += `${`screenshots-all.json`.padEnd(30)}${webappTotal}\n`;
  md += '```\n\n';

  md += '## Usage\n\n';
  md += '```bash\n';
  md += '# Copy desired config to config/screenshots.json\n';
  md += 'cp output/scan/screenshots-admin.json config/screenshots.json\n';
  md += '\n';
  md += '# Or use all\n';
  md += 'cp output/scan/screenshots-all.json config/screenshots.json\n';
  md += '\n';
  md += '# Then capture and replace\n';
  md += 'make capture\n';
  md += 'make replace-screenshots-live\n';
  md += '```\n';

  return md;
}

/**
 * Write all output files
 */
async function writeOutputs() {
  await fs.mkdir(config.outputDir, { recursive: true });

  console.log('Generating output files...');
  console.log(`Output directory: ${config.outputDir}`);
  console.log('');

  // Write per-category configs
  for (const [category, images] of Object.entries(results.webappScreenshots)) {
    if (images.length === 0) continue;

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

  // Write scan report
  const scanReportPath = path.join(config.outputDir, 'scan-report.md');
  await fs.writeFile(scanReportPath, generateScanReport());
  console.log(`  + scan-report.md`);

  console.log('');
}

/**
 * Print summary
 */
function printSummary() {
  const webappTotal = Object.values(results.webappScreenshots).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

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
  console.log(`  Other images: ${results.otherImages.length}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('');
  console.log('Next steps:');
  console.log('  1. Copy a config: cp output/scan/screenshots-admin.json config/screenshots.json');
  console.log('  2. Capture: make capture');
  console.log('  3. Replace: make replace-screenshots-live');
}

/**
 * Main
 */
async function main() {
  await scanDocumentation();
  await writeOutputs();
  printSummary();

  console.log('');
  console.log('+ Scan complete!');
  console.log('');
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  if (config.debug) {
    console.error(err.stack);
  }
  process.exit(1);
});
