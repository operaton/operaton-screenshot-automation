# check-connection.js

Validates connectivity to an Operaton instance by testing the REST API, web applications, and
deployment endpoints.

## Overview

This script is the first step in any automation workflow. It verifies that:

- The Operaton REST API is reachable and responding
- Authentication credentials are valid
- Web applications (Cockpit, Tasklist, Admin, Welcome) are accessible
- The deployment endpoint is available for process deployment

## Usage

```bash
# Via Make (recommended)
make check

# Via npm
npm run check

# Direct execution
node scripts/check-connection.js

# With debug output
make check-debug
DEBUG=true npm run check
```

## Configuration

The script reads configuration from environment variables (`.env` file):

| Variable            | Description             | Default                                           |
| ------------------- | ----------------------- | ------------------------------------------------- |
| `OPERATON_REST_URL` | REST API endpoint       | `https://operaton-doc.open-regels.nl/engine-rest` |
| `OPERATON_BASE_URL` | Base URL for web apps   | `https://operaton-doc.open-regels.nl`             |
| `OPERATON_USERNAME` | Authentication username | `demo`                                            |
| `OPERATON_PASSWORD` | Authentication password | `demo`                                            |
| `DEBUG`             | Enable verbose output   | `false`                                           |

## What It Checks

### 1. REST API (`/engine`)

Verifies the REST API is accessible and returns valid engine information.

```
Checking REST API: https://operaton-doc.open-regels.nl/engine-rest
  ✓ REST API accessible
  ✓ Engine(s): default
```

### 2. Version Info (`/version`)

Retrieves and displays the Operaton version.

```
Checking Version Info:
  Version: 1.0.0
```

### 3. Deployment Endpoint (`/deployment`)

Confirms the deployment API is available and shows current deployment count.

```
Checking Deployment Endpoint:
  ✓ Deployment endpoint accessible
  ✓ Current deployments: 2
```

### 4. Web Applications

Tests accessibility of all four Operaton web applications:

```
Checking Web Apps: https://operaton-doc.open-regels.nl
  ✓ Cockpit accessible
  ✓ Tasklist accessible
  ✓ Admin accessible
  ✓ Welcome accessible
```

## Exit Codes

| Code | Meaning               |
| ---- | --------------------- |
| `0`  | Connection successful |
| `1`  | Connection failed     |

## Error Handling

The script provides detailed error messages for common failure scenarios:

### HTTP Status Errors

| Status | Message               | Likely Cause                           |
| ------ | --------------------- | -------------------------------------- |
| 400    | Bad request           | Invalid API endpoint format            |
| 401    | Authentication failed | Wrong username/password                |
| 403    | Access forbidden      | IP restrictions or invalid credentials |
| 404    | Endpoint not found    | Wrong `OPERATON_REST_URL`              |
| 500    | Server error          | Check Operaton server logs             |
| 502    | Bad gateway           | Reverse proxy misconfiguration         |
| 503    | Service unavailable   | Operaton starting up or overloaded     |
| 504    | Gateway timeout       | Server too slow to respond             |

### Network Errors

| Code                          | Message                 | Likely Cause              |
| ----------------------------- | ----------------------- | ------------------------- |
| `ECONNREFUSED`                | Connection refused      | Operaton not running      |
| `ENOTFOUND`                   | Host not found          | Wrong URL or DNS issue    |
| `ECONNRESET`                  | Connection reset        | Network instability       |
| `ETIMEDOUT`                   | Connection timed out    | Server unreachable        |
| `CERT_HAS_EXPIRED`            | SSL certificate expired | Certificate needs renewal |
| `DEPTH_ZERO_SELF_SIGNED_CERT` | Self-signed certificate | Trust the certificate     |
| `ENETUNREACH`                 | Network unreachable     | No network connectivity   |

## Debug Mode

Enable debug mode for additional diagnostic information:

```bash
DEBUG=true make check
```

Debug mode displays:

- Full configuration (with masked password)
- Detailed error responses
- Stack traces for unexpected errors

Example debug output:

```
Configuration:
  REST URL: https://operaton-doc.open-regels.nl/engine-rest
  Web URL: https://operaton-doc.open-regels.nl
  Username: demo
  Password: ****
```

## Troubleshooting Guide

### Connection Refused

```
✗ REST API not accessible
  Code: ECONNREFUSED
  → Connection refused. Is Operaton running?
```

**Solutions:**

1. Verify Operaton is running: `docker ps` or check your deployment
2. Check the port is correct in `OPERATON_REST_URL`
3. Ensure no firewall is blocking the connection

### Authentication Failed

```
✗ REST API not accessible
  Status: 401
  → Authentication failed. Check username/password in .env file
```

**Solutions:**

1. Verify credentials in `.env` file
2. Check if the user exists in Operaton Admin
3. Ensure the user has appropriate permissions

### Host Not Found

```
✗ REST API not accessible
  Code: ENOTFOUND
  → Host not found. Check OPERATON_REST_URL in .env
```

**Solutions:**

1. Verify the URL is correct (no typos)
2. Check DNS resolution: `nslookup your-operaton-host.com`
3. Try using IP address instead of hostname

### SSL Certificate Issues

```
✗ REST API not accessible
  Code: CERT_HAS_EXPIRED
  → SSL certificate has expired. Contact server administrator
```

**Solutions:**

1. Renew the SSL certificate
2. For self-signed certificates, set `NODE_TLS_REJECT_UNAUTHORIZED=0` (development only!)
3. Add the certificate to your system's trust store

### Behind a Reverse Proxy (e.g., Caddy, nginx)

If Operaton runs behind a reverse proxy:

1. Ensure the proxy forwards requests correctly
2. Check that `/engine-rest` path is not being rewritten
3. Verify SSL termination is configured properly
4. HTTP to HTTPS redirects should work automatically

## Testing

### Chaos Tests

Run chaos tests to verify error handling:

```bash
# Run all chaos tests
make chaos-check

# Run with debug output
make chaos-check-debug
```

### Test Coverage

The chaos test suite (`tests/chaos-check-connection.js`) covers:

| Category               | Tests                                                    |
| ---------------------- | -------------------------------------------------------- |
| Invalid URLs           | Non-existent host, malformed URL, wrong port, wrong path |
| Network edge cases     | Long URLs, spaces in URL, query parameters, localhost    |
| Debug mode             | Configuration display, error code display                |
| Successful connections | Valid credentials, HTTP to HTTPS redirect                |

### Running Individual Tests

```bash
# Run chaos tests directly
node tests/chaos-check-connection.js

# With debug output for failed tests
DEBUG=true node tests/chaos-check-connection.js
```

## Integration with Other Scripts

After a successful connection check, you can proceed with:

```bash
make deploy    # Deploy BPMN/DMN processes
make data      # Generate test data
make capture   # Capture screenshots
make quick     # Run deploy → data → capture
```

## Example Output

### Successful Connection

```
══════════════════════════════════════════════════
  Operaton Connection Check
══════════════════════════════════════════════════

Checking REST API: https://operaton-doc.open-regels.nl/engine-rest
  ✓ REST API accessible
  ✓ Engine(s): default

Checking Version Info:
  Version: 1.0.0

Checking Deployment Endpoint:
  ✓ Deployment endpoint accessible
  ✓ Current deployments: 2

Checking Web Apps: https://operaton-doc.open-regels.nl
  ✓ Cockpit accessible
  ✓ Tasklist accessible
  ✓ Admin accessible
  ✓ Welcome accessible

══════════════════════════════════════════════════
  ✓ Connection successful!
══════════════════════════════════════════════════

You can now run:
  make deploy   # Deploy processes
  make data     # Generate test data
  make capture  # Capture screenshots
```

### Failed Connection

```
══════════════════════════════════════════════════
  Operaton Connection Check
══════════════════════════════════════════════════

Checking REST API: http://localhost:59999/engine-rest
  ✗ REST API not accessible
    Code: ECONNREFUSED
    → Connection refused. Is Operaton running?

══════════════════════════════════════════════════
  ✗ Connection failed
══════════════════════════════════════════════════

Troubleshooting:
  1. Verify Operaton is running
  2. Check .env file configuration
  3. Verify network connectivity
  4. Run with DEBUG=true for more details
```

## Related Files

| File                              | Description            |
| --------------------------------- | ---------------------- |
| `scripts/check-connection.js`     | Main script            |
| `tests/chaos-check-connection.js` | Chaos test suite       |
| `.env`                            | Configuration file     |
| `.env.example`                    | Configuration template |
