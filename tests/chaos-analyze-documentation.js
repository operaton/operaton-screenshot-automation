#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Chaos tests for analyze-documentation.js
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

// Temp directory for test fixtures
const tempDir = join(__dirname, '.temp-analyze-test');

/**
 * Setup test fixtures
 */
async function setupFixtures() {
  // Create temp directory
  await fs.mkdir(tempDir, { recursive: true });

  // Create subdirectories
  await fs.mkdir(join(tempDir, 'docs-with-images'), { recursive: true });
  await fs.mkdir(join(tempDir, 'docs-empty'), { recursive: true });
  await fs.mkdir(join(tempDir, 'docs-no-images'), { recursive: true });

  // Create markdown file with various image references
  const mdWithImages = `# Test Documentation

## Cockpit Screenshots

![Dashboard](../images/cockpit-dashboard.png)
![Process](images/process-definition-view.jpg)

## Tasklist Screenshots

![Task List](./tasklist-filter.png)
<img src="task-form.png" alt="Task Form">

## External Images (should be skipped)

![External](https://example.com/image.png)

## Other Images

![Logo](logo.svg)
`;

  await fs.writeFile(join(tempDir, 'docs-with-images', 'test.md'), mdWithImages);

  // Create markdown without images
  const mdNoImages = `# Documentation Without Images

Just some text content here.

## Section

More text without any images.
`;

  await fs.writeFile(join(tempDir, 'docs-no-images', 'readme.md'), mdNoImages);

  // docs-empty stays empty
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
}

/**
 * Run analyze-documentation.js with custom environment/arguments
 */
function runAnalyze(args = [], envOverrides = {}, timeout = 30000) {
  return new Promise(resolve => {
    const env = {
      ...process.env,
      ...envOverrides,
    };

    const child = spawn(
      'node',
      [join(__dirname, '..', 'scripts', 'analyze-documentation.js'), ...args],
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
async function test(name, args, envOverrides, expectations) {
  process.stdout.write(`  Testing: ${name}... `);

  const result = await runAnalyze(args, envOverrides, expectations.timeout || 15000);

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
  console.log('  Chaos Tests for analyze-documentation.js');
  console.log('═'.repeat(60));
  console.log('');

  // Setup fixtures
  console.log('Setting up test fixtures...');
  await setupFixtures();
  console.log('');

  try {
    // ============================================================
    // SECTION 1: Invalid Path Tests
    // ============================================================
    console.log('Section 1: Invalid Path Tests');
    console.log('─'.repeat(40));

    await test(
      'Non-existent directory',
      ['/path/that/does/not/exist/anywhere'],
      {},
      {
        exitCode: 1,
        stdoutContains: ['Documentation directory not found', 'Troubleshooting'],
        timeout: 10000,
      }
    );

    await test(
      'Empty path argument',
      [''],
      { DOCS_PATH: '' },
      {
        exitCode: 1,
        stdoutContains: ['Documentation directory not found'],
        timeout: 10000,
      }
    );

    console.log('');

    // ============================================================
    // SECTION 2: Empty/No Content Tests
    // ============================================================
    console.log('Section 2: Empty/No Content Tests');
    console.log('─'.repeat(40));

    await test(
      'Empty directory (no markdown files)',
      [join(tempDir, 'docs-empty')],
      {},
      {
        exitCode: 0,
        stdoutContains: ['No markdown files found'],
        timeout: 10000,
      }
    );

    await test(
      'Markdown files without images',
      [join(tempDir, 'docs-no-images')],
      {},
      {
        exitCode: 0,
        stdoutContains: ['Found 1 markdown files', 'No image references found'],
        timeout: 10000,
      }
    );

    console.log('');

    // ============================================================
    // SECTION 3: Successful Analysis Tests
    // ============================================================
    console.log('Section 3: Successful Analysis Tests');
    console.log('─'.repeat(40));

    await test(
      'Directory with images',
      [join(tempDir, 'docs-with-images')],
      {},
      {
        exitCode: 0,
        stdoutContains: [
          'Documentation Screenshot Analyzer',
          'Found 1 markdown files',
          'image references',
          'Summary',
          'By Category',
        ],
        timeout: 15000,
      }
    );

    await test(
      'Categorizes cockpit screenshots',
      [join(tempDir, 'docs-with-images')],
      {},
      {
        exitCode: 0,
        stdoutContains: ['cockpit'],
        timeout: 15000,
      }
    );

    await test(
      'Generates output files',
      [join(tempDir, 'docs-with-images')],
      { OUTPUT_DIR: join(tempDir, 'output') },
      {
        exitCode: 0,
        stdoutContains: ['screenshot-analysis.json', 'REPLACEMENT_PLAN.md'],
        timeout: 15000,
      }
    );

    console.log('');

    // ============================================================
    // SECTION 4: Debug Mode Tests
    // ============================================================
    console.log('Section 4: Debug Mode Tests');
    console.log('─'.repeat(40));

    await test(
      'Debug mode shows configuration',
      [join(tempDir, 'docs-with-images')],
      { DEBUG: 'true' },
      {
        exitCode: 0,
        stdoutContains: ['Configuration:', 'Docs path:', 'Output dir:'],
        timeout: 15000,
      }
    );

    await test(
      'Debug mode on non-existent path',
      ['/path/that/does/not/exist'],
      { DEBUG: 'true' },
      {
        exitCode: 1,
        stdoutContains: ['Configuration:', 'Documentation directory not found'],
        timeout: 10000,
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
      [join(tempDir, 'docs-with-images')],
      {},
      {
        exitCode: 0,
        stdoutContains: ['═', 'Documentation Screenshot Analyzer'],
        timeout: 15000,
      }
    );

    await test(
      'Output includes section separators',
      [join(tempDir, 'docs-with-images')],
      {},
      {
        exitCode: 0,
        stdoutContains: ['─', 'Summary', 'By Category', 'Output Files'],
        timeout: 15000,
      }
    );

    console.log('');
  } finally {
    // Cleanup fixtures
    console.log('Cleaning up test fixtures...');
    await cleanupFixtures();
    console.log('');
  }

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
  cleanupFixtures().finally(() => process.exit(1));
});
