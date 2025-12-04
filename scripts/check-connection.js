#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2025 Operaton
 *
 * Check connection to Operaton instance
 */

import 'dotenv/config';
import axios from 'axios';

const config = {
  baseUrl: process.env.OPERATON_REST_URL || 'https://operaton-doc.open-regels.nl/engine-rest',
  webUrl: process.env.OPERATON_BASE_URL || 'https://operaton-doc.open-regels.nl',
  username: process.env.OPERATON_USERNAME || 'demo',
  password: process.env.OPERATON_PASSWORD || 'demo',
};

/**
 * Handle and display error information with actionable guidance
 * @param {Error} error - The error object from axios
 * @param {string} context - Description of what was being attempted
 */
function handleError(error, _context) {
  if (error.response) {
    const { status } = error.response;
    console.log(`    Status: ${status}`);
    switch (status) {
      case 400:
        console.log('    → Bad request. Check API endpoint format');
        break;
      case 401:
        console.log('    → Authentication failed. Check username/password in .env file');
        break;
      case 403:
        console.log('    → Access forbidden. Check credentials or IP/firewall restrictions');
        break;
      case 404:
        console.log('    → Endpoint not found. Verify OPERATON_REST_URL is correct');
        break;
      case 405:
        console.log('    → Method not allowed. The endpoint may not support this HTTP method');
        break;
      case 408:
        console.log('    → Request timeout. Server took too long to respond');
        break;
      case 429:
        console.log('    → Too many requests. Rate limited - wait and retry');
        break;
      case 500:
        console.log('    → Server error. Check Operaton logs for details');
        break;
      case 502:
        console.log('    → Bad gateway. Check reverse proxy configuration');
        break;
      case 503:
        console.log('    → Service unavailable. Operaton may be starting up or overloaded');
        break;
      case 504:
        console.log('    → Gateway timeout. Server took too long to respond');
        break;
      default:
        console.log(`    → Unexpected status code: ${status}`);
    }
    // Include response body if available for debugging
    if (error.response.data && process.env.DEBUG === 'true') {
      console.log(`    Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    }
  } else if (error.code) {
    console.log(`    Code: ${error.code}`);
    switch (error.code) {
      case 'ECONNREFUSED':
        console.log('    → Connection refused. Is Operaton running?');
        break;
      case 'ENOTFOUND':
        console.log('    → Host not found. Check OPERATON_REST_URL in .env');
        break;
      case 'ECONNRESET':
        console.log('    → Connection reset. Network issue or server closed connection');
        break;
      case 'ETIMEDOUT':
        console.log('    → Connection timed out. Server may be slow or unreachable');
        break;
      case 'ECONNABORTED':
        console.log('    → Request aborted. Timeout exceeded or connection dropped');
        break;
      case 'CERT_HAS_EXPIRED':
        console.log('    → SSL certificate has expired. Contact server administrator');
        break;
      case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
        console.log('    → SSL certificate verification failed. Self-signed certificate?');
        break;
      case 'DEPTH_ZERO_SELF_SIGNED_CERT':
        console.log('    → Self-signed certificate detected. May need to trust the certificate');
        break;
      case 'ERR_TLS_CERT_ALTNAME_INVALID':
        console.log('    → Certificate hostname mismatch. URL may not match certificate');
        break;
      case 'EPROTO':
        console.log('    → Protocol error. Check if URL uses correct http/https scheme');
        break;
      case 'EAI_AGAIN':
        console.log('    → DNS lookup timed out. Temporary DNS issue - retry');
        break;
      case 'ENETUNREACH':
        console.log('    → Network unreachable. Check network connectivity');
        break;
      case 'EHOSTUNREACH':
        console.log('    → Host unreachable. Server may be down or blocked');
        break;
      default:
        console.log(`    → Network error: ${error.message}`);
    }
  } else {
    console.log(`    Error: ${error.message}`);
  }
}

async function checkRestApi() {
  console.log(`\nChecking REST API: ${config.baseUrl}`);

  try {
    const response = await axios.get(`${config.baseUrl}/engine`, {
      auth: {
        username: config.username,
        password: config.password,
      },
      timeout: 10000,
    });

    const engines = response.data;
    if (!Array.isArray(engines)) {
      console.log('  ⚠ REST API returned unexpected format');
      console.log(`    Expected array, got: ${typeof engines}`);
      return false;
    }

    if (engines.length === 0) {
      console.log('  ⚠ REST API accessible but no engines found');
      return false;
    }

    console.log('  ✓ REST API accessible');
    console.log(`  ✓ Engine(s): ${engines.map(e => e.name).join(', ')}`);
    return true;
  } catch (error) {
    console.log('  ✗ REST API not accessible');
    handleError(error, 'REST API check');
    return false;
  }
}

async function checkWebApps() {
  console.log(`\nChecking Web Apps: ${config.webUrl}`);

  const apps = ['cockpit', 'tasklist', 'admin', 'welcome'];
  const results = { accessible: 0, failed: 0 };

  for (const app of apps) {
    const url = `${config.webUrl}/operaton/app/${app}/default/`;
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: status => status < 500, // Accept redirects and auth challenges
      });

      if (response.status === 200) {
        console.log(`  ✓ ${app.charAt(0).toUpperCase() + app.slice(1)} accessible`);
        results.accessible++;
      } else if (response.status === 401 || response.status === 302 || response.status === 303) {
        // Login page or redirect is expected
        console.log(
          `  ✓ ${app.charAt(0).toUpperCase() + app.slice(1)} accessible (requires login)`
        );
        results.accessible++;
      } else {
        console.log(
          `  ⚠ ${app.charAt(0).toUpperCase() + app.slice(1)} returned status ${response.status}`
        );
        results.failed++;
      }
    } catch (error) {
      console.log(`  ✗ ${app.charAt(0).toUpperCase() + app.slice(1)} not accessible`);
      if (process.env.DEBUG === 'true') {
        handleError(error, `${app} check`);
      }
      results.failed++;
    }
  }

  return results;
}

async function checkVersion() {
  console.log('\nChecking Version Info:');

  try {
    const response = await axios.get(`${config.baseUrl}/version`, {
      auth: {
        username: config.username,
        password: config.password,
      },
      timeout: 10000,
    });

    const version = response.data?.version || 'unknown';
    console.log(`  Version: ${version}`);

    // Check for additional version info
    if (response.data?.edition) {
      console.log(`  Edition: ${response.data.edition}`);
    }

    return version;
  } catch (error) {
    console.log('  Version: Could not determine');
    if (process.env.DEBUG === 'true') {
      handleError(error, 'version check');
    }
    return null;
  }
}

async function checkDeploymentEndpoint() {
  console.log('\nChecking Deployment Endpoint:');

  try {
    const response = await axios.get(`${config.baseUrl}/deployment`, {
      auth: {
        username: config.username,
        password: config.password,
      },
      timeout: 10000,
    });

    const deployments = response.data;
    console.log(`  ✓ Deployment endpoint accessible`);
    console.log(`  ✓ Current deployments: ${deployments.length}`);
    return true;
  } catch (error) {
    console.log('  ✗ Deployment endpoint not accessible');
    handleError(error, 'deployment check');
    return false;
  }
}

async function main() {
  console.log('═'.repeat(50));
  console.log('  Operaton Connection Check');
  console.log('═'.repeat(50));

  // Show configuration (mask password)
  if (process.env.DEBUG === 'true') {
    console.log('\nConfiguration:');
    console.log(`  REST URL: ${config.baseUrl}`);
    console.log(`  Web URL: ${config.webUrl}`);
    console.log(`  Username: ${config.username}`);
    console.log(`  Password: ${'*'.repeat(config.password.length)}`);
  }

  const restOk = await checkRestApi();

  if (restOk) {
    await checkVersion();
    await checkDeploymentEndpoint();
    await checkWebApps();

    console.log(`\n${'═'.repeat(50)}`);
    console.log('  ✓ Connection successful!');
    console.log('═'.repeat(50));
    console.log('\nYou can now run:');
    console.log('  make deploy   # Deploy processes');
    console.log('  make data     # Generate test data');
    console.log('  make capture  # Capture screenshots');
  } else {
    console.log(`\n${'═'.repeat(50)}`);
    console.log('  ✗ Connection failed');
    console.log('═'.repeat(50));
    console.log('\nTroubleshooting:');
    console.log('  1. Verify Operaton is running');
    console.log('  2. Check .env file configuration');
    console.log('  3. Verify network connectivity');
    console.log('  4. Run with DEBUG=true for more details');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err.message);
  if (process.env.DEBUG === 'true') {
    console.error(err.stack);
  }
  process.exit(1);
});
