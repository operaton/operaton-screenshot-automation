#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Chaos tests for deploy-processes.js
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
const tempDir = join(__dirname, '.temp-deploy-test');

/**
 * Setup test fixtures
 */
async function setupFixtures() {
  await fs.mkdir(tempDir, { recursive: true });
  await fs.mkdir(join(tempDir, 'processes', 'bpmn'), { recursive: true });
  await fs.mkdir(join(tempDir, 'processes', 'dmn'), { recursive: true });
  await fs.mkdir(join(tempDir, 'empty-processes'), { recursive: true });

  // Create a valid complete BPMN file
  const testBpmn = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                  id="Definitions_ChaosTest"
                  targetNamespace="http://operaton.org/test">
  <bpmn:process id="chaos-test-process" name="Chaos Test Process" isExecutable="true" camunda:historyTimeToLive="30">
    <bpmn:startEvent id="Start">
      <bpmn:outgoing>Flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:endEvent id="End">
      <bpmn:incoming>Flow1</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow1" sourceRef="Start" targetRef="End" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="chaos-test-process">
      <bpmndi:BPMNShape id="Start_di" bpmnElement="Start">
        <dc:Bounds x="180" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_di" bpmnElement="End">
        <dc:Bounds x="280" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
  await fs.writeFile(join(tempDir, 'processes', 'bpmn', 'chaos-test.bpmn'), testBpmn);

  // Create a valid complete DMN file
  const testDmn = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
             xmlns:camunda="http://camunda.org/schema/1.0/dmn"
             id="Definitions_ChaosTest"
             name="Chaos Test Decision"
             namespace="http://operaton.org/test">
  <decision id="chaos-test-decision" name="Chaos Test Decision" camunda:historyTimeToLive="30">
    <decisionTable id="DecisionTable_ChaosTest" hitPolicy="FIRST">
      <input id="Input_1" label="Value">
        <inputExpression id="InputExpression_1" typeRef="integer">
          <text>value</text>
        </inputExpression>
      </input>
      <output id="Output_1" label="Result" name="result" typeRef="string" />
      <rule id="Rule_1">
        <inputEntry id="InputEntry_1">
          <text>&gt;= 0</text>
        </inputEntry>
        <outputEntry id="OutputEntry_1">
          <text>"positive"</text>
        </outputEntry>
      </rule>
      <rule id="Rule_2">
        <inputEntry id="InputEntry_2">
          <text>&lt; 0</text>
        </inputEntry>
        <outputEntry id="OutputEntry_2">
          <text>"negative"</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
  <dmndi:DMNDI>
    <dmndi:DMNDiagram id="DMNDiagram_1">
      <dmndi:DMNShape id="DMNShape_1" dmnElementRef="chaos-test-decision">
        <dc:Bounds height="80" width="180" x="160" y="100" />
      </dmndi:DMNShape>
    </dmndi:DMNDiagram>
  </dmndi:DMNDI>
</definitions>`;
  await fs.writeFile(join(tempDir, 'processes', 'dmn', 'chaos-test.dmn'), testDmn);
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
 * Run deploy-processes.js with custom environment
 */
function runDeploy(envOverrides = {}, timeout = 30000) {
  return new Promise(resolve => {
    const env = {
      ...process.env,
      // Clear .env values that would interfere with tests
      OPERATON_REST_URL: '',
      OPERATON_BASE_URL: '',
      PROCESSES_DIR: '',
      DEPLOYMENT_SOURCE: '',
      ...envOverrides,
    };

    const child = spawn('node', [join(__dirname, '..', 'scripts', 'deploy-processes.js')], {
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

  const result = await runDeploy(envOverrides, expectations.timeout || 20000);

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
  console.log('  Chaos Tests for deploy-processes.js');
  console.log('═'.repeat(60));
  console.log('');

  // Setup fixtures
  console.log('Setting up test fixtures...');
  await setupFixtures();
  console.log('');

  try {
    // ============================================================
    // SECTION 1: Connection Failure Tests
    // ============================================================
    console.log('Section 1: Connection Failure Tests');
    console.log('─'.repeat(40));

    await test(
      'Non-existent host',
      {
        OPERATON_REST_URL: 'https://this-host-does-not-exist-12345.invalid/engine-rest',
        PROCESSES_DIR: join(tempDir, 'processes'),
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
        PROCESSES_DIR: join(tempDir, 'processes'),
      },
      {
        exitCode: 1,
        stdoutContains: ['Cannot connect to Operaton', 'Connection refused'],
        timeout: 15000,
      }
    );

    console.log('');

    // ============================================================
    // SECTION 2: Processes Directory Tests
    // ============================================================
    console.log('Section 2: Processes Directory Tests');
    console.log('─'.repeat(40));

    await test(
      'Processes directory not found',
      {
        OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
        PROCESSES_DIR: '/path/to/nonexistent/processes',
      },
      {
        exitCode: 1,
        stdoutContains: ['Connected to engine', 'Processes directory not found'],
        timeout: 20000,
      }
    );

    await test(
      'Empty processes directory',
      {
        OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
        PROCESSES_DIR: join(tempDir, 'empty-processes'),
      },
      {
        exitCode: 0,
        stdoutContains: ['Connected to engine', 'No process files found'],
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
        PROCESSES_DIR: join(tempDir, 'processes'),
      },
      {
        exitCode: 1,
        stdoutContains: [
          'Configuration:',
          'REST URL:',
          'Web URL:',
          'Username:',
          'Password: ****',
          'Processes dir:',
        ],
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
        PROCESSES_DIR: join(tempDir, 'processes'),
      },
      {
        exitCode: 0,
        stdoutContains: ['Connected to engine', 'Deploying BPMN'],
        timeout: 30000,
      }
    );

    await test(
      'Discovers and deploys BPMN files',
      {
        OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
        PROCESSES_DIR: join(tempDir, 'processes'),
      },
      {
        exitCode: 0,
        stdoutContains: ['Deploying BPMN Processes', 'Chaos Test'],
        timeout: 30000,
      }
    );

    await test(
      'Discovers and deploys DMN files',
      {
        OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
        PROCESSES_DIR: join(tempDir, 'processes'),
      },
      {
        exitCode: 0,
        stdoutContains: ['Deploying DMN Decisions', 'Chaos Test'],
        timeout: 30000,
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
        PROCESSES_DIR: join(tempDir, 'processes'),
      },
      {
        exitCode: 1,
        stdoutContains: ['═', 'Operaton Process Deployment'],
        timeout: 15000,
      }
    );

    await test(
      'Output includes summary section',
      {
        OPERATON_REST_URL: 'https://operaton-doc.open-regels.nl/engine-rest',
        PROCESSES_DIR: join(tempDir, 'processes'),
      },
      {
        exitCode: 0,
        stdoutContains: ['Deployment Summary', 'Deployed:', 'Failed:'],
        timeout: 30000,
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
