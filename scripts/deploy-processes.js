#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Deploy BPMN/DMN/CMMN processes to Operaton
 *
 * This script:
 * 1. Reads process definitions from config
 * 2. Deploys them to Operaton via REST API
 * 3. Tracks deployment status
 */

import 'dotenv/config';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  baseUrl: process.env.OPERATON_REST_URL || 'https://operaton-doc.open-regels.nl/engine-rest',
  webUrl: process.env.OPERATON_BASE_URL || 'https://operaton-doc.open-regels.nl',
  username: process.env.OPERATON_USERNAME || 'demo',
  password: process.env.OPERATON_PASSWORD || 'demo',
  processesDir: process.env.PROCESSES_DIR || path.join(__dirname, '..', 'processes'),
  deploymentSource: process.env.DEPLOYMENT_SOURCE || 'screenshot-automation',
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
 * Get error message from axios error
 * @param {Error} error - Axios error
 * @returns {string} - Error message
 */
function getErrorMessage(error) {
  if (error.response) {
    const { status = 0 } = error.response;
    switch (status) {
      case 400:
        return 'Bad request - check file format';
      case 401:
        return 'Authentication failed';
      case 403:
        return 'Access forbidden';
      case 404:
        return 'Endpoint not found';
      case 500:
        return 'Server error';
      case 502:
        return 'Bad gateway';
      case 503:
        return 'Service unavailable';
      default:
        if (status > 0) {
          return `HTTP ${status}`;
        }
        // Check for error message in response body
        if (error.response.data?.message) {
          return error.response.data.message.substring(0, 100);
        }
        return 'Unknown HTTP error';
    }
  } else if (error.code) {
    switch (error.code) {
      case 'ECONNREFUSED':
        return 'Connection refused - is Operaton running?';
      case 'ENOTFOUND':
        return 'Host not found';
      case 'ETIMEDOUT':
        return 'Connection timed out';
      default:
        return error.code;
    }
  }
  return error.message;
}

// Create axios instance with auth
const api = axios.create({
  baseURL: config.baseUrl,
  auth: {
    username: config.username,
    password: config.password,
  },
  headers: {
    Accept: 'application/json',
  },
  timeout: 30000,
});

/**
 * Check if Operaton is accessible
 * @returns {Promise<{connected: boolean, engine?: string, error?: string}>}
 */
async function checkConnection() {
  try {
    const response = await api.get('/engine');
    const engines = response.data;
    if (Array.isArray(engines) && engines.length > 0) {
      return { connected: true, engine: engines[0].name };
    }
    return { connected: false, error: 'No engines found' };
  } catch (error) {
    return { connected: false, error: getErrorMessage(error) };
  }
}

/**
 * Get existing deployments
 * @returns {Promise<Array>}
 */
async function getExistingDeployments() {
  try {
    const response = await api.get('/deployment');
    return response.data;
  } catch (error) {
    debug(`Failed to get deployments: ${getErrorMessage(error)}`);
    return [];
  }
}

/**
 * Deploy a single process file
 * @param {Object} processConfig - Process configuration
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object|null>}
 */
async function deployProcess(processConfig, filePath) {
  const form = new FormData();

  try {
    // Read the file
    const fileContent = await fs.readFile(filePath);
    const fileName = path.basename(filePath);

    debug(`Deploying file: ${fileName} (${fileContent.length} bytes)`);

    // Add file to form
    form.append('upload', fileContent, {
      filename: fileName,
      contentType: 'application/octet-stream',
    });

    // Deployment metadata
    form.append('deployment-name', processConfig.name);
    form.append('deployment-source', config.deploymentSource);
    form.append('enable-duplicate-filtering', 'true');
    form.append('deploy-changed-only', 'true');

    const response = await api.post('/deployment/create', form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 60000, // Longer timeout for deployment
    });

    const processCount = Object.keys(response.data.deployedProcessDefinitions || {}).length;
    const decisionCount = Object.keys(response.data.deployedDecisionDefinitions || {}).length;
    const caseCount = Object.keys(response.data.deployedCaseDefinitions || {}).length;

    console.log(`  ✓ Deployed: ${processConfig.name}`);
    console.log(`    ID: ${response.data.id}`);

    if (processCount > 0) console.log(`    Processes: ${processCount}`);
    if (decisionCount > 0) console.log(`    Decisions: ${decisionCount}`);
    if (caseCount > 0) console.log(`    Cases: ${caseCount}`);

    return response.data;
  } catch (error) {
    console.log(`  ✗ Failed to deploy ${processConfig.name}: ${getErrorMessage(error)}`);
    if (error.response?.data && process.env.DEBUG === 'true') {
      console.log(`    Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    }
    return null;
  }
}

/**
 * Discover process files in directory
 * @param {string} dir - Directory to scan
 * @param {string} extension - File extension to find
 * @returns {Promise<Array<{name: string, file: string, path: string}>>}
 */
async function discoverFiles(dir, extension) {
  const pattern = path.join(dir, '**', `*.${extension}`).replace(/\\/g, '/');
  debug(`Scanning for ${extension} files: ${pattern}`);

  try {
    const files = await glob(pattern);
    return files.map(filePath => {
      const fileName = path.basename(filePath, `.${extension}`);
      // Create a readable name from filename
      const name = fileName
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      return {
        name,
        file: path.relative(path.join(__dirname, '..'), filePath),
        path: filePath,
      };
    });
  } catch (error) {
    debug(`Error scanning for ${extension} files: ${error.message}`);
    return [];
  }
}

/**
 * Check if processes directory exists
 * @returns {Promise<boolean>}
 */
async function checkProcessesDir() {
  try {
    const stats = await fs.stat(config.processesDir);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Deploy all discovered processes
 * @returns {Promise<Object>}
 */
async function deployAllProcesses() {
  const results = {
    deployed: [],
    failed: [],
    skipped: [],
  };

  // Discover BPMN files
  const bpmnFiles = await discoverFiles(config.processesDir, 'bpmn');
  if (bpmnFiles.length > 0) {
    console.log('');
    console.log('─'.repeat(50));
    console.log('  Deploying BPMN Processes');
    console.log('─'.repeat(50));

    for (const process of bpmnFiles) {
      const result = await deployProcess(process, process.path);
      if (result) {
        results.deployed.push({ key: process.name, ...result });
      } else {
        results.failed.push({ key: process.name, name: process.name });
      }
    }
  }

  // Discover DMN files
  const dmnFiles = await discoverFiles(config.processesDir, 'dmn');
  if (dmnFiles.length > 0) {
    console.log('');
    console.log('─'.repeat(50));
    console.log('  Deploying DMN Decisions');
    console.log('─'.repeat(50));

    for (const decision of dmnFiles) {
      const result = await deployProcess(decision, decision.path);
      if (result) {
        results.deployed.push({ key: decision.name, ...result });
      } else {
        results.failed.push({ key: decision.name, name: decision.name });
      }
    }
  }

  // Discover CMMN files
  const cmmnFiles = await discoverFiles(config.processesDir, 'cmmn');
  if (cmmnFiles.length > 0) {
    console.log('');
    console.log('─'.repeat(50));
    console.log('  Deploying CMMN Cases');
    console.log('─'.repeat(50));

    for (const caseFile of cmmnFiles) {
      const result = await deployProcess(caseFile, caseFile.path);
      if (result) {
        results.deployed.push({ key: caseFile.name, ...result });
      } else {
        results.failed.push({ key: caseFile.name, name: caseFile.name });
      }
    }
  }

  // Check if any files were found
  const totalFiles = bpmnFiles.length + dmnFiles.length + cmmnFiles.length;
  if (totalFiles === 0) {
    console.log('');
    console.log('⚠ No process files found');
    console.log('');
    console.log('Expected directory structure:');
    console.log(`  ${config.processesDir}/`);
    console.log('    ├── bpmn/');
    console.log('    │   └── *.bpmn');
    console.log('    ├── dmn/');
    console.log('    │   └── *.dmn');
    console.log('    └── cmmn/');
    console.log('        └── *.cmmn');
  }

  return results;
}

/**
 * Main execution
 */
async function main() {
  console.log('═'.repeat(60));
  console.log('  Operaton Process Deployment');
  console.log('═'.repeat(60));
  console.log('');

  if (process.env.DEBUG === 'true') {
    console.log('Configuration:');
    console.log(`  REST URL: ${config.baseUrl}`);
    console.log(`  Web URL: ${config.webUrl}`);
    console.log(`  Username: ${config.username}`);
    console.log(`  Password: ${'*'.repeat(config.password.length)}`);
    console.log(`  Processes dir: ${config.processesDir}`);
    console.log('');
  }

  console.log(`Target: ${config.baseUrl}`);
  console.log('');

  // Check connection
  const connection = await checkConnection();
  if (!connection.connected) {
    console.log(`✗ Cannot connect to Operaton: ${connection.error}`);
    console.log('');
    console.log('Troubleshooting:');
    console.log('  1. Run "make check" for detailed connection diagnostics');
    console.log('  2. Verify Operaton is running');
    console.log('  3. Check .env file configuration');
    process.exit(1);
  }

  console.log(`✓ Connected to engine: ${connection.engine}`);

  // Check processes directory
  if (!(await checkProcessesDir())) {
    console.log(`✗ Processes directory not found: ${config.processesDir}`);
    console.log('');
    console.log('Troubleshooting:');
    console.log('  1. Create the processes/ directory');
    console.log('  2. Add BPMN/DMN/CMMN files to deploy');
    console.log('  3. Or set PROCESSES_DIR environment variable');
    process.exit(1);
  }

  // Show existing deployments
  console.log('');
  console.log('─'.repeat(50));
  console.log('  Existing Deployments');
  console.log('─'.repeat(50));

  const existingDeployments = await getExistingDeployments();
  if (existingDeployments.length === 0) {
    console.log('  (none)');
  } else {
    existingDeployments.slice(0, 5).forEach(d => {
      const name = d.name || '(unnamed)';
      console.log(`  - ${name} (${d.id.substring(0, 8)}...)`);
    });
    if (existingDeployments.length > 5) {
      console.log(`  ... and ${existingDeployments.length - 5} more`);
    }
  }

  // Deploy processes
  const results = await deployAllProcesses();

  // Summary
  console.log('');
  console.log('═'.repeat(60));
  console.log('  Deployment Summary');
  console.log('═'.repeat(60));
  console.log(`  Deployed: ${results.deployed.length}`);
  console.log(`  Failed:   ${results.failed.length}`);
  console.log('═'.repeat(60));

  if (results.failed.length > 0) {
    console.log('');
    console.log('Failed deployments:');
    results.failed.forEach(f => console.log(`  - ${f.name}`));
  }

  // Exit with error if any deployments failed
  if (results.failed.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  if (process.env.DEBUG === 'true') {
    console.error(err.stack);
  }
  process.exit(1);
});
