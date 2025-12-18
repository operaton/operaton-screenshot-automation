#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Chaos tests for create-incidents.js
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
 * Run create-incidents.js with custom environment
 */
function runCreateIncidents(envOverrides = {}, args = [], timeout = 60000) {
  return new Promise(resolve => {
    const env = {
      ...process.env,
      // Clear .env values that would interfere with tests
      OPERATON_REST_URL: '',
      OPERATON_BASE_URL: '',
      ...envOverrides,
    };

    const child = spawn(
      'node',
      [join(__dirname, '..', 'scripts', 'create-incidents.js'), ...args],
      {
        env,
        shell: process.platform === 'win32',
      }
    );

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
async function test(name, envOverrides, args, expectations) {
  process.stdout.write(`  Testing: ${name}... `);

  const result = await runCreateIncidents(envOverrides, args, expectations.timeout || 60000);

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
        name: `stdout contains "${expected.substring(0, 40)}..."`,
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
        name: `stdout not contains "${notExpected.substring(0, 40)}..."`,
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
  console.log('═'.repeat(60));
  console.log('  Chaos Tests for create-incidents.js');
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
    [],
    {
      exitCode: 1,
      stdoutContains: ['Cannot connect to Operaton', 'Troubleshooting'],
      timeout: 20000,
    }
  );

  await test(
    'Connection refused (wrong port)',
    {
      OPERATON_REST_URL: 'http://localhost:59999/engine-rest',
    },
    [],
    {
      exitCode: 1,
      stdoutContains: ['Cannot connect to Operaton', 'Connection refused'],
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
    [],
    {
      exitCode: 1,
      stdoutContains: ['Configuration:', 'REST URL:', 'Web URL:', 'Username:', 'Password: ****'],
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
    'Successful connection shows engine',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
    },
    [],
    {
      exitCode: 0,
      stdoutContains: ['Connected to engine', 'Incident Creation Summary'],
      timeout: 90000,
    }
  );

  await test(
    'Creates script task incidents',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
    },
    ['--script-errors'],
    {
      exitCode: 0,
      stdoutContains: ['Creating Script Task Incidents', 'Deployed: failing-script-process'],
      timeout: 60000,
    }
  );

  await test(
    'Creates external task incidents',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
    },
    ['--job-errors'],
    {
      exitCode: 0,
      stdoutContains: ['Creating External Task Incidents', 'external task'],
      timeout: 90000,
    }
  );

  console.log('');

  // ============================================================
  // SECTION 4: Flag Tests
  // ============================================================
  console.log('Section 4: Flag Tests');
  console.log('─'.repeat(40));

  await test(
    'Script-errors flag only creates script incidents',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
    },
    ['--script-errors'],
    {
      exitCode: 0,
      stdoutContains: ['Creating Script Task Incidents'],
      stdoutNotContains: ['Creating Service Task Incidents', 'Creating Expression Evaluation'],
      timeout: 60000,
    }
  );

  await test(
    'Expression-errors flag only creates expression incidents',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
    },
    ['--expression-errors'],
    {
      exitCode: 0,
      stdoutContains: ['Creating Expression Evaluation Incidents'],
      stdoutNotContains: ['Creating Script Task Incidents', 'Creating Service Task Incidents'],
      timeout: 60000,
    }
  );

  console.log('');

  // ============================================================
  // SECTION 5: Output Format Tests
  // ============================================================
  console.log('Section 5: Output Format Tests');
  console.log('─'.repeat(40));

  await test(
    'Output includes header',
    {
      OPERATON_REST_URL: 'http://localhost:59999/engine-rest',
    },
    [],
    {
      exitCode: 1,
      stdoutContains: ['═', 'Operaton Incident Creator'],
      timeout: 15000,
    }
  );

  await test(
    'Output includes summary',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
    },
    ['--script-errors'],
    {
      exitCode: 0,
      stdoutContains: [
        'Incident Creation Summary',
        'Deployments:',
        'Instances:',
        'Total incidents:',
      ],
      timeout: 60000,
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
    for (const failedTest of results.tests.filter(t => !t.passed)) {
      console.log(`  - ${failedTest.name}`);
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
