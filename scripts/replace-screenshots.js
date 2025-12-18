#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Replace Screenshots in Documentation
 *
 * Copies captured screenshots to the documentation repository,
 * replacing existing images with newly captured ones.
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration - uses .env values with sensible defaults
const config = {
  // Screenshot config file - defines which screenshots to replace
  configPath: process.env.CONFIG_PATH || path.join(__dirname, '..', 'config', 'screenshots.json'),
  // Source: where captured screenshots are stored
  screenshotsDir: process.env.OUTPUT_DIR || path.join(__dirname, '..', 'output', 'screenshots'),
  // Target: documentation repository paths
  docsPath: process.env.DOCS_PATH || path.join(__dirname, '..', '..', 'documentation', 'docs'),
  staticPath:
    process.env.STATIC_PATH || path.join(__dirname, '..', '..', 'documentation', 'static', 'img'),
  // Dry run mode - don't actually copy files
  dryRun: process.env.DRY_RUN !== 'false',
  // Verbose output
  verbose: process.env.VERBOSE === 'true' || process.env.DEBUG === 'true',
};

// Loaded screenshot definitions
let screenshotConfig = null;

// Results tracking
const results = {
  found: 0,
  replaced: 0,
  notFound: [],
  errors: [],
  copied: [],
  skipped: [],
};

/**
 * Load screenshot configuration
 */
async function loadScreenshotConfig() {
  try {
    const content = await fs.readFile(config.configPath, 'utf8');
    screenshotConfig = JSON.parse(content);

    if (!screenshotConfig.screenshots || screenshotConfig.screenshots.length === 0) {
      console.log('! No screenshots defined in config file.');
      console.log('  Copy a generated config first:');
      console.log('  cp output/scan/screenshots-admin.json config/screenshots.json');
      console.log('');
      return false;
    }

    console.log(`Config: ${config.configPath}`);
    console.log(`  ${screenshotConfig.screenshots.length} screenshots defined`);
    console.log('');
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`! Config file not found: ${config.configPath}`);
    } else {
      console.error(`! Error reading config: ${err.message}`);
    }
    return false;
  }
}

/**
 * Check if a screenshot file is defined in the config
 */
function isInConfig(screenshotPath) {
  if (!screenshotConfig || !screenshotConfig.screenshots) {
    return false;
  }

  const relativePath = path.relative(config.screenshotsDir, screenshotPath);
  const normalizedPath = relativePath.replace(/\\/g, '/');

  return screenshotConfig.screenshots.some(s => {
    const configPath = s.outputFile.replace(/\\/g, '/');
    return (
      configPath === normalizedPath ||
      configPath.endsWith(normalizedPath) ||
      normalizedPath.endsWith(configPath)
    );
  });
}

/**
 * Find all files recursively in a directory
 */
async function findFiles(dir, extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg']) {
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
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
      // eslint-disable-next-line no-unused-vars
    } catch (err) {
      // Ignore errors
    }
  }

  try {
    await fs.access(dir);
    await search(dir);
  } catch {
    // Directory doesn't exist
  }

  return files;
}

/**
 * Build index of existing documentation images
 */
async function buildDocsImageIndex() {
  const index = new Map();

  console.log('Building documentation image index...');

  // Search in docs folder
  const docsImages = await findFiles(config.docsPath);
  for (const file of docsImages) {
    const relativePath = path.relative(config.docsPath, file);
    const basename = path.basename(file);

    if (!index.has(basename)) {
      index.set(basename, []);
    }
    index.get(basename).push({
      fullPath: file,
      relativePath,
      location: 'docs',
    });
  }

  // Search in static/img folder
  const staticImages = await findFiles(config.staticPath);
  for (const file of staticImages) {
    const relativePath = path.relative(config.staticPath, file);
    const basename = path.basename(file);

    if (!index.has(basename)) {
      index.set(basename, []);
    }
    index.get(basename).push({
      fullPath: file,
      relativePath,
      location: 'static',
    });
  }

  console.log(`  Found ${index.size} unique image names in documentation`);
  console.log(`  Total locations: ${docsImages.length + staticImages.length}`);
  console.log('');

  return index;
}

/**
 * Copy file with directory creation
 */
async function copyFile(source, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

/**
 * Process captured screenshots
 */
async function processScreenshots(docsIndex) {
  console.log('Processing captured screenshots...');
  console.log(`  Source: ${config.screenshotsDir}`);
  console.log('');

  // Check if screenshots directory exists
  try {
    await fs.access(config.screenshotsDir);
  } catch {
    console.error(`! Screenshots directory not found: ${config.screenshotsDir}`);
    console.error('');
    console.error('Run "make capture" first to capture screenshots.');
    process.exit(1);
  }

  // Find all captured screenshots
  const allScreenshots = await findFiles(config.screenshotsDir);

  if (allScreenshots.length === 0) {
    console.log('  No screenshots found to process.');
    return;
  }

  // Filter to only screenshots defined in config
  const screenshots = allScreenshots.filter(s => isInConfig(s));
  results.found = screenshots.length;
  results.skipped = allScreenshots.filter(s => !isInConfig(s));

  console.log(`  Found ${allScreenshots.length} captured screenshots`);
  console.log(`  Matching config: ${screenshots.length}`);
  if (results.skipped.length > 0) {
    console.log(`  Skipped (not in config): ${results.skipped.length}`);
  }
  console.log('');

  if (screenshots.length === 0) {
    console.log('  No screenshots match the current config.');
    console.log('  Make sure config/screenshots.json matches your captured screenshots.');
    return;
  }

  // Process each screenshot
  for (const screenshotPath of screenshots) {
    const basename = path.basename(screenshotPath);
    const relativePath = path.relative(config.screenshotsDir, screenshotPath);

    if (config.verbose) {
      console.log(`  Processing: ${relativePath}`);
    }

    // Check if this image exists in docs
    const docsLocations = docsIndex.get(basename);

    if (docsLocations && docsLocations.length > 0) {
      // Replace in all locations
      for (const location of docsLocations) {
        try {
          if (config.dryRun) {
            console.log(`  [DRY RUN] Would copy: ${relativePath}`);
            console.log(`            -> ${location.fullPath}`);
          } else {
            await copyFile(screenshotPath, location.fullPath);
            if (config.verbose) {
              console.log(`    + Replaced: ${location.fullPath}`);
            }
          }
          results.copied.push({
            source: relativePath,
            destination: location.fullPath,
            location: location.location,
          });
          results.replaced++;
        } catch (err) {
          results.errors.push({
            source: relativePath,
            destination: location.fullPath,
            error: err.message,
          });
        }
      }
    } else {
      // Image not found in docs - might be a new screenshot
      results.notFound.push({
        source: relativePath,
        basename,
      });

      if (config.verbose) {
        console.log(`    ? Not found in docs: ${basename}`);
      }
    }
  }
}

/**
 * Print summary report
 */
function printSummary() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  Replace Screenshots Summary');
  console.log('='.repeat(60));
  console.log('');
  console.log(`  In config:            ${results.found}`);
  console.log(`  Replacements made:    ${results.replaced}`);
  console.log(`  Not in docs:          ${results.notFound.length}`);
  console.log(`  Skipped (not in cfg): ${results.skipped.length}`);
  console.log(`  Errors:               ${results.errors.length}`);
  console.log('');

  if (config.dryRun) {
    console.log('  [DRY RUN MODE - no files were actually copied]');
    console.log('');
  }

  if (results.notFound.length > 0) {
    console.log('Screenshots not found in documentation:');
    console.log('-'.repeat(40));
    for (const item of results.notFound.slice(0, 20)) {
      console.log(`  - ${item.source}`);
    }
    if (results.notFound.length > 20) {
      console.log(`  ... and ${results.notFound.length - 20} more`);
    }
    console.log('');
    console.log('These may be new screenshots. Consider adding them to the docs.');
    console.log('');
  }

  if (results.errors.length > 0) {
    console.log('Errors:');
    console.log('-'.repeat(40));
    for (const err of results.errors) {
      console.log(`  ! ${err.source}: ${err.error}`);
    }
    console.log('');
  }

  console.log('='.repeat(60));
}

/**
 * Generate detailed report file
 */
async function generateReport() {
  const reportPath = path.join(config.screenshotsDir, '..', 'replace-report.md');

  let md = '# Screenshot Replacement Report\n\n';
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `**Mode:** ${config.dryRun ? 'DRY RUN' : 'LIVE'}\n\n`;

  md += '## Summary\n\n';
  md += `- Screenshots processed: ${results.found}\n`;
  md += `- Replacements made: ${results.replaced}\n`;
  md += `- Not found in docs: ${results.notFound.length}\n`;
  md += `- Errors: ${results.errors.length}\n\n`;

  if (results.copied.length > 0) {
    md += '## Replaced Screenshots\n\n';
    md += '| Source | Destination | Location |\n';
    md += '|--------|-------------|----------|\n';
    for (const item of results.copied) {
      md += `| ${item.source} | ${path.basename(item.destination)} | ${item.location} |\n`;
    }
    md += '\n';
  }

  if (results.notFound.length > 0) {
    md += '## Not Found in Documentation\n\n';
    md +=
      'These screenshots were captured but no matching file was found in the documentation:\n\n';
    for (const item of results.notFound) {
      md += `- ${item.source}\n`;
    }
    md += '\n';
  }

  if (results.errors.length > 0) {
    md += '## Errors\n\n';
    for (const err of results.errors) {
      md += `- **${err.source}**: ${err.error}\n`;
    }
    md += '\n';
  }

  await fs.writeFile(reportPath, md);
  console.log(`Report saved to: ${reportPath}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60));
  console.log('  Replace Documentation Screenshots');
  console.log('='.repeat(60));
  console.log('');

  if (config.dryRun) {
    console.log('*** DRY RUN MODE - No files will be modified ***');
    console.log('');
  }

  // Load screenshot config first
  const configLoaded = await loadScreenshotConfig();
  if (!configLoaded) {
    process.exit(1);
  }

  console.log('Paths:');
  console.log(`  Screenshots: ${config.screenshotsDir}`);
  console.log(`  Docs path:   ${config.docsPath}`);
  console.log(`  Static path: ${config.staticPath}`);
  console.log('');

  // Build index of existing documentation images
  const docsIndex = await buildDocsImageIndex();

  // Process screenshots
  await processScreenshots(docsIndex);

  // Print summary
  printSummary();

  // Generate report
  await generateReport();

  console.log('');

  if (results.replaced > 0 && !config.dryRun) {
    console.log('+ Screenshots replaced successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Review changes in the documentation repository');
    console.log('  2. Commit and push the updated screenshots');
  } else if (config.dryRun && results.replaced > 0) {
    console.log('To actually replace screenshots, run:');
    console.log('  make replace-screenshots-live');
  }
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
