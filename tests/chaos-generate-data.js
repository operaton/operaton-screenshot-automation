#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Chaos tests for generate-data.js
 * Tests error handling for various failure scenarios
 */

import 'dotenv/config';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tempDir = join(__dirname, '..', '.temp-chaos-data');

const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

/**
 * Setup test fixtures
 */
async function setupFixtures() {
  await fs.mkdir(tempDir, { recursive: true });
  await fs.mkdir(join(tempDir, 'config'), { recursive: true });

  // Valid config with users and groups (no hyphens in IDs)
  const validConfig = {
    users: [
      {
        id: 'chaosuser',
        firstName: 'Chaos',
        lastName: 'Test',
        email: 'chaos@test.com',
        password: 'chaos123',
      },
    ],
    groups: [
      {
        id: 'chaosgroup',
        name: 'Chaos Test Group',
        type: 'WORKFLOW',
      },
    ],
    memberships: [{ userId: 'chaosuser', groupId: 'chaosgroup' }],
  };
  await fs.writeFile(join(tempDir, 'config', 'valid.json'), JSON.stringify(validConfig, null, 2));

  // Empty config
  const emptyConfig = {
    users: [],
    groups: [],
  };
  await fs.writeFile(join(tempDir, 'config', 'empty.json'), JSON.stringify(emptyConfig, null, 2));

  // Invalid JSON
  await fs.writeFile(join(tempDir, 'config', 'invalid.json'), '{ invalid json }');
}

/**
 * Cleanup test fixtures
 */
async function cleanupFixtures() {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }

  // Clean up users/groups created during tests
  try {
    const axios = (await import('axios')).default;
    const api = axios.create({
      baseURL: 'https://operaton-doc.open-regels.nl/engine-rest',
      auth: { username: 'demo', password: 'demo' },
      timeout: 10000,
    });

    // Delete test user
    await api.delete('/user/chaosuser').catch(() => {
      /* empty */
    });
    // Delete test group
    await api.delete('/group/chaosgroup').catch(() => {
      /* empty */
    });
  } catch {
    // Ignore API cleanup errors
  }
}

/**
 * Run generate-data.js with custom environment
 */
function runGenerateData(envOverrides = {}, timeout = 30000) {
  return new Promise(resolve => {
    const env = {
      ...process.env,
      // Clear .env values that would interfere with tests
      OPERATON_REST_URL: '',
      OPERATON_BASE_URL: '',
      CONFIG_PATH: '',
      ...envOverrides,
    };

    const child = spawn('node', [join(__dirname, '..', 'scripts', 'generate-data.js')], {
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

  const result = await runGenerateData(envOverrides, expectations.timeout || 30000);

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
  console.log('  Chaos Tests for generate-data.js');
  console.log('═'.repeat(60));
  console.log('');

  console.log('Setting up test fixtures...');
  await setupFixtures();
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
      CONFIG_PATH: join(tempDir, 'config', 'valid.json'),
    },
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
      CONFIG_PATH: join(tempDir, 'config', 'valid.json'),
    },
    {
      exitCode: 1,
      stdoutContains: ['Cannot connect to Operaton', 'Connection refused'],
      timeout: 15000,
    }
  );

  console.log('');

  // ============================================================
  // SECTION 2: Configuration Tests
  // ============================================================
  console.log('Section 2: Configuration Tests');
  console.log('─'.repeat(40));

  await test(
    'Config file not found',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
      CONFIG_PATH: '/path/to/nonexistent/config.json',
    },
    {
      exitCode: 1,
      stdoutContains: ['Connected to engine', 'Configuration file not found'],
      timeout: 20000,
    }
  );

  await test(
    'Invalid JSON in config',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
      CONFIG_PATH: join(tempDir, 'config', 'invalid.json'),
    },
    {
      exitCode: 1,
      stdoutContains: ['Connected to engine', 'Invalid JSON'],
      timeout: 20000,
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
      CONFIG_PATH: join(tempDir, 'config', 'valid.json'),
    },
    {
      exitCode: 1,
      stdoutContains: ['Configuration:', 'REST URL:', 'Web URL:', 'Username:', 'Password: ****'],
      timeout: 15000,
    }
  );

  console.log('');

  // ============================================================
  // SECTION 4: Successful Connection Tests
  // ============================================================
  console.log('Section 4: Successful Connection Tests');
  console.log('─'.repeat(40));

  await test(
    'Successful connection shows engine',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
      CONFIG_PATH: join(tempDir, 'config', 'valid.json'),
    },
    {
      exitCode: 0,
      stdoutContains: ['Connected to engine', 'Creating Users'],
      timeout: 60000,
    }
  );

  await test(
    'Creates users and groups',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
      CONFIG_PATH: join(tempDir, 'config', 'valid.json'),
    },
    {
      exitCode: 0,
      stdoutContains: ['Creating Users', 'Creating Groups', 'chaosuser'],
      timeout: 60000,
    }
  );

  await test(
    'Empty config succeeds with no users',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
      CONFIG_PATH: join(tempDir, 'config', 'empty.json'),
    },
    {
      exitCode: 0,
      stdoutContains: ['No users defined', 'No groups defined', 'Data Generation Summary'],
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
      CONFIG_PATH: join(tempDir, 'config', 'valid.json'),
    },
    {
      exitCode: 1,
      stdoutContains: ['═', 'Operaton Test Data Generator'],
      timeout: 15000,
    }
  );

  await test(
    'Output includes summary',
    {
      OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
      CONFIG_PATH: join(tempDir, 'config', 'valid.json'),
    },
    {
      exitCode: 0,
      stdoutContains: ['Data Generation Summary', 'Users:', 'Groups:', 'Instances:'],
      timeout: 60000,
    }
  );

  console.log('');

  // Cleanup
  console.log('Cleaning up test fixtures...');
  await cleanupFixtures();

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('');
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
