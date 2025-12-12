#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Chaos tests for capture-screenshots.js
 * Tests error handling for various failure scenarios
 */

import 'dotenv/config';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

// Test fixtures directory
const FIXTURES_DIR = join(__dirname, 'fixtures');

/**
 * Create test fixtures
 */
async function createFixtures() {
  await fs.mkdir(FIXTURES_DIR, { recursive: true });

  // Valid minimal config
  await fs.writeFile(
    join(FIXTURES_DIR, 'valid-config.json'),
    JSON.stringify({
      version: '1.0.0',
      categories: {
        cockpit: {
          description: 'Cockpit',
          baseUrl: '/operaton/app/cockpit/default',
        },
      },
      screenshots: [
        {
          id: 'test-dashboard',
          category: 'cockpit',
          description: 'Test dashboard',
          path: '#/dashboard',
          outputFile: 'test/dashboard.png',
        },
      ],
      users: [],
      groups: [],
    })
  );

  // Empty screenshots config
  await fs.writeFile(
    join(FIXTURES_DIR, 'empty-screenshots.json'),
    JSON.stringify({
      version: '1.0.0',
      categories: {
        cockpit: {
          baseUrl: '/operaton/app/cockpit/default',
        },
      },
      screenshots: [],
      users: [],
      groups: [],
    })
  );

  // Invalid JSON
  await fs.writeFile(join(FIXTURES_DIR, 'invalid.json'), '{ not valid json }');
}

/**
 * Clean up test fixtures
 */
async function cleanupFixtures() {
  try {
    await fs.rm(FIXTURES_DIR, { recursive: true });
  } catch {
    // Ignore errors
  }
}

/**
 * Run capture-screenshots.js with custom environment
 */
function runCaptureScreenshots(envOverrides = {}, timeout = 60000) {
  return new Promise(resolve => {
    const env = {
      ...process.env,
      OPERATON_BASE_URL: '',
      OPERATON_REST_URL: '',
      ...envOverrides,
    };

    const child = spawn('node', [join(__dirname, '..', 'scripts', 'capture-screenshots.js')], {
      env,
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
    });

    child.stderr.on('data', data => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 1000);
      resolve({ exitCode: -1, stdout, stderr: `${stderr}\nTest timed out` });
    }, timeout);

    child.on('close', code => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });

    child.on('error', err => {
      clearTimeout(timer);
      resolve({ exitCode: -1, stdout, stderr: err.message });
    });
  });
}

/**
 * Test helper function
 */
async function test(name, envOverrides, expectations) {
  process.stdout.write(`  Testing: ${name}... `);

  const result = await runCaptureScreenshots(envOverrides, expectations.timeout || 60000);

  const checks = [];

  if (expectations.exitCode !== undefined && expectations.exitCode !== null) {
    const passed = result.exitCode === expectations.exitCode;
    checks.push({
      name: 'exit code',
      passed,
      expected: expectations.exitCode,
      actual: result.exitCode,
    });
  }

  if (expectations.stdoutContains) {
    for (const expected of expectations.stdoutContains) {
      // Check both stdout and stderr for the message
      const found = result.stdout.includes(expected) || result.stderr.includes(expected);
      checks.push({
        name: `output contains "${expected.substring(0, 40)}..."`,
        passed: found,
        expected: true,
        actual: found,
      });
    }
  }

  if (expectations.stdoutNotContains) {
    for (const notExpected of expectations.stdoutNotContains) {
      const passed = !result.stdout.includes(notExpected);
      checks.push({
        name: `stdout not contains "${notExpected.substring(0, 40)}..."`,
        passed,
        expected: true,
        actual: passed,
      });
    }
  }

  const allPassed = checks.every(c => c.passed);

  if (allPassed) {
    console.log('PASSED');
    results.passed++;
  } else {
    console.log('FAILED');
    results.failed++;
    for (const check of checks.filter(c => !c.passed)) {
      console.log(`    - ${check.name}: expected ${check.expected}, got ${check.actual}`);
    }
    if (process.env.DEBUG === 'true') {
      console.log('    STDOUT:', result.stdout.substring(0, 800));
      console.log('    STDERR:', result.stderr.substring(0, 500));
    }
  }

  results.tests.push({
    name,
    passed: allPassed,
    checks,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  });

  return allPassed;
}

async function runChaosTests() {
  console.log('='.repeat(60));
  console.log('  Chaos Tests for capture-screenshots.js');
  console.log('='.repeat(60));
  console.log('');

  // Create test fixtures
  await createFixtures();

  try {
    // ============================================================
    // SECTION 1: Configuration Tests
    // ============================================================
    console.log('Section 1: Configuration Tests');
    console.log('-'.repeat(40));

    await test(
      'Missing config file',
      {
        CONFIG_PATH: '/nonexistent/path/config.json',
        OPERATON_BASE_URL: 'http://localhost:8080',
      },
      {
        exitCode: 1,
        stdoutContains: ['Failed to load config'],
        timeout: 15000,
      }
    );

    await test(
      'Invalid JSON config',
      {
        CONFIG_PATH: join(FIXTURES_DIR, 'invalid.json'),
        OPERATON_BASE_URL: 'http://localhost:8080',
      },
      {
        exitCode: 1,
        stdoutContains: ['Failed to load config'],
        timeout: 15000,
      }
    );

    await test(
      'Empty screenshots array completes successfully',
      {
        CONFIG_PATH: join(FIXTURES_DIR, 'empty-screenshots.json'),
        OPERATON_BASE_URL: 'https://operaton-doc.open-regels.nl',
        OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
      },
      {
        exitCode: 0,
        stdoutContains: ['Captured: 0', 'Capture Summary'],
        timeout: 30000,
      }
    );

    console.log('');

    // ============================================================
    // SECTION 2: Debug Mode Tests
    // ============================================================
    console.log('Section 2: Debug Mode Tests');
    console.log('-'.repeat(40));

    await test(
      'Debug mode shows configuration',
      {
        DEBUG: 'true',
        CONFIG_PATH: join(FIXTURES_DIR, 'empty-screenshots.json'),
        OPERATON_BASE_URL: 'https://operaton-doc.open-regels.nl',
        OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
      },
      {
        exitCode: 0,
        stdoutContains: ['Configuration:', 'Base URL:', 'REST URL:', 'Username:'],
        timeout: 30000,
      }
    );

    console.log('');

    // ============================================================
    // SECTION 3: Connection Tests
    // ============================================================
    console.log('Section 3: Connection Tests');
    console.log('-'.repeat(40));

    await test(
      'Successful connection fetches dynamic data',
      {
        CONFIG_PATH: join(FIXTURES_DIR, 'empty-screenshots.json'),
        OPERATON_BASE_URL: 'https://operaton-doc.open-regels.nl',
        OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
      },
      {
        exitCode: 0,
        stdoutContains: ['Fetching dynamic data', 'Process instances:'],
        timeout: 30000,
      }
    );

    console.log('');

    // ============================================================
    // SECTION 4: Output Format Tests
    // ============================================================
    console.log('Section 4: Output Format Tests');
    console.log('-'.repeat(40));

    await test(
      'Output includes header and summary',
      {
        CONFIG_PATH: join(FIXTURES_DIR, 'empty-screenshots.json'),
        OPERATON_BASE_URL: 'https://operaton-doc.open-regels.nl',
        OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
      },
      {
        exitCode: 0,
        stdoutContains: ['Operaton Screenshot Capture', 'Capture Summary', 'Screenshots saved to:'],
        timeout: 30000,
      }
    );

    await test(
      'Shows target and output directory',
      {
        CONFIG_PATH: join(FIXTURES_DIR, 'empty-screenshots.json'),
        OPERATON_BASE_URL: 'https://operaton-doc.open-regels.nl',
        OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
        OUTPUT_DIR: '/custom/output/path',
      },
      {
        exitCode: 0,
        stdoutContains: [
          'Target: https://operaton-doc.open-regels.nl',
          'Output: /custom/output/path',
        ],
        timeout: 30000,
      }
    );

    console.log('');
  } finally {
    // Clean up fixtures
    await cleanupFixtures();
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('='.repeat(60));
  console.log('  Test Summary');
  console.log('='.repeat(60));
  console.log(`  Total:  ${results.passed + results.failed}`);
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);
  console.log('='.repeat(60));

  if (results.failed > 0) {
    console.log('\nFailed tests:');
    for (const failedTest of results.tests.filter(t => !t.passed)) {
      console.log(`  - ${failedTest.name}`);
    }
    process.exit(1);
  } else {
    console.log('\n+ All chaos tests passed!');
    process.exit(0);
  }
}

runChaosTests().catch(err => {
  console.error('Chaos test runner failed:', err);
  process.exit(1);
});
