#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Reset Operaton Environment
 *
 * Deletes:
 * - All process instances (running and completed)
 * - All deployments
 * - All created users and groups
 * - All batches
 * - All history data
 */

import 'dotenv/config';
import axios from 'axios';
import readline from 'readline';

// Configuration
const config = {
  baseUrl: process.env.OPERATON_REST_URL || 'https://operaton-doc.open-regels.nl/engine-rest',
  webUrl: process.env.OPERATON_BASE_URL || 'https://operaton-doc.open-regels.nl',
  username: process.env.OPERATON_USERNAME || 'demo',
  password: process.env.OPERATON_PASSWORD || 'demo',
};

// Parse command line arguments
const args = process.argv.slice(2);
const forceMode = args.includes('--force') || args.includes('-f');
const instancesOnly = args.includes('--instances-only');
const deploymentsOnly = args.includes('--deployments-only');
const usersOnly = args.includes('--users-only');
const historyOnly = args.includes('--history-only');

// Protected users and groups (never delete these)
const PROTECTED_USERS = ['demo', 'admin'];
const PROTECTED_GROUPS = ['operaton-admin'];

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
      return `${message} (HTTP ${status})`;
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

/**
 * Delay helper
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ask for confirmation
 * @param {string} message - Confirmation message
 * @returns {Promise<boolean>}
 */
function confirm(message) {
  if (forceMode) {
    return Promise.resolve(true);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(`${message} [y/N] `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

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

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================

/**
 * Delete all running process instances
 * @returns {Promise<number>} - Number of deleted instances
 */
async function deleteProcessInstances() {
  console.log('');
  console.log('Deleting process instances...');

  try {
    const response = await api.get('/process-instance', { params: { maxResults: 1000 } });
    const instances = response.data;

    if (instances.length === 0) {
      console.log('  No running instances found');
      return 0;
    }

    console.log(`  Found ${instances.length} running instance(s)`);
    debug(
      `Instance IDs: ${instances
        .slice(0, 5)
        .map(i => i.id)
        .join(', ')}...`
    );

    let deleted = 0;
    for (const instance of instances) {
      try {
        await api.delete(`/process-instance/${instance.id}`, {
          params: { skipCustomListeners: true, skipIoMappings: true },
        });
        deleted++;
      } catch {
        // Try force delete
        try {
          await api.delete(`/process-instance/${instance.id}`, {
            params: { skipCustomListeners: true, skipIoMappings: true, skipSubprocesses: true },
          });
          deleted++;
        } catch (retryError) {
          debug(`Could not delete instance ${instance.id}: ${getErrorMessage(retryError)}`);
        }
      }
    }

    console.log(`  ✓ Deleted ${deleted} process instance(s)`);
    return deleted;
  } catch (error) {
    console.log(`  ✗ Error deleting instances: ${getErrorMessage(error)}`);
    return 0;
  }
}

/**
 * Delete all historic process instances
 * @returns {Promise<number>} - Number of deleted instances
 */
async function deleteHistoricInstances() {
  console.log('');
  console.log('Deleting historic process instances...');

  try {
    const response = await api.get('/history/process-instance', { params: { maxResults: 1000 } });
    const instances = response.data;

    if (instances.length === 0) {
      console.log('  No historic instances found');
      return 0;
    }

    console.log(`  Found ${instances.length} historic instance(s)`);

    let deleted = 0;
    for (const instance of instances) {
      try {
        await api.delete(`/history/process-instance/${instance.id}`);
        deleted++;
      } catch (error) {
        debug(`Could not delete historic instance ${instance.id}: ${getErrorMessage(error)}`);
      }
    }

    console.log(`  ✓ Deleted ${deleted} historic instance(s)`);
    return deleted;
  } catch (error) {
    console.log(`  ✗ Error deleting historic instances: ${getErrorMessage(error)}`);
    return 0;
  }
}

/**
 * Delete all deployments
 * @returns {Promise<number>} - Number of deleted deployments
 */
async function deleteDeployments() {
  console.log('');
  console.log('Deleting deployments...');

  try {
    const response = await api.get('/deployment');
    const deployments = response.data;

    if (deployments.length === 0) {
      console.log('  No deployments found');
      return 0;
    }

    console.log(`  Found ${deployments.length} deployment(s)`);

    let deleted = 0;
    for (const deployment of deployments) {
      const name = deployment.name || '(unnamed)';
      try {
        await api.delete(`/deployment/${deployment.id}`, {
          params: { cascade: true, skipCustomListeners: true, skipIoMappings: true },
        });
        deleted++;
        console.log(`    Deleted: ${name}`);
      } catch (error) {
        console.log(`    ⚠ Could not delete ${name}: ${getErrorMessage(error)}`);
      }
      await delay(100);
    }

    console.log(`  ✓ Deleted ${deleted} deployment(s)`);
    return deleted;
  } catch (error) {
    console.log(`  ✗ Error deleting deployments: ${getErrorMessage(error)}`);
    return 0;
  }
}

/**
 * Delete batches
 * @returns {Promise<number>} - Number of deleted batches
 */
async function deleteBatches() {
  console.log('');
  console.log('Deleting batches...');

  try {
    const response = await api.get('/batch');
    const batches = response.data;

    if (batches.length === 0) {
      console.log('  No batches found');
      return 0;
    }

    console.log(`  Found ${batches.length} batch(es)`);

    let deleted = 0;
    for (const batch of batches) {
      try {
        await api.delete(`/batch/${batch.id}`, { params: { cascade: true } });
        deleted++;
      } catch (error) {
        debug(`Could not delete batch ${batch.id}: ${getErrorMessage(error)}`);
      }
    }

    console.log(`  ✓ Deleted ${deleted} batch(es)`);
    return deleted;
  } catch (error) {
    console.log(`  ✗ Error deleting batches: ${getErrorMessage(error)}`);
    return 0;
  }
}

/**
 * Delete historic batches
 * @returns {Promise<number>} - Number of deleted batches
 */
async function deleteHistoricBatches() {
  console.log('');
  console.log('Deleting historic batches...');

  try {
    const response = await api.get('/history/batch');
    const batches = response.data;

    if (batches.length === 0) {
      console.log('  No historic batches found');
      return 0;
    }

    let deleted = 0;
    for (const batch of batches) {
      try {
        await api.delete(`/history/batch/${batch.id}`);
        deleted++;
      } catch {
        // Ignore
      }
    }

    console.log(`  ✓ Deleted ${deleted} historic batch(es)`);
    return deleted;
  } catch {
    console.log('  No historic batches found');
    return 0;
  }
}

/**
 * Delete all users except protected ones
 * @returns {Promise<number>} - Number of deleted users
 */
async function deleteUsers() {
  console.log('');
  console.log('Deleting users...');

  try {
    // Fetch all users
    const response = await api.get('/user');
    const users = response.data;

    // Filter out protected users
    const usersToDelete = users.filter(u => !PROTECTED_USERS.includes(u.id));

    if (usersToDelete.length === 0) {
      console.log('  No users to delete (only protected users exist)');
      return 0;
    }

    console.log(`  Found ${usersToDelete.length} user(s) to delete`);

    let deleted = 0;
    for (const user of usersToDelete) {
      try {
        await api.delete(`/user/${user.id}`);
        console.log(`    Deleted user: ${user.id}`);
        deleted++;
      } catch (error) {
        debug(`Could not delete user ${user.id}: ${getErrorMessage(error)}`);
      }
    }

    console.log(`  ✓ Deleted ${deleted} user(s)`);
    return deleted;
  } catch (error) {
    console.log(`  ✗ Error fetching users: ${getErrorMessage(error)}`);
    return 0;
  }
}

/**
 * Delete all groups except protected ones
 * @returns {Promise<number>} - Number of deleted groups
 */
async function deleteGroups() {
  console.log('');
  console.log('Deleting groups...');

  try {
    // Fetch all groups
    const response = await api.get('/group');
    const groups = response.data;

    // Filter out protected groups
    const groupsToDelete = groups.filter(g => !PROTECTED_GROUPS.includes(g.id));

    if (groupsToDelete.length === 0) {
      console.log('  No groups to delete (only protected groups exist)');
      return 0;
    }

    console.log(`  Found ${groupsToDelete.length} group(s) to delete`);

    let deleted = 0;
    for (const group of groupsToDelete) {
      try {
        await api.delete(`/group/${group.id}`);
        console.log(`    Deleted group: ${group.id}`);
        deleted++;
      } catch (error) {
        debug(`Could not delete group ${group.id}: ${getErrorMessage(error)}`);
      }
    }

    console.log(`  ✓ Deleted ${deleted} group(s)`);
    return deleted;
  } catch (error) {
    console.log(`  ✗ Error fetching groups: ${getErrorMessage(error)}`);
    return 0;
  }
}

/**
 * Delete decision instances
 * @returns {Promise<number>} - Number of deleted instances
 */
async function deleteDecisionInstances() {
  console.log('');
  console.log('Deleting decision instances...');

  try {
    const response = await api.get('/history/decision-instance', { params: { maxResults: 1000 } });
    const instances = response.data;

    if (instances.length === 0) {
      console.log('  No decision instances found');
      return 0;
    }

    console.log(`  Found ${instances.length} decision instance(s)`);

    let deleted = 0;
    for (const instance of instances) {
      try {
        await api.delete(`/history/decision-instance/${instance.id}`);
        deleted++;
      } catch {
        // Some may not be deletable individually
      }
    }

    console.log(`  ✓ Deleted ${deleted} decision instance(s)`);
    return deleted;
  } catch {
    console.log('  No decision instances found');
    return 0;
  }
}

/**
 * Clear all jobs
 * @returns {Promise<number>} - Number of deleted jobs
 */
async function deleteJobs() {
  console.log('');
  console.log('Deleting jobs...');

  try {
    const response = await api.get('/job', { params: { maxResults: 1000 } });
    const jobs = response.data;

    if (jobs.length === 0) {
      console.log('  No jobs found');
      return 0;
    }

    console.log(`  Found ${jobs.length} job(s)`);

    let deleted = 0;
    for (const job of jobs) {
      try {
        await api.delete(`/job/${job.id}`);
        deleted++;
      } catch {
        // Some jobs can't be deleted directly
      }
    }

    console.log(`  ✓ Deleted ${deleted} job(s)`);
    return deleted;
  } catch {
    console.log('  No jobs found');
    return 0;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('═'.repeat(60));
  console.log('  Operaton Environment Reset');
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

  // Test connection
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

  // Determine what to delete
  const deleteAll = !instancesOnly && !deploymentsOnly && !usersOnly && !historyOnly;

  // Build confirmation message
  let confirmMessage = 'This will delete ';
  if (deleteAll) {
    confirmMessage += 'ALL data from Operaton';
  } else {
    const parts = [];
    if (instancesOnly) parts.push('process instances');
    if (deploymentsOnly) parts.push('deployments');
    if (usersOnly) parts.push('users and groups');
    if (historyOnly) parts.push('history data');
    confirmMessage += parts.join(', ');
  }
  confirmMessage += '. Continue?';

  if (!forceMode) {
    console.log('');
    console.log('⚠ WARNING: This action cannot be undone!');
    console.log('');
  }

  if (!(await confirm(confirmMessage))) {
    console.log('');
    console.log('Aborted.');
    process.exit(0);
  }

  const stats = {
    instances: 0,
    historicInstances: 0,
    deployments: 0,
    users: 0,
    groups: 0,
    batches: 0,
    historicBatches: 0,
    jobs: 0,
    decisions: 0,
  };

  // Execute deletions based on flags
  if (deleteAll || instancesOnly) {
    stats.jobs = await deleteJobs();
    stats.instances = await deleteProcessInstances();
  }

  if (deleteAll || historyOnly) {
    stats.historicInstances = await deleteHistoricInstances();
    stats.decisions = await deleteDecisionInstances();
    stats.historicBatches = await deleteHistoricBatches();
  }

  if (deleteAll) {
    stats.batches = await deleteBatches();
  }

  if (deleteAll || deploymentsOnly) {
    // Need to delete instances first before deployments
    if (!instancesOnly && !deleteAll) {
      await deleteJobs();
      await deleteProcessInstances();
      await deleteHistoricInstances();
    }
    stats.deployments = await deleteDeployments();
  }

  if (deleteAll || usersOnly) {
    stats.users = await deleteUsers();
    stats.groups = await deleteGroups();
  }

  // Print summary
  console.log('');
  console.log('═'.repeat(60));
  console.log('  Reset Summary');
  console.log('═'.repeat(60));
  console.log(`  Process instances:   ${stats.instances}`);
  console.log(`  Historic instances:  ${stats.historicInstances}`);
  console.log(`  Decision instances:  ${stats.decisions}`);
  console.log(`  Deployments:         ${stats.deployments}`);
  console.log(`  Jobs:                ${stats.jobs}`);
  console.log(`  Batches:             ${stats.batches}`);
  console.log(`  Historic batches:    ${stats.historicBatches}`);
  console.log(`  Users:               ${stats.users}`);
  console.log(`  Groups:              ${stats.groups}`);
  console.log('═'.repeat(60));

  console.log('');
  console.log('✓ Environment reset complete');
  console.log('');
  console.log('To start fresh, run:');
  console.log('  make deploy     # Deploy processes');
  console.log('  make data       # Generate test data');
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  if (process.env.DEBUG === 'true') {
    console.error(err.stack);
  }
  process.exit(1);
});
