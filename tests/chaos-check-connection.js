#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Chaos tests for check-connection.js
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
 * Run check-connection.js with custom environment variables
 * @param {Object} envOverrides - Environment variables to override
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
 */
function runCheckConnection(envOverrides = {}, timeout = 30000) {
  return new Promise(resolve => {
    const env = {
      ...process.env,
      ...envOverrides,
    };

    // Note: spawn() doesn't support timeout option directly
    // We handle timeout manually with setTimeout
    const child = spawn('node', [join(__dirname, '..', 'scripts', 'check-connection.js')], {
      env,
      shell: process.platform === 'win32', // Use shell on Windows for better compatibility
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
      // On Windows, SIGTERM might not work, try SIGKILL
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

  const result = await runCheckConnection(envOverrides, expectations.timeout || 15000);

  const checks = [];

  // Check exit code
  if (expectations.exitCode !== undefined) {
    const passed = result.exitCode === expectations.exitCode;
    checks.push({
      name: 'exit code',
      passed,
      expected: expectations.exitCode,
      actual: result.exitCode,
    });
  }

  // Check stdout contains expected strings
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

  // Check stdout does NOT contain certain strings
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
  console.log('  Chaos Tests for check-connection.js');
  console.log('═'.repeat(60));
  console.log('');

  // ============================================================
  // SECTION 1: Invalid URL Tests
  // ============================================================
  console.log('Section 1: Invalid URL Tests');
  console.log('─'.repeat(40));

  await test(
    'Non-existent host (ENOTFOUND)',
    {
      OPERATON_REST_URL: 'https://this-host-definitely-does-not-exist-12345.invalid/engine-rest',
      OPERATON_BASE_URL: 'https://this-host-definitely-does-not-exist-12345.invalid',
    },
    {
      exitCode: 1,
      stdoutContains: ['REST API not accessible'],
      timeout: 20000,
    }
  );

  await test(
    'Invalid URL format (malformed)',
    {
      OPERATON_REST_URL: 'not-a-valid-url',
      OPERATON_BASE_URL: 'also-not-valid',
    },
    {
      exitCode: 1,
      stdoutContains: ['REST API not accessible'],
      timeout: 10000,
    }
  );

  await test(
    'Wrong port (connection refused)',
    {
      OPERATON_REST_URL: 'http://localhost:59999/engine-rest',
      OPERATON_BASE_URL: 'http://localhost:59999',
    },
    {
      exitCode: 1,
      stdoutContains: ['REST API not accessible', 'ECONNREFUSED', 'Connection refused'],
      timeout: 15000,
    }
  );

  await test(
    'Wrong path (404)',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/wrong-path',
      OPERATON_BASE_URL: 'https://operaton-doc.open-regels.nl',
    },
    {
      exitCode: 1,
      stdoutContains: ['REST API not accessible'],
      timeout: 15000,
    }
  );

  // Note: Empty URL falls back to defaults in config, so it connects successfully
  // This tests that default fallback works correctly
  await test(
    'Empty URL (falls back to defaults)',
    {
      OPERATON_REST_URL: '',
      OPERATON_BASE_URL: '',
    },
    {
      exitCode: 0,
      stdoutContains: ['Connection successful'],
      timeout: 15000,
    }
  );

  console.log('');

  // ============================================================
  // SECTION 2: Network Edge Cases
  // ============================================================
  console.log('Section 2: Network Edge Cases');
  console.log('─'.repeat(40));

  // Generate long URL using template literal to satisfy eslint
  const longPath = 'a'.repeat(2000);
  await test(
    'Very long URL',
    {
      OPERATON_REST_URL: `https://operaton-doc.open-regels.nl/${longPath}`,
      OPERATON_BASE_URL: 'https://operaton-doc.open-regels.nl',
    },
    {
      exitCode: 1,
      stdoutContains: ['REST API not accessible'],
      timeout: 15000,
    }
  );

  await test(
    'URL with spaces (should fail)',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine rest',
      OPERATON_BASE_URL: 'https://operaton-doc.open-regels.nl',
    },
    {
      exitCode: 1,
      stdoutContains: ['REST API not accessible'],
      timeout: 10000,
    }
  );

  await test(
    'URL with query parameters',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest?foo=bar&baz=qux',
      OPERATON_BASE_URL: 'https://operaton-doc.open-regels.nl',
    },
    {
      exitCode: 1,
      stdoutContains: ['REST API not accessible'],
      timeout: 15000,
    }
  );

  await test(
    'IPv4 localhost (connection refused)',
    {
      OPERATON_REST_URL: 'http://127.0.0.1:8080/engine-rest',
      OPERATON_BASE_URL: 'http://127.0.0.1:8080',
    },
    {
      exitCode: 1,
      stdoutContains: ['REST API not accessible', 'ECONNREFUSED'],
      timeout: 15000,
    }
  );

  await test(
    'Trailing slash in URL',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest/',
      OPERATON_BASE_URL: 'https://operaton-doc.open-regels.nl/',
    },
    {
      exitCode: 1,
      stdoutContains: ['REST API not accessible'],
      timeout: 15000,
    }
  );

  await test(
    'Double slash in URL',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl//engine-rest',
      OPERATON_BASE_URL: 'https://operaton-doc.open-regels.nl',
    },
    {
      exitCode: 1,
      stdoutContains: ['REST API not accessible'],
      timeout: 15000,
    }
  );

  console.log('');

  // ============================================================
  // SECTION 3: Debug Mode Tests
  // ============================================================
  console.log('Section 3: Debug Mode Tests');
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
      stdoutContains: ['Configuration:', 'REST URL:', 'Username:', 'Password: ****'],
      timeout: 15000,
    }
  );

  await test(
    'Debug mode shows error code',
    {
      DEBUG: 'true',
      OPERATON_REST_URL: 'http://localhost:59999/engine-rest',
      OPERATON_BASE_URL: 'http://localhost:59999',
    },
    {
      exitCode: 1,
      stdoutContains: ['Code: ECONNREFUSED'],
      timeout: 15000,
    }
  );

  console.log('');

  // ============================================================
  // SECTION 4: Successful Connection Tests
  // ============================================================
  console.log('Section 4: Successful Connection Tests');
  console.log('─'.repeat(40));

  // Note: The Operaton demo instance accepts connections without strict auth
  // These tests verify the happy path works correctly
  await test(
    'Valid connection with correct credentials',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
      OPERATON_BASE_URL: 'https://operaton-doc.open-regels.nl',
      OPERATON_USERNAME: 'demo',
      OPERATON_PASSWORD: 'demo',
    },
    {
      exitCode: 0,
      stdoutContains: ['REST API accessible', 'Connection successful'],
      timeout: 15000,
    }
  );

  await test(
    'HTTP redirects to HTTPS (server handles redirect)',
    {
      OPERATON_REST_URL: 'http://operaton-doc.open-regels.nl/engine-rest',
      OPERATON_BASE_URL: 'http://operaton-doc.open-regels.nl',
      OPERATON_USERNAME: 'demo',
      OPERATON_PASSWORD: 'demo',
    },
    {
      exitCode: 0,
      stdoutContains: ['Connection successful'],
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

// Run the tests
runChaosTests().catch(err => {
  console.error('Chaos test runner failed:', err);
  process.exit(1);
});
