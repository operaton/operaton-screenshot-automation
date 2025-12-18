#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Capture screenshots of Operaton webapps
 *
 * Uses Puppeteer to:
 * 1. Login to Operaton
 * 2. Navigate to various pages
 * 3. Capture screenshots
 * 4. Organize output for documentation
 */

import 'dotenv/config';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH =
  process.env.CONFIG_PATH || path.join(__dirname, '..', 'config', 'screenshots.json');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, '..', 'output', 'screenshots');

// Configuration
const config = {
  baseUrl: process.env.OPERATON_BASE_URL || 'https://operaton-doc.open-regels.nl',
  restUrl: process.env.OPERATON_REST_URL || 'https://operaton-doc.open-regels.nl/engine-rest',
  username: process.env.OPERATON_USERNAME || 'demo',
  password: process.env.OPERATON_PASSWORD || 'demo',
  viewport: {
    width: parseInt(process.env.SCREENSHOT_WIDTH) || 1920,
    height: parseInt(process.env.SCREENSHOT_HEIGHT) || 1080,
  },
  deviceScaleFactor: parseInt(process.env.SCREENSHOT_SCALE) || 2,
  headless: process.env.HEADLESS !== 'false',
  debug: process.env.DEBUG === 'true',
};

// API client for dynamic data
const api = axios.create({
  baseURL: config.restUrl,
  auth: {
    username: config.username,
    password: config.password,
  },
  timeout: 30000,
});

/**
 * Delay helper
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Log debug information
 * @param {string} message - Debug message
 */
function debug(message) {
  if (config.debug) {
    console.log(`    [DEBUG] ${message}`);
  }
}

/**
 * Get dynamic data needed for screenshots
 */
async function getDynamicData() {
  const data = {
    processInstances: [],
    tasks: [],
    decisionInstances: [],
  };

  try {
    // Get running process instances
    const instances = await api.get('/process-instance', { params: { maxResults: 10 } });
    data.processInstances = instances.data;

    // Get tasks
    const tasks = await api.get('/task', { params: { maxResults: 10 } });
    data.tasks = tasks.data;

    // Get decision instances
    const decisions = await api.get('/history/decision-instance', { params: { maxResults: 10 } });
    data.decisionInstances = decisions.data;
  } catch (error) {
    console.warn('  ! Could not fetch dynamic data:', error.message);
  }

  return data;
}

/**
 * Login to Operaton
 */
async function login(page, app = 'cockpit') {
  const loginUrl = `${config.baseUrl}/operaton/app/${app}/default/`;

  debug(`Login URL: ${loginUrl}`);
  await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait for page to stabilize
  await delay(1000);

  // Check if we're on the login page by looking for username input
  try {
    const usernameInput = await page.$(
      'input[name="username"], input#username, input[placeholder="Username"]'
    );

    if (usernameInput) {
      console.log(`  Logging in as ${config.username}...`);

      // Clear and fill username
      await usernameInput.click({ clickCount: 3 });
      await usernameInput.type(config.username);

      // Fill password
      const passwordInput = await page.$(
        'input[name="password"], input#password, input[type="password"]'
      );
      if (passwordInput) {
        await passwordInput.click({ clickCount: 3 });
        await passwordInput.type(config.password);
      }

      // Submit form
      const submitButton = await page.$(
        'button[type="submit"], button.btn-primary, input[type="submit"]'
      );
      if (submitButton) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
            /* empty */
          }),
          submitButton.click(),
        ]);
      }

      // Wait for app to load after login
      await delay(2000);

      // Verify login succeeded
      const stillOnLogin = await page.$('input[name="username"], input[placeholder="Username"]');
      if (stillOnLogin) {
        console.log('  ! Login may have failed - still on login page');
      } else {
        console.log('  + Logged in successfully');
      }
    } else {
      // Check if we're actually logged in by looking for app content
      const appContent = await page.$(
        '.navbar, .cam-header, [ng-view], .content-wrapper, .ctn-header'
      );
      if (appContent) {
        console.log('  + Already logged in');
      } else {
        console.log('  ! Could not detect login state');
        debug(`Page URL: ${page.url()}`);
      }
    }
  } catch (error) {
    console.warn('  ! Login error:', error.message);
  }

  // Wait for app to fully load
  await delay(2000);
}

/**
 * Navigate to a specific page within an app
 */
async function navigateTo(page, urlPath, waitForSelector = null) {
  const url = urlPath.startsWith('http') ? urlPath : `${config.baseUrl}${urlPath}`;

  debug(`Navigating to: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  if (waitForSelector) {
    try {
      await page.waitForSelector(waitForSelector, { timeout: 10000 });
    } catch {
      debug(`Selector not found: ${waitForSelector}`);
    }
  }

  // Give page time to fully render
  await delay(1500);
}

/**
 * Take a screenshot
 */
async function takeScreenshot(page, outputPath, options = {}) {
  const fullPath = path.join(OUTPUT_DIR, outputPath);

  // Ensure directory exists
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  const screenshotOptions = {
    path: fullPath,
    type: 'png',
    ...options,
  };

  // If selector is specified, screenshot just that element
  if (options.selector) {
    const element = await page.$(options.selector);
    if (element) {
      await element.screenshot({ path: fullPath });
    } else {
      debug(`Element not found: ${options.selector}`);
      await page.screenshot(screenshotOptions);
    }
  } else {
    await page.screenshot(screenshotOptions);
  }

  console.log(`  + Saved: ${outputPath}`);
  return fullPath;
}

/**
 * Execute custom actions before taking screenshot
 */
async function executeActions(page, actions) {
  for (const action of actions) {
    switch (action) {
      case 'enableHeatmap':
        try {
          await page.click('[cam-widget-search-pill-action="toggleHeatmap"]');
          await delay(1000);
        } catch {
          debug('Heatmap toggle not found');
        }
        break;

      case 'openCreateFilterDialog':
        try {
          await page.click('[ng-click="createFilter()"]');
          await page.waitForSelector('.modal-dialog', { timeout: 5000 });
          await delay(500);
        } catch {
          debug('Create filter dialog not found');
        }
        break;

      case 'openFilterDetail':
        try {
          await page.click('.filter-name');
          await delay(500);
        } catch {
          debug('Filter detail not found');
        }
        break;

      default:
        debug(`Unknown action: ${action}`);
    }
  }
}

/**
 * Resolve variables in URL path
 */
function resolvePath(pathTemplate, variables, dynamicData) {
  let resolvedPath = pathTemplate;

  // Replace static variables
  for (const [key, value] of Object.entries(variables || {})) {
    resolvedPath = resolvedPath.replace(`{${key}}`, value);
  }

  // Replace dynamic variables
  if (resolvedPath.includes('{processInstanceId}') && dynamicData.processInstances.length > 0) {
    resolvedPath = resolvedPath.replace('{processInstanceId}', dynamicData.processInstances[0].id);
  }

  if (resolvedPath.includes('{taskId}') && dynamicData.tasks.length > 0) {
    resolvedPath = resolvedPath.replace('{taskId}', dynamicData.tasks[0].id);
  }

  if (resolvedPath.includes('{decisionInstanceId}') && dynamicData.decisionInstances.length > 0) {
    resolvedPath = resolvedPath.replace(
      '{decisionInstanceId}',
      dynamicData.decisionInstances[0].id
    );
  }

  return resolvedPath;
}

/**
 * Process a single screenshot definition
 */
async function captureScreenshot(page, screenshot, configData, dynamicData) {
  console.log(`\n[${screenshot.id}] ${screenshot.description}`);

  const category = configData.categories[screenshot.category];
  if (!category) {
    console.error(`  ! Unknown category: ${screenshot.category}`);
    return false;
  }

  // Build full URL
  const resolvedPath = resolvePath(screenshot.path, screenshot.variables, dynamicData);

  // Check if path has unresolved variables
  if (resolvedPath.includes('{')) {
    console.warn(`  ! Skipping - unresolved variables in path: ${resolvedPath}`);
    return false;
  }

  const fullPath = `${category.baseUrl}${resolvedPath}`;

  try {
    // Navigate to page
    await navigateTo(page, fullPath, screenshot.waitForSelector);

    // Execute any pre-screenshot actions
    if (screenshot.actions) {
      await executeActions(page, screenshot.actions);
    }

    // Take screenshot
    await takeScreenshot(page, screenshot.outputFile, {
      selector: screenshot.selector,
      fullPage: screenshot.fullPage,
    });

    return true;
  } catch (error) {
    console.error(`  ! Failed: ${error.message}`);
    return false;
  }
}

/**
 * Main capture workflow
 */
async function main() {
  console.log('='.repeat(60));
  console.log('  Operaton Screenshot Capture');
  console.log('='.repeat(60));
  console.log('');

  if (config.debug) {
    console.log('Configuration:');
    console.log(`  Base URL: ${config.baseUrl}`);
    console.log(`  REST URL: ${config.restUrl}`);
    console.log(`  Username: ${config.username}`);
    console.log(`  Password: ${'*'.repeat(config.password.length)}`);
    console.log(`  Viewport: ${config.viewport.width}x${config.viewport.height}`);
    console.log(`  Scale: ${config.deviceScaleFactor}x`);
    console.log(`  Headless: ${config.headless}`);
    console.log('');
  }

  console.log(`Target: ${config.baseUrl}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Headless: ${config.headless}`);
  console.log('');

  // Load configuration
  let configData;
  try {
    configData = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
  } catch (error) {
    console.error(`! Failed to load config: ${error.message}`);
    process.exit(1);
  }

  // Get dynamic data
  console.log('Fetching dynamic data...');
  const dynamicData = await getDynamicData();
  console.log(`  Process instances: ${dynamicData.processInstances.length}`);
  console.log(`  Tasks: ${dynamicData.tasks.length}`);
  console.log(`  Decision instances: ${dynamicData.decisionInstances.length}`);

  // Launch browser
  console.log('');
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: config.headless ? 'new' : false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      `--window-size=${config.viewport.width},${config.viewport.height}`,
    ],
  });

  const page = await browser.newPage();

  // Set viewport
  await page.setViewport({
    width: config.viewport.width,
    height: config.viewport.height,
    deviceScaleFactor: config.deviceScaleFactor,
  });

  // Track results
  const results = {
    captured: [],
    skipped: [],
    failed: [],
  };

  let currentApp = null;

  try {
    // Process each screenshot
    for (const screenshot of configData.screenshots) {
      const category = configData.categories[screenshot.category];

      // Determine which app this screenshot belongs to
      let targetApp = 'cockpit';
      if (category.baseUrl.includes('/tasklist/')) {
        targetApp = 'tasklist';
      } else if (category.baseUrl.includes('/admin/')) {
        targetApp = 'admin';
      } else if (category.baseUrl.includes('/welcome/')) {
        targetApp = 'welcome';
      }

      // Login to app if needed
      if (currentApp !== targetApp) {
        console.log(`\nSwitching to ${targetApp}...`);
        await login(page, targetApp);
        currentApp = targetApp;
      }

      const success = await captureScreenshot(page, screenshot, configData, dynamicData);

      if (success) {
        results.captured.push(screenshot.id);
      } else {
        results.failed.push(screenshot.id);
      }
    }
  } catch (error) {
    console.error('\n! Fatal error:', error.message);
    if (config.debug) {
      console.error(error.stack);
    }
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('');
  console.log('='.repeat(60));
  console.log('  Capture Summary');
  console.log('='.repeat(60));
  console.log(`  Captured: ${results.captured.length}`);
  console.log(`  Skipped:  ${results.skipped.length}`);
  console.log(`  Failed:   ${results.failed.length}`);
  console.log('='.repeat(60));

  if (results.failed.length > 0) {
    console.log('');
    console.log('Failed screenshots:');
    results.failed.forEach(id => console.log(`  - ${id}`));
  }

  console.log('');
  console.log(`Screenshots saved to: ${OUTPUT_DIR}`);
  console.log('');

  // Exit with error if any failures
  if (results.failed.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  if (config.debug) {
    console.error(err.stack);
  }
  process.exit(1);
});
