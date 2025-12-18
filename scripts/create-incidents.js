#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Create intentional incidents for screenshot capture
 *
 * Generates various error states:
 * - Failed script tasks
 * - Failed service tasks
 * - Failed job execution
 * - External task failures
 * - Expression evaluation errors
 */

import 'dotenv/config';
import axios from 'axios';
import FormData from 'form-data';

// Configuration
const config = {
  baseUrl: process.env.OPERATON_REST_URL || 'https://operaton-doc.open-regels.nl/engine-rest',
  webUrl: process.env.OPERATON_BASE_URL || 'https://operaton-doc.open-regels.nl',
  username: process.env.OPERATON_USERNAME || 'demo',
  password: process.env.OPERATON_PASSWORD || 'demo',
};

// Parse command line arguments
const args = process.argv.slice(2);
const createScriptErrors = args.includes('--script-errors') || args.length === 0;
const createServiceErrors = args.includes('--service-errors') || args.length === 0;
const createExpressionErrors = args.includes('--expression-errors') || args.length === 0;
const createJobErrors = args.includes('--job-errors') || args.length === 0;

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
  deployments: { created: 0, failed: 0 },
  instances: { started: 0, failed: 0 },
  externalTasks: { failed: 0 },
  incidents: 0,
  failedJobs: 0,
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
 * Deploy a BPMN process
 * @param {string} name - Deployment name
 * @param {string} bpmnXml - BPMN XML content
 * @returns {Promise<Object|null>}
 */
async function deployProcess(name, bpmnXml) {
  const form = new FormData();

  form.append('deployment-name', name);
  form.append('deployment-source', 'incident-creator');
  form.append('enable-duplicate-filtering', 'false');
  form.append('upload', Buffer.from(bpmnXml), {
    filename: `${name}.bpmn`,
    contentType: 'application/octet-stream',
  });

  try {
    const response = await api.post('/deployment/create', form, {
      headers: form.getHeaders(),
      timeout: 30000,
    });
    console.log(`  ✓ Deployed: ${name}`);
    debug(`Deployment ID: ${response.data.id}`);
    stats.deployments.created++;
    return response.data;
  } catch (error) {
    console.log(`  ✗ Failed to deploy ${name}: ${getErrorMessage(error)}`);
    stats.deployments.failed++;
    return null;
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
    stats.instances.started++;
    return response.data;
  } catch (error) {
    // Expected for some error scenarios - process may fail immediately
    debug(`Process ${processKey} start result: ${getErrorMessage(error)}`);
    stats.instances.failed++;
    return null;
  }
}

/**
 * Get incidents
 * @returns {Promise<Array>}
 */
async function getIncidents() {
  try {
    const response = await api.get('/incident');
    return response.data;
  } catch (error) {
    debug(`Failed to get incidents: ${getErrorMessage(error)}`);
    return [];
  }
}

/**
 * Get jobs with failures
 * @returns {Promise<Array>}
 */
async function getFailedJobs() {
  try {
    const response = await api.get('/job', {
      params: { withException: true },
    });
    return response.data;
  } catch (error) {
    debug(`Failed to get failed jobs: ${getErrorMessage(error)}`);
    return [];
  }
}

// ============================================================================
// FAILING PROCESS DEFINITIONS
// ============================================================================

/**
 * BPMN: Process with failing script task
 */
const FAILING_SCRIPT_PROCESS = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                  id="Definitions_FailingScript"
                  targetNamespace="http://operaton.org/examples/incidents">
  <bpmn:process id="failing-script-process" name="Failing Script Process" isExecutable="true" camunda:historyTimeToLive="30">
    <bpmn:startEvent id="start" name="Start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="failingScript" />
    <bpmn:scriptTask id="failingScript" name="Failing Script Task" scriptFormat="javascript" camunda:asyncBefore="true">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
      <bpmn:script>
        // This script intentionally throws an error
        throw new Error("Intentional script failure for incident demo");
      </bpmn:script>
    </bpmn:scriptTask>
    <bpmn:sequenceFlow id="flow2" sourceRef="failingScript" targetRef="end" />
    <bpmn:endEvent id="end" name="End">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="failing-script-process">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="180" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="failingScript_di" bpmnElement="failingScript">
        <dc:Bounds x="270" y="78" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="432" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow1_di" bpmnElement="flow1">
        <di:waypoint x="216" y="118" />
        <di:waypoint x="270" y="118" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow2_di" bpmnElement="flow2">
        <di:waypoint x="370" y="118" />
        <di:waypoint x="432" y="118" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/**
 * BPMN: Process with failing service task (delegate expression)
 */
const FAILING_SERVICE_PROCESS = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                  id="Definitions_FailingService"
                  targetNamespace="http://operaton.org/examples/incidents">
  <bpmn:process id="failing-service-process" name="Failing Service Process" isExecutable="true" camunda:historyTimeToLive="30">
    <bpmn:startEvent id="start" name="Start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="failingService" />
    <bpmn:serviceTask id="failingService" name="Failing Service Task" camunda:asyncBefore="true" camunda:delegateExpression="\${nonExistentBean}">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="flow2" sourceRef="failingService" targetRef="end" />
    <bpmn:endEvent id="end" name="End">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="failing-service-process">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="180" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="failingService_di" bpmnElement="failingService">
        <dc:Bounds x="270" y="78" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="432" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow1_di" bpmnElement="flow1">
        <di:waypoint x="216" y="118" />
        <di:waypoint x="270" y="118" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow2_di" bpmnElement="flow2">
        <di:waypoint x="370" y="118" />
        <di:waypoint x="432" y="118" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/**
 * BPMN: Process with expression evaluation error
 */
const FAILING_EXPRESSION_PROCESS = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                  id="Definitions_FailingExpression"
                  targetNamespace="http://operaton.org/examples/incidents">
  <bpmn:process id="failing-expression-process" name="Failing Expression Process" isExecutable="true" camunda:historyTimeToLive="30">
    <bpmn:startEvent id="start" name="Start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="gateway" />
    <bpmn:exclusiveGateway id="gateway" name="Check condition">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flowYes</bpmn:outgoing>
      <bpmn:outgoing>flowNo</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:sequenceFlow id="flowYes" name="yes" sourceRef="gateway" targetRef="taskYes">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${undefinedVariable == true}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="flowNo" name="no" sourceRef="gateway" targetRef="taskNo">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${undefinedVariable == false}</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:userTask id="taskYes" name="Yes Path">
      <bpmn:incoming>flowYes</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="taskNo" name="No Path">
      <bpmn:incoming>flowNo</bpmn:incoming>
      <bpmn:outgoing>flow3</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="flow2" sourceRef="taskYes" targetRef="end" />
    <bpmn:sequenceFlow id="flow3" sourceRef="taskNo" targetRef="end" />
    <bpmn:endEvent id="end" name="End">
      <bpmn:incoming>flow2</bpmn:incoming>
      <bpmn:incoming>flow3</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="failing-expression-process">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="180" y="150" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="gateway_di" bpmnElement="gateway" isMarkerVisible="true">
        <dc:Bounds x="270" y="143" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="taskYes_di" bpmnElement="taskYes">
        <dc:Bounds x="380" y="78" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="taskNo_di" bpmnElement="taskNo">
        <dc:Bounds x="380" y="200" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="542" y="150" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow1_di" bpmnElement="flow1">
        <di:waypoint x="216" y="168" />
        <di:waypoint x="270" y="168" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flowYes_di" bpmnElement="flowYes">
        <di:waypoint x="295" y="143" />
        <di:waypoint x="295" y="118" />
        <di:waypoint x="380" y="118" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flowNo_di" bpmnElement="flowNo">
        <di:waypoint x="295" y="193" />
        <di:waypoint x="295" y="240" />
        <di:waypoint x="380" y="240" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow2_di" bpmnElement="flow2">
        <di:waypoint x="480" y="118" />
        <di:waypoint x="560" y="118" />
        <di:waypoint x="560" y="150" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow3_di" bpmnElement="flow3">
        <di:waypoint x="480" y="240" />
        <di:waypoint x="560" y="240" />
        <di:waypoint x="560" y="186" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/**
 * BPMN: Process with async job that fails
 */
const FAILING_JOB_PROCESS = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                  id="Definitions_FailingJob"
                  targetNamespace="http://operaton.org/examples/incidents">
  <bpmn:process id="failing-job-process" name="Failing Job Process" isExecutable="true" camunda:historyTimeToLive="30">
    <bpmn:startEvent id="start" name="Start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="asyncTask" />
    <bpmn:serviceTask id="asyncTask" name="Async Failing Task" camunda:asyncBefore="true" camunda:class="org.operaton.NonExistentClass">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="flow2" sourceRef="asyncTask" targetRef="end" />
    <bpmn:endEvent id="end" name="End">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="failing-job-process">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="180" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="asyncTask_di" bpmnElement="asyncTask">
        <dc:Bounds x="270" y="78" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="432" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow1_di" bpmnElement="flow1">
        <di:waypoint x="216" y="118" />
        <di:waypoint x="270" y="118" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow2_di" bpmnElement="flow2">
        <di:waypoint x="370" y="118" />
        <di:waypoint x="432" y="118" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/**
 * BPMN: Process with external task that can timeout
 */
const EXTERNAL_TASK_PROCESS = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  xmlns:camunda="http://camunda.org/schema/1.0/bpmn"
                  id="Definitions_ExternalTask"
                  targetNamespace="http://operaton.org/examples/incidents">
  <bpmn:process id="external-task-process" name="External Task Process" isExecutable="true" camunda:historyTimeToLive="30">
    <bpmn:startEvent id="start" name="Start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="externalTask" />
    <bpmn:serviceTask id="externalTask" name="External Task" camunda:type="external" camunda:topic="incident-demo-topic">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:sequenceFlow id="flow2" sourceRef="externalTask" targetRef="end" />
    <bpmn:endEvent id="end" name="End">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="external-task-process">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="180" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="externalTask_di" bpmnElement="externalTask">
        <dc:Bounds x="270" y="78" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="432" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow1_di" bpmnElement="flow1">
        <di:waypoint x="216" y="118" />
        <di:waypoint x="270" y="118" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow2_di" bpmnElement="flow2">
        <di:waypoint x="370" y="118" />
        <di:waypoint x="432" y="118" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// ============================================================================
// INCIDENT CREATION FUNCTIONS
// ============================================================================

/**
 * Create script task incidents
 */
async function createScriptIncidents() {
  console.log('');
  console.log('─'.repeat(50));
  console.log('  Creating Script Task Incidents');
  console.log('─'.repeat(50));

  // Deploy failing script process
  const deployment = await deployProcess('failing-script-process', FAILING_SCRIPT_PROCESS);
  if (!deployment) {
    console.log('  ⚠ Skipping script incidents (deployment failed)');
    return;
  }

  await delay(500);

  // Start instances (they will fail at the script task)
  for (let i = 0; i < 3; i++) {
    console.log(`  Starting failing script instance ${i + 1}...`);
    await startProcess('failing-script-process', {}, `SCRIPT-FAIL-${Date.now()}-${i}`);
    await delay(300);
  }

  // Wait for jobs to execute and fail
  console.log('  Waiting for job execution...');
  await delay(2000);
}

/**
 * Create service task incidents
 */
async function createServiceIncidents() {
  console.log('');
  console.log('─'.repeat(50));
  console.log('  Creating Service Task Incidents');
  console.log('─'.repeat(50));

  // Deploy failing service process
  const deployment = await deployProcess('failing-service-process', FAILING_SERVICE_PROCESS);
  if (!deployment) {
    console.log('  ⚠ Skipping service incidents (deployment failed)');
    return;
  }

  await delay(500);

  // Start instances
  for (let i = 0; i < 2; i++) {
    console.log(`  Starting failing service instance ${i + 1}...`);
    await startProcess('failing-service-process', {}, `SERVICE-FAIL-${Date.now()}-${i}`);
    await delay(300);
  }

  // Wait for jobs to execute and fail
  console.log('  Waiting for job execution...');
  await delay(2000);
}

/**
 * Create expression evaluation incidents
 */
async function createExpressionIncidents() {
  console.log('');
  console.log('─'.repeat(50));
  console.log('  Creating Expression Evaluation Incidents');
  console.log('─'.repeat(50));

  // Deploy process with bad expression
  const deployment = await deployProcess('failing-expression-process', FAILING_EXPRESSION_PROCESS);
  if (!deployment) {
    console.log('  ⚠ Skipping expression incidents (deployment failed)');
    return;
  }

  await delay(500);

  // Start without required variable (will fail at gateway)
  console.log('  Starting instance without required variable...');
  await startProcess('failing-expression-process', {}, `EXPR-FAIL-${Date.now()}`);
}

/**
 * Create async job incidents
 */
async function createJobIncidents() {
  console.log('');
  console.log('─'.repeat(50));
  console.log('  Creating Async Job Incidents');
  console.log('─'.repeat(50));

  // Deploy async failing process
  const deployment = await deployProcess('failing-job-process', FAILING_JOB_PROCESS);
  if (!deployment) {
    console.log('  ⚠ Skipping job incidents (deployment failed)');
    return;
  }

  await delay(500);

  // Start instances
  for (let i = 0; i < 2; i++) {
    console.log(`  Starting async failing instance ${i + 1}...`);
    await startProcess('failing-job-process', {}, `JOB-FAIL-${Date.now()}-${i}`);
    await delay(500);
  }

  // Wait for jobs to be executed and fail
  console.log('  Waiting for job execution...');
  await delay(3000);
}

/**
 * Create external task incidents
 */
async function createExternalTaskIncidents() {
  console.log('');
  console.log('─'.repeat(50));
  console.log('  Creating External Task Incidents');
  console.log('─'.repeat(50));

  // Deploy external task process
  const deployment = await deployProcess('external-task-process', EXTERNAL_TASK_PROCESS);
  if (!deployment) {
    console.log('  ⚠ Skipping external task incidents (deployment failed)');
    return;
  }

  await delay(500);

  // Start instances (they will wait for external workers)
  for (let i = 0; i < 2; i++) {
    console.log(`  Starting external task instance ${i + 1}...`);
    await startProcess('external-task-process', {}, `EXT-TASK-${Date.now()}-${i}`);
    await delay(300);
  }

  // Fetch and fail external tasks
  console.log('  Fetching external tasks to fail them...');
  await delay(500);

  try {
    // Fetch external tasks
    const fetchResponse = await api.post('/external-task/fetchAndLock', {
      workerId: 'incident-creator',
      maxTasks: 5,
      topics: [
        {
          topicName: 'incident-demo-topic',
          lockDuration: 60000,
        },
      ],
    });

    const tasks = fetchResponse.data;
    console.log(`  Found ${tasks.length} external task(s)`);

    // Fail each task
    for (const task of tasks) {
      try {
        await api.post(`/external-task/${task.id}/failure`, {
          workerId: 'incident-creator',
          errorMessage: 'Intentional failure for incident demo',
          errorDetails:
            'This external task was intentionally failed to demonstrate incident handling in the Operaton webapps.',
          retries: 0,
          retryTimeout: 0,
        });
        console.log(`  ✓ Failed external task ${task.id.substring(0, 8)}...`);
        stats.externalTasks.failed++;
      } catch (error) {
        debug(`Could not fail external task ${task.id}: ${getErrorMessage(error)}`);
      }
    }
  } catch (error) {
    console.log(`  ⚠ Could not fail external tasks: ${getErrorMessage(error)}`);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('═'.repeat(60));
  console.log('  Operaton Incident Creator');
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

  // Create requested incident types
  if (createScriptErrors) {
    await createScriptIncidents();
  }

  if (createServiceErrors) {
    await createServiceIncidents();
  }

  if (createExpressionErrors) {
    await createExpressionIncidents();
  }

  if (createJobErrors) {
    await createJobIncidents();
    await createExternalTaskIncidents();
  }

  // Get final counts
  const incidents = await getIncidents();
  const failedJobs = await getFailedJobs();
  stats.incidents = incidents.length;
  stats.failedJobs = failedJobs.length;

  // Print summary
  console.log('');
  console.log('═'.repeat(60));
  console.log('  Incident Creation Summary');
  console.log('═'.repeat(60));
  console.log(
    `  Deployments:     ${stats.deployments.created} created, ${stats.deployments.failed} failed`
  );
  console.log(
    `  Instances:       ${stats.instances.started} started, ${stats.instances.failed} failed immediately`
  );
  console.log(`  External tasks:  ${stats.externalTasks.failed} failed`);
  console.log('');
  console.log(`  Total incidents: ${stats.incidents}`);
  console.log(`  Failed jobs:     ${stats.failedJobs}`);

  if (incidents.length > 0) {
    // Group by type
    const byType = {};
    for (const incident of incidents) {
      const type = incident.incidentType || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    }

    console.log('');
    console.log('  Incidents by type:');
    for (const [type, count] of Object.entries(byType)) {
      console.log(`    ${type}: ${count}`);
    }
  }

  console.log('═'.repeat(60));

  if (stats.incidents > 0 || stats.failedJobs > 0) {
    console.log('');
    console.log('✓ Incidents created successfully');
    console.log('');
    console.log('Your Operaton instance now has incidents for:');
    console.log('  - Cockpit incident views');
    console.log('  - Failed job drill-down');
    console.log('  - Job retry functionality');
    console.log('  - External task failure handling');
    console.log('');
    console.log('Next steps:');
    console.log('  make status     # View incident counts');
    console.log('  make capture    # Capture screenshots');
  } else {
    console.log('');
    console.log('⚠ No incidents were created');
    console.log('');
    console.log('This may happen if:');
    console.log('  - Job executor is not running');
    console.log('  - Processes deployed but not yet executed');
    console.log('');
    console.log('Try running again or check Operaton logs.');
  }
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  if (process.env.DEBUG === 'true') {
    console.error(err.stack);
  }
  process.exit(1);
});
