#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Generate test data for Operaton screenshots
 *
 * Creates:
 * - Users and groups
 * - Process instances (running and completed)
 * - User tasks (assigned and unassigned)
 * - Decision instances
 */

import 'dotenv/config';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const config = {
  baseUrl: process.env.OPERATON_REST_URL || 'https://operaton-doc.open-regels.nl/engine-rest',
  webUrl: process.env.OPERATON_BASE_URL || 'https://operaton-doc.open-regels.nl',
  username: process.env.OPERATON_USERNAME || 'demo',
  password: process.env.OPERATON_PASSWORD || 'demo',
  configPath: process.env.CONFIG_PATH || path.join(__dirname, '..', 'config', 'screenshots.json'),
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
    const message = error.response.data?.message;
    if (message) {
      // Truncate long messages
      const truncated = message.length > 100 ? `${message.substring(0, 100)}...` : message;
      return `${truncated} (HTTP ${status})`;
    }
    switch (status) {
      case 400:
        return 'Bad request';
      case 401:
        return 'Authentication failed';
      case 403:
        return 'Access forbidden';
      case 404:
        return 'Not found';
      case 500:
        return 'Server error';
      default:
        return `HTTP ${status}`;
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

// API client
const api = axios.create({
  baseURL: config.baseUrl,
  auth: {
    username: config.username,
    password: config.password,
  },
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Track created resources
const stats = {
  users: { created: 0, existed: 0, failed: 0 },
  groups: { created: 0, existed: 0, failed: 0 },
  instances: { created: 0, completed: 0, failed: 0 },
  decisions: { evaluated: 0, failed: 0 },
  tasks: { completed: 0, failed: 0 },
};

/**
 * Delay helper
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check connection to Operaton
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
 * Load configuration file
 * @returns {Promise<Object|null>}
 */
async function loadConfig() {
  try {
    const configPath = path.resolve(config.configPath);
    debug(`Loading config from: ${configPath}`);

    const content = await fs.readFile(configPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`✗ Configuration file not found: ${config.configPath}`);
      console.log('');
      console.log('Troubleshooting:');
      console.log('  1. Create config/screenshots.json with user/group definitions');
      console.log('  2. Or set CONFIG_PATH environment variable');
    } else if (error instanceof SyntaxError) {
      console.log(`✗ Invalid JSON in configuration file: ${error.message}`);
    } else {
      console.log(`✗ Error loading configuration: ${error.message}`);
    }
    return null;
  }
}

// ============================================================================
// USER AND GROUP FUNCTIONS
// ============================================================================

/**
 * Create a user
 * @param {Object} userData - User data
 * @returns {Promise<Object|null>}
 */
async function createUser(userData) {
  try {
    // Check if user exists
    const existing = await api.get(`/user/${userData.id}/profile`).catch(() => null);
    if (existing?.data) {
      console.log(`  ⊘ User ${userData.id} already exists`);
      stats.users.existed++;
      return existing.data;
    }

    await api.post('/user/create', {
      profile: {
        id: userData.id,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
      },
      credentials: {
        password: userData.password,
      },
    });

    console.log(`  ✓ Created user: ${userData.id}`);
    stats.users.created++;
    return userData;
  } catch (error) {
    if (error.response?.data?.message?.includes('already exists')) {
      console.log(`  ⊘ User ${userData.id} already exists`);
      stats.users.existed++;
      return null;
    }
    console.log(`  ✗ Failed to create user ${userData.id}: ${getErrorMessage(error)}`);
    stats.users.failed++;
    return null;
  }
}

/**
 * Create a group
 * @param {Object} groupData - Group data
 * @returns {Promise<Object|null>}
 */
async function createGroup(groupData) {
  try {
    // Check if group exists
    const existing = await api.get(`/group/${groupData.id}`).catch(() => null);
    if (existing?.data) {
      console.log(`  ⊘ Group ${groupData.id} already exists`);
      stats.groups.existed++;
      return existing.data;
    }

    await api.post('/group/create', {
      id: groupData.id,
      name: groupData.name,
      type: groupData.type || 'WORKFLOW',
    });

    console.log(`  ✓ Created group: ${groupData.id}`);
    stats.groups.created++;
    return groupData;
  } catch (error) {
    if (error.response?.data?.message?.includes('already exists')) {
      console.log(`  ⊘ Group ${groupData.id} already exists`);
      stats.groups.existed++;
      return null;
    }
    console.log(`  ✗ Failed to create group ${groupData.id}: ${getErrorMessage(error)}`);
    stats.groups.failed++;
    return null;
  }
}

/**
 * Add user to group
 * @param {string} userId - User ID
 * @param {string} groupId - Group ID
 */
async function addUserToGroup(userId, groupId) {
  try {
    await api.put(`/group/${groupId}/members/${userId}`);
    console.log(`  ✓ Added ${userId} to group ${groupId}`);
  } catch (error) {
    if (!error.response?.data?.message?.includes('already member')) {
      debug(`Could not add ${userId} to ${groupId}: ${getErrorMessage(error)}`);
    }
  }
}

/**
 * Setup users and groups
 * @param {Object} configData - Configuration data
 */
async function setupUsersAndGroups(configData) {
  console.log('');
  console.log('─'.repeat(50));
  console.log('  Creating Users');
  console.log('─'.repeat(50));

  if (configData.users && configData.users.length > 0) {
    for (const user of configData.users) {
      await createUser(user);
      await delay(100);
    }
  } else {
    console.log('  No users defined in configuration');
  }

  console.log('');
  console.log('─'.repeat(50));
  console.log('  Creating Groups');
  console.log('─'.repeat(50));

  if (configData.groups && configData.groups.length > 0) {
    for (const group of configData.groups) {
      await createGroup(group);
      await delay(100);
    }
  } else {
    console.log('  No groups defined in configuration');
  }

  console.log('');
  console.log('─'.repeat(50));
  console.log('  Adding Users to Groups');
  console.log('─'.repeat(50));

  // Add users to groups based on configuration
  if (configData.memberships) {
    for (const membership of configData.memberships) {
      await addUserToGroup(membership.userId, membership.groupId);
      await delay(100);
    }
  } else {
    // Default memberships
    await addUserToGroup('demo', 'operaton-admin');
    await addUserToGroup('john', 'accounting');
    await addUserToGroup('mary', 'management');
    await addUserToGroup('peter', 'sales');
  }
}

// ============================================================================
// PROCESS AND DECISION FUNCTIONS
// ============================================================================

/**
 * Get process definitions
 * @returns {Promise<Array>}
 */
async function getProcessDefinitions() {
  try {
    const response = await api.get('/process-definition', { params: { latestVersion: true } });
    return response.data;
  } catch (error) {
    debug(`Failed to get process definitions: ${getErrorMessage(error)}`);
    return [];
  }
}

/**
 * Get decision definitions
 * @returns {Promise<Array>}
 */
async function getDecisionDefinitions() {
  try {
    const response = await api.get('/decision-definition', { params: { latestVersion: true } });
    return response.data;
  } catch (error) {
    debug(`Failed to get decision definitions: ${getErrorMessage(error)}`);
    return [];
  }
}

/**
 * Start a process instance
 * @param {string} processKey - Process definition key
 * @param {Object} variables - Process variables
 * @param {string} businessKey - Business key
 * @returns {Promise<Object|null>}
 */
async function startProcessInstance(processKey, variables = {}, businessKey = null) {
  try {
    const payload = {
      variables: Object.fromEntries(
        Object.entries(variables).map(([key, value]) => [
          key,
          { value, type: typeof value === 'number' ? 'Double' : 'String' },
        ])
      ),
    };

    if (businessKey) {
      payload.businessKey = businessKey;
    }

    const response = await api.post(`/process-definition/key/${processKey}/start`, payload);

    debug(`Started ${processKey}: ${response.data.id}`);
    console.log(`  ✓ Started process: ${processKey} (${response.data.id.substring(0, 8)}...)`);
    stats.instances.created++;
    return response.data;
  } catch (error) {
    console.log(`  ✗ Failed to start ${processKey}: ${getErrorMessage(error)}`);
    stats.instances.failed++;
    return null;
  }
}

/**
 * Get tasks
 * @param {Object} params - Query parameters
 * @returns {Promise<Array>}
 */
async function getTasks(params = {}) {
  try {
    const response = await api.get('/task', { params });
    return response.data;
  } catch (error) {
    debug(`Failed to get tasks: ${getErrorMessage(error)}`);
    return [];
  }
}

/**
 * Complete a task
 * @param {string} taskId - Task ID
 * @param {Object} variables - Task variables
 * @returns {Promise<boolean>}
 */
async function completeTask(taskId, variables = {}) {
  try {
    await api.post(`/task/${taskId}/complete`, {
      variables: Object.fromEntries(
        Object.entries(variables).map(([key, value]) => [
          key,
          { value, type: typeof value === 'boolean' ? 'Boolean' : 'String' },
        ])
      ),
    });
    debug(`Completed task ${taskId}`);
    stats.tasks.completed++;
    return true;
  } catch (error) {
    debug(`Failed to complete task ${taskId}: ${getErrorMessage(error)}`);
    stats.tasks.failed++;
    return false;
  }
}

/**
 * Evaluate a decision
 * @param {string} decisionKey - Decision definition key
 * @param {Object} variables - Decision variables
 * @returns {Promise<Object|null>}
 */
async function evaluateDecision(decisionKey, variables) {
  try {
    const response = await api.post(`/decision-definition/key/${decisionKey}/evaluate`, {
      variables: Object.fromEntries(
        Object.entries(variables).map(([key, value]) => [
          key,
          { value, type: typeof value === 'number' ? 'Double' : 'String' },
        ])
      ),
    });
    debug(`Evaluated decision ${decisionKey}`);
    console.log(`  ✓ Evaluated decision: ${decisionKey}`);
    stats.decisions.evaluated++;
    return response.data;
  } catch (error) {
    console.log(`  ✗ Failed to evaluate ${decisionKey}: ${getErrorMessage(error)}`);
    stats.decisions.failed++;
    return null;
  }
}

// ============================================================================
// TEST SCENARIOS
// ============================================================================

/**
 * Create test scenarios
 */
async function createTestScenarios() {
  // Get available process definitions
  const definitions = await getProcessDefinitions();
  console.log('');
  console.log('─'.repeat(50));
  console.log('  Process Definitions');
  console.log('─'.repeat(50));
  console.log(`  Found ${definitions.length} process definition(s)`);

  if (definitions.length === 0) {
    console.log('');
    console.log('⚠ No process definitions found');
    console.log('');
    console.log('Run "make deploy" first to deploy processes.');
    return;
  }

  for (const def of definitions) {
    console.log(`    - ${def.name || def.key} (${def.key})`);
  }

  // Find invoice process (or use first available)
  const invoiceProcess = definitions.find(d => d.key === 'invoice') || definitions[0];

  // Scenario 1: Active instances
  console.log('');
  console.log('─'.repeat(50));
  console.log('  Creating Active Process Instances');
  console.log('─'.repeat(50));

  const categories = ['Travel Expenses', 'Misc', 'Software License'];
  for (let i = 0; i < 5; i++) {
    await startProcessInstance(
      invoiceProcess.key,
      {
        amount: Math.floor(Math.random() * 2000) + 100,
        creditor: `Vendor ${i + 1}`,
        invoiceNumber: `INV-${Date.now()}-${i}`,
        invoiceCategory: categories[i % 3],
      },
      `BK-${Date.now()}-${i}`
    );
    await delay(200);
  }

  // Scenario 2: Completed instances
  console.log('');
  console.log('─'.repeat(50));
  console.log('  Creating Completed Process Instances');
  console.log('─'.repeat(50));

  for (let i = 0; i < 3; i++) {
    const instance = await startProcessInstance(invoiceProcess.key, {
      amount: 150, // Low amount for auto-approval
      creditor: `Completed Vendor ${i + 1}`,
      invoiceNumber: `INV-COMP-${Date.now()}-${i}`,
      invoiceCategory: 'Misc',
    });

    if (instance) {
      await delay(500);

      // Get and complete the first task
      const tasks = await getTasks();
      const instanceTask = tasks.find(t => t.processInstanceId === instance.id);

      if (instanceTask) {
        await completeTask(instanceTask.id, { approved: true });
        stats.instances.completed++;
        console.log(`    ✓ Completed instance ${instance.id.substring(0, 8)}...`);
      }
    }
    await delay(200);
  }

  // Scenario 3: Decision evaluations
  const decisions = await getDecisionDefinitions();
  console.log('');
  console.log('─'.repeat(50));
  console.log('  Decision Definitions');
  console.log('─'.repeat(50));
  console.log(`  Found ${decisions.length} decision definition(s)`);

  for (const def of decisions) {
    console.log(`    - ${def.name || def.key} (${def.key})`);
  }

  if (decisions.length > 0) {
    console.log('');
    console.log('─'.repeat(50));
    console.log('  Evaluating Decisions');
    console.log('─'.repeat(50));

    const invoiceDecision = decisions.find(d => d.key === 'invoice-assign-approver');

    if (invoiceDecision) {
      const amounts = [100, 500, 1500];
      for (const amount of amounts) {
        await evaluateDecision(invoiceDecision.key, {
          amount,
          invoiceCategory: 'Travel Expenses',
        });
        await delay(200);
      }
    } else {
      console.log('  ⊘ Invoice assign approver decision not found, skipping evaluations');
    }
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('═'.repeat(60));
  console.log('  Operaton Test Data Generator');
  console.log('═'.repeat(60));
  console.log('');

  if (process.env.DEBUG === 'true') {
    console.log('Configuration:');
    console.log(`  REST URL: ${config.baseUrl}`);
    console.log(`  Web URL: ${config.webUrl}`);
    console.log(`  Username: ${config.username}`);
    console.log(`  Password: ${'*'.repeat(config.password.length)}`);
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

  // Load configuration
  const configData = await loadConfig();
  if (!configData) {
    process.exit(1);
  }

  debug(
    `Config loaded with ${configData.users?.length || 0} users, ${configData.groups?.length || 0} groups`
  );

  // Setup users and groups
  await setupUsersAndGroups(configData);

  // Create test scenarios
  await createTestScenarios();

  // Print summary
  console.log('');
  console.log('═'.repeat(60));
  console.log('  Data Generation Summary');
  console.log('═'.repeat(60));
  console.log(
    `  Users:     ${stats.users.created} created, ${stats.users.existed} existed, ${stats.users.failed} failed`
  );
  console.log(
    `  Groups:    ${stats.groups.created} created, ${stats.groups.existed} existed, ${stats.groups.failed} failed`
  );
  console.log(
    `  Instances: ${stats.instances.created} created, ${stats.instances.completed} completed, ${stats.instances.failed} failed`
  );
  console.log(
    `  Decisions: ${stats.decisions.evaluated} evaluated, ${stats.decisions.failed} failed`
  );
  console.log('═'.repeat(60));

  // Check for failures (only count user/group failures as critical)
  const criticalFailures = stats.users.failed + stats.groups.failed;
  const totalFailures = criticalFailures + stats.instances.failed + stats.decisions.failed;

  if (totalFailures > 0) {
    console.log('');
    if (criticalFailures > 0) {
      console.log(`✗ Completed with ${criticalFailures} critical failure(s)`);
    } else {
      console.log(
        `⚠ Completed with ${stats.instances.failed} instance failure(s) (processes may not be deployed)`
      );
    }
  } else {
    console.log('');
    console.log('✓ Data generation complete');
  }

  console.log('');
  console.log('Next steps:');
  console.log('  make status     # Verify data in Operaton');
  console.log('  make capture    # Capture screenshots');

  // Exit with error only if user/group creation failed
  if (criticalFailures > 0) {
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
