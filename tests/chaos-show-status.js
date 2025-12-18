#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Chaos tests for show-status.js
 * Tests error handling for various failure scenarios
 */

import 'dotenv/config';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

/**
 * Run show-status.js with custom environment variables
 * @param {Object} envOverrides - Environment variables to override
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
 */
function runShowStatus(envOverrides = {}, timeout = 30000) {
  return new Promise(resolve => {
    const env = {
      ...process.env,
      ...envOverrides,
    };

    const child = spawn('node', [join(__dirname, '..', 'scripts', 'show-status.js')], {
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

  const result = await runShowStatus(envOverrides, expectations.timeout || 15000);

  const checks = [];

  if (expectations.exitCode !== undefined) {
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
      const passed = result.stdout.includes(expected);
      checks.push({
        name: `stdout contains "${expected.substring(0, 50)}..."`,
        passed,
        expected: true,
        actual: passed,
      });
    }
  }

  if (expectations.stdoutNotContains) {
    for (const notExpected of expectations.stdoutNotContains) {
      const passed = !result.stdout.includes(notExpected);
      checks.push({
        name: `stdout not contains "${notExpected.substring(0, 50)}..."`,
        passed,
        expected: true,
        actual: passed,
      });
    }
  }

  const allPassed = checks.every(c => c.passed);

  if (allPassed) {
    console.log('✓ PASSED');
    results.passed++;
  } else {
    console.log('✗ FAILED');
    results.failed++;
    for (const check of checks.filter(c => !c.passed)) {
      console.log(`    - ${check.name}: expected ${check.expected}, got ${check.actual}`);
    }
    if (process.env.DEBUG === 'true') {
      console.log('    STDOUT:', result.stdout.substring(0, 500));
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
  console.log('═'.repeat(60));
  console.log('  Chaos Tests for show-status.js');
  console.log('═'.repeat(60));
  console.log('');

  // ============================================================
  // SECTION 1: Connection Failure Tests
  // ============================================================
  console.log('Section 1: Connection Failure Tests');
  console.log('─'.repeat(40));

  await test(
    'Non-existent host',
    {
      OPERATON_REST_URL: 'https://this-host-does-not-exist-12345.invalid/engine-rest',
    },
    {
      exitCode: 1,
      stdoutContains: ['Cannot connect to Operaton'],
      timeout: 20000,
    }
  );

  await test(
    'Connection refused (wrong port)',
    {
      OPERATON_REST_URL: 'http://localhost:59999/engine-rest',
    },
    {
      exitCode: 1,
      stdoutContains: ['Cannot connect to Operaton', 'Connection refused'],
      timeout: 15000,
    }
  );

  await test(
    'Invalid URL format',
    {
      OPERATON_REST_URL: 'not-a-valid-url',
    },
    {
      exitCode: 1,
      stdoutContains: ['Cannot connect to Operaton'],
      timeout: 10000,
    }
  );

  await test(
    'Wrong path (404)',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/wrong-path',
    },
    {
      exitCode: 1,
      stdoutContains: ['Cannot connect to Operaton'],
      timeout: 15000,
    }
  );

  console.log('');

  // ============================================================
  // SECTION 2: Debug Mode Tests
  // ============================================================
  console.log('Section 2: Debug Mode Tests');
  console.log('─'.repeat(40));

  await test(
    'Debug mode shows configuration',
    {
      DEBUG: 'true',
      OPERATON_REST_URL: 'http://localhost:59999/engine-rest',
      OPERATON_BASE_URL: 'http://localhost:59999',
    },
    {
      exitCode: 1,
      stdoutContains: ['Configuration:', 'REST URL:', 'Web URL:', 'Username:', 'Password: ****'],
      timeout: 15000,
    }
  );

  await test(
    'Debug mode shows error details',
    {
      DEBUG: 'true',
      OPERATON_REST_URL: 'http://localhost:59999/engine-rest',
    },
    {
      exitCode: 1,
      stdoutContains: ['Connection refused'],
      timeout: 15000,
    }
  );

  console.log('');

  // ============================================================
  // SECTION 3: Successful Connection Tests
  // ============================================================
  console.log('Section 3: Successful Connection Tests');
  console.log('─'.repeat(40));

  await test(
    'Valid connection shows all sections',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
      OPERATON_USERNAME: 'demo',
      OPERATON_PASSWORD: 'demo',
    },
    {
      exitCode: 0,
      stdoutContains: [
        'Operaton Environment Status',
        'Connected to engine',
        'Deployments',
        'Runtime',
        'History',
        'Identity',
      ],
      timeout: 20000,
    }
  );

  await test(
    'Shows deployment counts',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
      OPERATON_USERNAME: 'demo',
      OPERATON_PASSWORD: 'demo',
    },
    {
      exitCode: 0,
      stdoutContains: ['Process definitions:', 'Decision definitions:'],
      timeout: 20000,
    }
  );

  await test(
    'Shows runtime stats',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
      OPERATON_USERNAME: 'demo',
      OPERATON_PASSWORD: 'demo',
    },
    {
      exitCode: 0,
      stdoutContains: ['Running instances:', 'Tasks:', 'Jobs:', 'Incidents:'],
      timeout: 20000,
    }
  );

  await test(
    'Shows identity stats',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
      OPERATON_USERNAME: 'demo',
      OPERATON_PASSWORD: 'demo',
    },
    {
      exitCode: 0,
      stdoutContains: ['Users:', 'Groups:'],
      timeout: 20000,
    }
  );

  await test(
    'Empty URL falls back to defaults',
    {
      OPERATON_REST_URL: '',
    },
    {
      exitCode: 0,
      stdoutContains: ['Connected to engine'],
      timeout: 20000,
    }
  );

  console.log('');

  // ============================================================
  // SECTION 4: Output Format Tests
  // ============================================================
  console.log('Section 4: Output Format Tests');
  console.log('─'.repeat(40));

  await test(
    'Output includes header',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
    },
    {
      exitCode: 0,
      stdoutContains: ['═', 'Operaton Environment Status'],
      timeout: 20000,
    }
  );

  await test(
    'Output includes troubleshooting on failure',
    {
      OPERATON_REST_URL: 'http://localhost:59999/engine-rest',
    },
    {
      exitCode: 1,
      stdoutContains: ['Troubleshooting:', 'make check'],
      timeout: 15000,
    }
  );

  console.log('');

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('═'.repeat(60));
  console.log('  Test Summary');
  console.log('═'.repeat(60));
  console.log(`  Total:  ${results.passed + results.failed}`);
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);
  console.log('═'.repeat(60));

  if (results.failed > 0) {
    console.log('\nFailed tests:');
    for (const test of results.tests.filter(t => !t.passed)) {
      console.log(`  - ${test.name}`);
    }
    process.exit(1);
  } else {
    console.log('\n✓ All chaos tests passed!');
    process.exit(0);
  }
}

runChaosTests().catch(err => {
  console.error('Chaos test runner failed:', err);
  process.exit(1);
});
