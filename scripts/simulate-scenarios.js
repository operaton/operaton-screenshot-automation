#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Simulate various process scenarios for screenshot capture
 *
 * Creates:
 * - Process instances with tokens at specific activities
 * - Completed instances for history views
 * - Tasks in various states (assigned, unassigned, overdue)
 */

import 'dotenv/config';
import axios from 'axios';

// Configuration
const config = {
  baseUrl: process.env.OPERATON_REST_URL || 'https://operaton-doc.open-regels.nl/engine-rest',
  webUrl: process.env.OPERATON_BASE_URL || 'https://operaton-doc.open-regels.nl',
  username: process.env.OPERATON_USERNAME || 'demo',
  password: process.env.OPERATON_PASSWORD || 'demo',
};

// Parse command line arguments
const args = process.argv.slice(2);
const runTokens = args.includes('--tokens') || args.length === 0;
const runHistory = args.includes('--history') || args.length === 0;
const runTasks = args.includes('--tasks') || args.length === 0;

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
      const truncated = message.length > 150 ? `${message.substring(0, 150)}...` : message;
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

// Statistics tracking
const stats = {
  tokens: { created: 0, failed: 0 },
  history: { completed: 0, failed: 0 },
  tasks: { created: 0, overdue: 0, followUp: 0, failed: 0 },
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
 * Start a process instance
 * @param {string} processKey - Process definition key
 * @param {Object} variables - Process variables
 * @param {string} businessKey - Business key
 * @returns {Promise<Object|null>}
 */
async function startProcess(processKey, variables = {}, businessKey = null) {
  try {
    const payload = {
      variables: Object.fromEntries(
        Object.entries(variables).map(([key, value]) => {
          let type = 'String';
          if (typeof value === 'number') type = Number.isInteger(value) ? 'Integer' : 'Double';
          if (typeof value === 'boolean') type = 'Boolean';
          return [key, { value, type }];
        })
      ),
    };

    if (businessKey) {
      payload.businessKey = businessKey;
    }

    const response = await api.post(`/process-definition/key/${processKey}/start`, payload);
    debug(`Started ${processKey}: ${response.data.id}`);
    return response.data;
  } catch (error) {
    debug(`Failed to start ${processKey}: ${getErrorMessage(error)}`);
    return null;
  }
}

/**
 * Get tasks for a process instance
 * @param {string} processInstanceId - Process instance ID
 * @returns {Promise<Array>}
 */
async function getTasksForInstance(processInstanceId) {
  try {
    const response = await api.get('/task', {
      params: { processInstanceId },
    });
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
        Object.entries(variables).map(([key, value]) => {
          let type = 'String';
          if (typeof value === 'boolean') type = 'Boolean';
          if (typeof value === 'number') type = Number.isInteger(value) ? 'Integer' : 'Double';
          return [key, { value, type }];
        })
      ),
    });
    debug(`Completed task ${taskId}`);
    return true;
  } catch (error) {
    debug(`Failed to complete task ${taskId}: ${getErrorMessage(error)}`);
    return false;
  }
}

/**
 * Set task due date
 * @param {string} taskId - Task ID
 * @param {string} dueDate - Due date (ISO string)
 * @returns {Promise<boolean>}
 */
async function setTaskDueDate(taskId, dueDate) {
  try {
    await api.put(`/task/${taskId}`, { dueDate });
    debug(`Set due date for task ${taskId}`);
    return true;
  } catch (error) {
    debug(`Failed to set due date: ${getErrorMessage(error)}`);
    return false;
  }
}

/**
 * Set task follow-up date
 * @param {string} taskId - Task ID
 * @param {string} followUp - Follow-up date (ISO string)
 * @returns {Promise<boolean>}
 */
async function setTaskFollowUp(taskId, followUp) {
  try {
    await api.put(`/task/${taskId}`, { followUp });
    debug(`Set follow-up for task ${taskId}`);
    return true;
  } catch (error) {
    debug(`Failed to set follow-up: ${getErrorMessage(error)}`);
    return false;
  }
}

/**
 * Get activity instances for a process
 * @param {string} processInstanceId - Process instance ID
 * @returns {Promise<Object|null>}
 */
async function getActivityInstances(processInstanceId) {
  try {
    const response = await api.get(`/process-instance/${processInstanceId}/activity-instances`);
    return response.data;
  } catch (error) {
    debug(`Failed to get activity instances: ${getErrorMessage(error)}`);
    return null;
  }
}

/**
 * Recursively find active activities
 * @param {Object} activityInstance - Activity instance tree
 * @param {Array} result - Result array
 * @returns {Array}
 */
function findActiveActivities(activityInstance, result = []) {
  if (
    activityInstance.activityType &&
    activityInstance.activityType !== 'processDefinition' &&
    activityInstance.childActivityInstances?.length === 0
  ) {
    result.push(activityInstance.activityName || activityInstance.activityId);
  }

  for (const child of activityInstance.childActivityInstances || []) {
    findActiveActivities(child, result);
  }

  return result;
}

// ============================================================================
// SCENARIO: Token Positions
// ============================================================================

async function simulateTokenPositions(invoiceProcess) {
  console.log('');
  console.log('─'.repeat(50));
  console.log('  Simulating Token Positions');
  console.log('─'.repeat(50));

  if (!invoiceProcess) {
    console.log('  ⚠ Invoice process not found. Deploy processes first.');
    return;
  }

  const scenarios = [
    {
      name: 'Token at Approve Invoice',
      variables: {
        amount: 500,
        invoiceCategory: 'Travel Expenses',
        creditor: 'Token Demo 1',
        invoiceNumber: 'TOK-001',
        approver: 'john',
      },
      businessKey: 'TOKEN-APPROVE-001',
    },
    {
      name: 'Token at Review Invoice',
      variables: {
        amount: 500,
        invoiceCategory: 'Travel Expenses',
        creditor: 'Token Demo 2',
        invoiceNumber: 'TOK-002',
        approver: 'mary',
      },
      businessKey: 'TOKEN-REVIEW-001',
      completeFirst: { approved: false },
    },
    {
      name: 'Token at Prepare Bank Transfer',
      variables: {
        amount: 500,
        invoiceCategory: 'Travel Expenses',
        creditor: 'Token Demo 3',
        invoiceNumber: 'TOK-003',
        approver: 'peter',
      },
      businessKey: 'TOKEN-BANK-001',
      completeFirst: { approved: true },
    },
  ];

  for (const scenario of scenarios) {
    console.log(`  Creating: ${scenario.name}`);

    const instance = await startProcess('invoice', scenario.variables, scenario.businessKey);
    if (!instance) {
      console.log(`    ✗ Failed to start process`);
      stats.tokens.failed++;
      continue;
    }

    await delay(500);

    // If we need to complete tasks to reach a certain point
    if (scenario.completeFirst) {
      const tasks = await getTasksForInstance(instance.id);
      if (tasks.length > 0) {
        const completed = await completeTask(tasks[0].id, scenario.completeFirst);
        if (completed) {
          console.log(`    ✓ Completed task to advance token`);
        }
      }
    }

    // Verify token position
    await delay(300);
    const activities = await getActivityInstances(instance.id);
    if (activities) {
      const activeActivities = findActiveActivities(activities);
      console.log(`    ✓ Token at: ${activeActivities.join(', ') || 'unknown'}`);
      stats.tokens.created++;
    }
  }
}

// ============================================================================
// SCENARIO: History Data
// ============================================================================

async function simulateHistoryData(invoiceProcess) {
  console.log('');
  console.log('─'.repeat(50));
  console.log('  Generating History Data');
  console.log('─'.repeat(50));

  if (!invoiceProcess) {
    console.log('  ⚠ Invoice process not found.');
    return;
  }

  // Create a variety of completed instances
  const completionScenarios = [
    // Approved and paid invoices
    { amount: 100, approved: true, category: 'Misc', count: 3 },
    { amount: 500, approved: true, category: 'Travel Expenses', count: 2 },
    { amount: 1500, approved: true, category: 'Software License', count: 2 },

    // Rejected invoices (not clarified)
    { amount: 300, approved: false, clarified: false, category: 'Misc', count: 2 },

    // Clarified and then approved
    {
      amount: 400,
      approved: false,
      clarified: true,
      thenApproved: true,
      category: 'Travel Expenses',
      count: 1,
    },
  ];

  let instanceNum = 0;

  for (const scenario of completionScenarios) {
    for (let i = 0; i < scenario.count; i++) {
      instanceNum++;
      const variables = {
        amount: scenario.amount + Math.floor(Math.random() * 50),
        invoiceCategory: scenario.category,
        creditor: `History Vendor ${instanceNum}`,
        invoiceNumber: `HIST-${Date.now()}-${instanceNum}`,
        approver: 'demo',
      };

      console.log(`  Processing instance ${instanceNum}...`);
      const instance = await startProcess('invoice', variables, `HISTORY-${instanceNum}`);
      if (!instance) {
        stats.history.failed++;
        continue;
      }

      await delay(400);

      // Get and complete first task (Approve Invoice)
      let tasks = await getTasksForInstance(instance.id);
      if (tasks.length > 0) {
        await completeTask(tasks[0].id, { approved: scenario.approved });
        await delay(300);
      }

      // If not approved, handle review
      if (!scenario.approved) {
        tasks = await getTasksForInstance(instance.id);
        if (tasks.length > 0) {
          await completeTask(tasks[0].id, { clarified: scenario.clarified || false });
          await delay(300);

          // If clarified, complete the approval again
          if (scenario.clarified && scenario.thenApproved) {
            tasks = await getTasksForInstance(instance.id);
            if (tasks.length > 0) {
              await completeTask(tasks[0].id, { approved: true });
              await delay(300);
            }
          }
        }
      }

      // If approved path, complete bank transfer
      if (scenario.approved || (scenario.clarified && scenario.thenApproved)) {
        tasks = await getTasksForInstance(instance.id);
        if (tasks.length > 0) {
          await completeTask(tasks[0].id, {});
          await delay(300);
        }
      }

      stats.history.completed++;
    }
  }

  console.log(`  ✓ Created ${stats.history.completed} completed instances for history`);
}

// ============================================================================
// SCENARIO: Tasks in Various States
// ============================================================================

async function simulateTaskStates(invoiceProcess) {
  console.log('');
  console.log('─'.repeat(50));
  console.log('  Creating Tasks in Various States');
  console.log('─'.repeat(50));

  if (!invoiceProcess) {
    console.log('  ⚠ Invoice process not found.');
    return;
  }

  const taskScenarios = [
    // Unassigned tasks (for candidate groups)
    {
      name: 'Unassigned accounting task',
      variables: {
        amount: 600,
        invoiceCategory: 'Travel Expenses',
        creditor: 'Task Demo Unassigned',
        invoiceNumber: 'TASK-U-001',
        approver: 'john',
      },
      action: 'completeToBank', // Get to Prepare Bank Transfer (candidate group)
    },

    // Assigned tasks
    {
      name: 'Task assigned to demo',
      variables: {
        amount: 150,
        invoiceCategory: 'Misc',
        creditor: 'Task Demo Assigned',
        invoiceNumber: 'TASK-A-001',
        approver: 'demo',
      },
      action: 'none', // Stays at Approve Invoice assigned to demo
    },

    // Overdue task
    {
      name: 'Overdue task',
      variables: {
        amount: 200,
        invoiceCategory: 'Misc',
        creditor: 'Task Demo Overdue',
        invoiceNumber: 'TASK-O-001',
        approver: 'demo',
      },
      action: 'setOverdue',
    },

    // Task with follow-up date
    {
      name: 'Task with follow-up',
      variables: {
        amount: 250,
        invoiceCategory: 'Misc',
        creditor: 'Task Demo FollowUp',
        invoiceNumber: 'TASK-F-001',
        approver: 'demo',
      },
      action: 'setFollowUp',
    },

    // Multiple tasks for same user
    {
      name: 'Multiple tasks scenario 1',
      variables: {
        amount: 180,
        invoiceCategory: 'Misc',
        creditor: 'Multi Task 1',
        invoiceNumber: 'TASK-M-001',
        approver: 'mary',
      },
      action: 'none',
    },
    {
      name: 'Multiple tasks scenario 2',
      variables: {
        amount: 190,
        invoiceCategory: 'Misc',
        creditor: 'Multi Task 2',
        invoiceNumber: 'TASK-M-002',
        approver: 'mary',
      },
      action: 'none',
    },
  ];

  for (const scenario of taskScenarios) {
    console.log(`  Creating: ${scenario.name}`);

    const instance = await startProcess(
      'invoice',
      scenario.variables,
      scenario.variables.invoiceNumber
    );
    if (!instance) {
      console.log(`    ✗ Failed to start process`);
      stats.tasks.failed++;
      continue;
    }

    await delay(500);

    const tasks = await getTasksForInstance(instance.id);

    switch (scenario.action) {
      case 'completeToBank':
        // Complete approval to get to bank transfer task
        if (tasks.length > 0) {
          const completed = await completeTask(tasks[0].id, { approved: true });
          if (completed) {
            console.log(`    ✓ Advanced to Prepare Bank Transfer (unassigned)`);
            stats.tasks.created++;
          }
        }
        break;

      case 'setOverdue':
        if (tasks.length > 0) {
          // Set due date to yesterday
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const success = await setTaskDueDate(tasks[0].id, yesterday.toISOString());
          if (success) {
            console.log(`    ✓ Set task as overdue`);
            stats.tasks.overdue++;
            stats.tasks.created++;
          }
        }
        break;

      case 'setFollowUp':
        if (tasks.length > 0) {
          // Set follow-up date to tomorrow
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const success = await setTaskFollowUp(tasks[0].id, tomorrow.toISOString());
          if (success) {
            console.log(`    ✓ Set follow-up date`);
            stats.tasks.followUp++;
            stats.tasks.created++;
          }
        }
        break;

      default:
        console.log(`    ✓ Task created and waiting`);
        stats.tasks.created++;
    }
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('═'.repeat(60));
  console.log('  Operaton Simulation Scenarios');
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

  // Get process definitions
  const definitions = await getProcessDefinitions();
  const invoiceProcess = definitions.find(d => d.key === 'invoice');

  if (!invoiceProcess) {
    console.log('');
    console.log('⚠ Invoice process not found');
    console.log('');
    console.log('Run "make deploy" first to deploy processes.');
    process.exit(1);
  }

  console.log(`✓ Found invoice process: ${invoiceProcess.name}`);

  // Run requested scenarios
  if (runTokens) {
    await simulateTokenPositions(invoiceProcess);
  }

  if (runHistory) {
    await simulateHistoryData(invoiceProcess);
  }

  if (runTasks) {
    await simulateTaskStates(invoiceProcess);
  }

  // Print summary
  console.log('');
  console.log('═'.repeat(60));
  console.log('  Simulation Summary');
  console.log('═'.repeat(60));

  if (runTokens) {
    console.log(
      `  Token scenarios:   ${stats.tokens.created} created, ${stats.tokens.failed} failed`
    );
  }
  if (runHistory) {
    console.log(
      `  History instances: ${stats.history.completed} completed, ${stats.history.failed} failed`
    );
  }
  if (runTasks) {
    console.log(
      `  Task scenarios:    ${stats.tasks.created} created, ${stats.tasks.failed} failed`
    );
    if (stats.tasks.overdue > 0) {
      console.log(`    - Overdue tasks: ${stats.tasks.overdue}`);
    }
    if (stats.tasks.followUp > 0) {
      console.log(`    - Follow-up tasks: ${stats.tasks.followUp}`);
    }
  }

  console.log('═'.repeat(60));

  const totalFailures = stats.tokens.failed + stats.history.failed + stats.tasks.failed;

  if (totalFailures > 0) {
    console.log('');
    console.log(`⚠ Completed with ${totalFailures} failure(s)`);
  } else {
    console.log('');
    console.log('✓ Simulation complete');
  }

  console.log('');
  console.log('Your Operaton instance now has:');
  console.log('  - Process instances with tokens at various activities');
  console.log('  - Completed instances for history views');
  console.log('  - Tasks in various states (assigned, overdue, etc.)');
  console.log('');
  console.log('Next steps:');
  console.log('  make status     # Verify simulation data');
  console.log('  make capture    # Capture screenshots');
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  if (process.env.DEBUG === 'true') {
    console.error(err.stack);
  }
  process.exit(1);
});
