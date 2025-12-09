#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Analyze documentation to identify screenshots that need replacement
 *
 * This script:
 * 1. Scans markdown files for image references
 * 2. Categorizes them by webapp (cockpit, tasklist, admin)
 * 3. Identifies which ones need replacement
 * 4. Generates a replacement plan
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  docsPath: process.env.DOCS_PATH || process.argv[2] || '../../docs',
  outputDir: process.env.OUTPUT_DIR || './output',
  replaceAll: process.env.REPLACE_ALL === 'true',
};

// Patterns that indicate legacy screenshots needing replacement
const LEGACY_PATTERNS = [
  /cockpit/i,
  /tasklist/i,
  /admin-/i,
  /webapp/i,
  /dashboard/i,
  /process-definition/i,
  /process-instance/i,
  /decision-/i,
  /task-/i,
  /filter-/i,
  /batch/i,
  /migration/i,
  /cleanup/i,
];

// Categories for screenshots
const CATEGORIES = {
  cockpit: {
    patterns: [
      /cockpit/i,
      /dashboard/i,
      /process-/i,
      /decision-/i,
      /batch/i,
      /migration/i,
      /heatmap/i,
    ],
    description: 'Cockpit webapp screenshots',
  },
  tasklist: {
    patterns: [/tasklist/i, /task-/i, /filter/i, /form/i],
    description: 'Tasklist webapp screenshots',
  },
  admin: {
    patterns: [/admin-/i, /user/i, /group/i, /tenant/i, /authorization/i, /system/i],
    description: 'Admin webapp screenshots',
  },
  welcome: {
    patterns: [/welcome/i, /profile/i],
    description: 'Welcome page screenshots',
  },
  modeler: {
    patterns: [/modeler/i, /diagram/i, /bpmn-/i],
    description: 'Modeler screenshots',
  },
  other: {
    patterns: [],
    description: 'Other screenshots',
  },
};

/**
 * Log debug information if DEBUG mode is enabled
 * @param {string} message - Debug message
 */
function debug(message) {
  if (process.env.DEBUG === 'true') {
    console.log(`    [DEBUG] ${message}`);
  }
}

/**
 * Categorize a screenshot based on its path/name
 * @param {string} imagePath - Path to the image
 * @returns {string} - Category name
 */
function categorizeScreenshot(imagePath) {
  const pathLower = imagePath.toLowerCase();

  for (const [category, categoryConfig] of Object.entries(CATEGORIES)) {
    for (const pattern of categoryConfig.patterns) {
      if (pattern.test(pathLower)) {
        return category;
      }
    }
  }

  return 'other';
}

/**
 * Check if screenshot needs replacement
 * @param {string} imagePath - Path to the image
 * @returns {boolean} - True if needs replacement
 */
function needsReplacement(imagePath) {
  // If REPLACE_ALL is enabled, all screenshots need replacement
  if (config.replaceAll) {
    return true;
  }

  const pathLower = imagePath.toLowerCase();
  return LEGACY_PATTERNS.some(pattern => pattern.test(pathLower));
}

/**
 * Extract image references from markdown content
 * @param {string} content - File content
 * @param {string} filePath - Source file path
 * @returns {Array} - Array of image references
 */
function extractImageReferences(content, filePath) {
  const images = [];

  // Markdown image syntax: ![alt](path)
  const mdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = mdRegex.exec(content)) !== null) {
    const imagePath = match[2];

    // Skip external URLs
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      debug(`Skipping external URL: ${imagePath}`);
      continue;
    }

    const ext = path.extname(imagePath).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) {
      images.push({
        alt: match[1],
        path: imagePath,
        fullMatch: match[0],
        sourceFile: filePath,
        lineNumber: content.substring(0, match.index).split('\n').length,
      });
    }
  }

  // HTML img tags
  const htmlRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;

  while ((match = htmlRegex.exec(content)) !== null) {
    const imagePath = match[1];

    if (imagePath.startsWith('http')) {
      debug(`Skipping external URL: ${imagePath}`);
      continue;
    }

    images.push({
      alt: '',
      path: imagePath,
      fullMatch: match[0],
      sourceFile: filePath,
      lineNumber: content.substring(0, match.index).split('\n').length,
    });
  }

  return images;
}

/**
 * Analyze a single markdown file
 * @param {string} filePath - Path to markdown file
 * @returns {Promise<Array>} - Array of analyzed images
 */
async function analyzeFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const images = extractImageReferences(content, filePath);

    debug(`${filePath}: found ${images.length} images`);

    return images.map(img => ({
      ...img,
      category: categorizeScreenshot(img.path),
      needsReplacement: needsReplacement(img.path),
    }));
  } catch (error) {
    console.error(`  ✗ Error reading ${filePath}: ${error.message}`);
    return [];
  }
}

/**
 * Find all markdown files in documentation
 * @param {string} docsPath - Path to documentation directory
 * @returns {Promise<Array>} - Array of file paths
 */
async function findMarkdownFiles(docsPath) {
  const pattern = path.join(docsPath, '**/*.{md,mdx}').replace(/\\/g, '/');
  debug(`Glob pattern: ${pattern}`);

  try {
    const files = await glob(pattern, { ignore: ['**/node_modules/**'] });
    return files;
  } catch (error) {
    console.error(`  ✗ Error scanning for files: ${error.message}`);
    return [];
  }
}

/**
 * Generate replacement report
 * @param {Array} allImages - All analyzed images
 * @returns {Object} - Report object
 */
function generateReport(allImages) {
  const report = {
    summary: {
      total: allImages.length,
      needsReplacement: allImages.filter(i => i.needsReplacement).length,
      byCategory: {},
    },
    byCategory: {},
    replacementPlan: [],
  };

  // Group by category
  for (const image of allImages) {
    if (!report.byCategory[image.category]) {
      report.byCategory[image.category] = [];
    }
    report.byCategory[image.category].push(image);
  }

  // Calculate stats per category
  for (const [category, images] of Object.entries(report.byCategory)) {
    report.summary.byCategory[category] = {
      total: images.length,
      needsReplacement: images.filter(i => i.needsReplacement).length,
    };
  }

  // Build replacement plan
  const toReplace = allImages.filter(i => i.needsReplacement);
  const uniquePaths = [...new Set(toReplace.map(i => i.path))];

  for (const imagePath of uniquePaths) {
    const references = toReplace.filter(i => i.path === imagePath);
    report.replacementPlan.push({
      imagePath,
      category: references[0].category,
      referencedIn: references.map(r => ({
        file: r.sourceFile,
        line: r.lineNumber,
      })),
    });
  }

  return report;
}

/**
 * Generate markdown report file
 * @param {Object} report - Report object
 * @returns {string} - Markdown content
 */
function generateMarkdownReport(report) {
  let md = `# Operaton Screenshot Replacement Plan

Generated: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}

## Summary

| Metric | Count |
|--------|-------|
| Total screenshots | ${report.summary.total} |
| Need replacement | ${report.summary.needsReplacement} |

## By Category

| Category | Total | Need Replacement |
|----------|-------|------------------|
`;

  for (const [category, stats] of Object.entries(report.summary.byCategory)) {
    md += `| ${category} | ${stats.total} | ${stats.needsReplacement} |\n`;
  }

  md += `
## Replacement Plan

Screenshots that need to be replaced with Operaton versions:

`;

  // Group by category
  for (const [category] of Object.entries(CATEGORIES)) {
    const items = report.replacementPlan.filter(i => i.category === category);
    if (items.length === 0) continue;

    md += `### ${category.charAt(0).toUpperCase() + category.slice(1)} (${items.length})\n\n`;

    for (const item of items.slice(0, 20)) {
      md += `- **${path.basename(item.imagePath)}**\n`;
      md += `  - Path: \`${item.imagePath}\`\n`;
      md += `  - Referenced in: ${item.referencedIn.length} file(s)\n`;
      item.referencedIn.slice(0, 3).forEach(ref => {
        md += `    - ${path.relative('.', ref.file)}:${ref.line}\n`;
      });
      if (item.referencedIn.length > 3) {
        md += `    - ... and ${item.referencedIn.length - 3} more\n`;
      }
      md += '\n';
    }

    if (items.length > 20) {
      md += `... and ${items.length - 20} more ${category} screenshots\n\n`;
    }
  }

  md += `
## Next Steps

1. **Deploy processes to Operaton**
   \`\`\`bash
   make deploy
   \`\`\`

2. **Generate test data**
   \`\`\`bash
   make data
   \`\`\`

3. **Capture screenshots**
   \`\`\`bash
   make capture
   \`\`\`

4. **Copy screenshots to documentation**
   - Review captured screenshots in \`output/screenshots/\`
   - Copy to appropriate locations in docs
   - Update any path references if needed

## Configuration

To customize which screenshots to capture, edit \`config/screenshots.json\`.
`;

  return md;
}

/**
 * Check if a path exists and is a directory
 * @param {string} dirPath - Path to check
 * @returns {Promise<boolean>} - True if exists and is directory
 */
async function isDirectory(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('═'.repeat(60));
  console.log('  Documentation Screenshot Analyzer');
  console.log('═'.repeat(60));
  console.log('');

  if (process.env.DEBUG === 'true') {
    console.log('Configuration:');
    console.log(`  Docs path: ${config.docsPath}`);
    console.log(`  Output dir: ${config.outputDir}`);
    console.log(`  Replace all: ${config.replaceAll}`);
    console.log('');
  }

  // Resolve and validate docs path
  const docsPath = path.resolve(config.docsPath);
  console.log(`Scanning: ${docsPath}`);
  if (config.replaceAll) {
    console.log('');
    console.log('⚠ REPLACE_ALL mode: All screenshots will be flagged for replacement');
  }
  console.log('');

  // Check if docs directory exists
  if (!(await isDirectory(docsPath))) {
    console.log(`✗ Documentation directory not found: ${docsPath}`);
    console.log('');
    console.log('Troubleshooting:');
    console.log('  1. Verify the path exists');
    console.log('  2. Set DOCS_PATH in .env file');
    console.log('  3. Pass path as argument: node scripts/analyze-documentation.js /path/to/docs');
    process.exit(1);
  }

  // Find all markdown files
  const mdFiles = await findMarkdownFiles(docsPath);

  if (mdFiles.length === 0) {
    console.log('⚠ No markdown files found');
    console.log('');
    console.log('Troubleshooting:');
    console.log('  1. Verify the docs directory contains .md or .mdx files');
    console.log('  2. Check that files are not in node_modules (excluded)');
    process.exit(0);
  }

  console.log(`Found ${mdFiles.length} markdown files`);
  console.log('');

  // Analyze each file
  const allImages = [];

  for (const file of mdFiles) {
    const images = await analyzeFile(file);
    if (images.length === 0 && process.env.DEBUG === 'true') {
      debug(`No images in: ${file}`);
    }
    allImages.push(...images);
  }

  console.log(`Found ${allImages.length} image references`);
  console.log('');

  if (allImages.length === 0) {
    console.log('⚠ No image references found in documentation');
    console.log('');
    console.log('═'.repeat(60));
    process.exit(0);
  }

  // Generate report
  const report = generateReport(allImages);

  // Print summary
  console.log('─'.repeat(60));
  console.log('  Summary');
  console.log('─'.repeat(60));
  console.log(`  Total screenshots:    ${report.summary.total}`);
  console.log(`  Need replacement:     ${report.summary.needsReplacement}`);
  console.log('');

  console.log('─'.repeat(60));
  console.log('  By Category');
  console.log('─'.repeat(60));

  for (const [category, stats] of Object.entries(report.summary.byCategory)) {
    const padded = category.padEnd(12);
    console.log(
      `  ${padded} ${String(stats.total).padStart(4)} total, ${String(stats.needsReplacement).padStart(4)} need replacement`
    );
  }
  console.log('');

  // Save reports
  const outputDir = path.resolve(config.outputDir);

  try {
    await fs.mkdir(outputDir, { recursive: true });

    const jsonPath = path.join(outputDir, 'screenshot-analysis.json');
    const mdPath = path.join(outputDir, 'REPLACEMENT_PLAN.md');

    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
    await fs.writeFile(mdPath, generateMarkdownReport(report));

    console.log('─'.repeat(60));
    console.log('  Output Files');
    console.log('─'.repeat(60));
    console.log(`  ✓ ${jsonPath}`);
    console.log(`  ✓ ${mdPath}`);
    console.log('');
  } catch (error) {
    console.error(`✗ Error saving reports: ${error.message}`);
    process.exit(1);
  }

  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  if (process.env.DEBUG === 'true') {
    console.error(err.stack);
  }
  process.exit(1);
});
