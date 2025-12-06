#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Show current status of Operaton environment
 */

import 'dotenv/config';
import axios from 'axios';

const config = {
  baseUrl: process.env.OPERATON_REST_URL || 'https://operaton-doc.open-regels.nl/engine-rest',
  webUrl: process.env.OPERATON_BASE_URL || 'https://operaton-doc.open-regels.nl',
  username: process.env.OPERATON_USERNAME || 'demo',
  password: process.env.OPERATON_PASSWORD || 'demo',
};

const api = axios.create({
  baseURL: config.baseUrl,
  auth: {
    username: config.username,
    password: config.password,
  },
  timeout: 10000,
});

/**
 * Handle and display error information with actionable guidance
 * @param {Error} error - The error object from axios
 * @returns {string} - Error description for display
 */
function getErrorMessage(error) {
  if (error.response) {
    const { status } = error.response;
    switch (status) {
      case 400:
        return 'Bad request';
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
      case 504:
        return 'Gateway timeout';
      default:
        return `HTTP ${status}`;
    }
  } else if (error.code) {
    switch (error.code) {
      case 'ECONNREFUSED':
        return 'Connection refused';
      case 'ENOTFOUND':
        return 'Host not found';
      case 'ECONNRESET':
        return 'Connection reset';
      case 'ETIMEDOUT':
        return 'Connection timed out';
      case 'ECONNABORTED':
        return 'Request aborted';
      default:
        return error.code;
    }
  }
  return error.message;
}

/**
 * Get count from an endpoint
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<number|string>} - Count or error indicator
 */
async function getCount(endpoint, params = {}) {
  try {
    const response = await api.get(`${endpoint}/count`, { params });
    return response.data.count;
  } catch (error) {
    if (process.env.DEBUG === 'true') {
      console.error(`    [DEBUG] ${endpoint}/count failed: ${getErrorMessage(error)}`);
    }
    return '?';
  }
}

/**
 * Format a number with padding for alignment
 * @param {number|string} value - Value to format
 * @param {number} width - Minimum width
 * @returns {string} - Formatted value
 */
function formatValue(value, width = 6) {
  const str = String(value);
  return str.padStart(width);
}

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

async function main() {
  console.log('═'.repeat(50));
  console.log('  Operaton Environment Status');
  console.log('═'.repeat(50));
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

  // Check connection first
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
  console.log('');

  // Gather all stats in parallel for better performance
  const [
    deployments,
    processDefinitions,
    decisionDefinitions,
    caseDefinitions,
    runningInstances,
    historicInstances,
    tasks,
    incidents,
    jobs,
    failedJobs,
    users,
    groups,
    externalTasks,
  ] = await Promise.all([
    getCount('/deployment'),
    getCount('/process-definition'),
    getCount('/decision-definition'),
    getCount('/case-definition'),
    getCount('/process-instance'),
    getCount('/history/process-instance'),
    getCount('/task'),
    getCount('/incident'),
    getCount('/job'),
    getCount('/job', { withException: true }),
    getCount('/user'),
    getCount('/group'),
    getCount('/external-task'),
  ]);

  // Display stats
  console.log('─'.repeat(50));
  console.log('  Deployments');
  console.log('─'.repeat(50));
  console.log(`  Deployments:           ${formatValue(deployments)}`);
  console.log(`  Process definitions:   ${formatValue(processDefinitions)}`);
  console.log(`  Decision definitions:  ${formatValue(decisionDefinitions)}`);
  console.log(`  Case definitions:      ${formatValue(caseDefinitions)}`);
  console.log('');

  console.log('─'.repeat(50));
  console.log('  Runtime');
  console.log('─'.repeat(50));
  console.log(`  Running instances:     ${formatValue(runningInstances)}`);
  console.log(`  Tasks:                 ${formatValue(tasks)}`);
  console.log(`  External tasks:        ${formatValue(externalTasks)}`);
  console.log(`  Jobs:                  ${formatValue(jobs)}`);
  console.log(`  Failed jobs:           ${formatValue(failedJobs)}`);
  console.log(`  Incidents:             ${formatValue(incidents)}`);
  console.log('');

  console.log('─'.repeat(50));
  console.log('  History');
  console.log('─'.repeat(50));
  console.log(`  Historic instances:    ${formatValue(historicInstances)}`);
  console.log('');

  console.log('─'.repeat(50));
  console.log('  Identity');
  console.log('─'.repeat(50));
  console.log(`  Users:                 ${formatValue(users)}`);
  console.log(`  Groups:                ${formatValue(groups)}`);
  console.log('');

  // Show warnings if there are issues
  const warnings = [];
  if (incidents !== '?' && incidents > 0) {
    warnings.push(`⚠ ${incidents} incident(s) detected - run "make list-incidents" for details`);
  }
  if (failedJobs !== '?' && failedJobs > 0) {
    warnings.push(`⚠ ${failedJobs} failed job(s) detected`);
  }

  if (warnings.length > 0) {
    console.log('─'.repeat(50));
    console.log('  Warnings');
    console.log('─'.repeat(50));
    for (const warning of warnings) {
      console.log(`  ${warning}`);
    }
    console.log('');
  }

  console.log('═'.repeat(50));
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  if (process.env.DEBUG === 'true') {
    console.error(err.stack);
  }
  process.exit(1);
});
