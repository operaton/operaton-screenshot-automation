# deploy-processes.js

Deploys BPMN, DMN, and CMMN process definitions to Operaton via the REST API.

## Overview

This script automatically discovers and deploys process files:

1. Scans the `processes/` directory for `.bpmn`, `.dmn`, and `.cmmn` files
2. Connects to Operaton via REST API
3. Deploys each file with duplicate filtering
4. Reports deployment status and summary

## Usage

```bash
# Via Make (recommended)
make deploy

# With debug output
make deploy-debug
DEBUG=true npm run deploy

# Via npm
npm run deploy
```

## Configuration

The script reads configuration from environment variables (`.env` file):

| Variable            | Description                        | Default                                           |
| ------------------- | ---------------------------------- | ------------------------------------------------- |
| `OPERATON_REST_URL` | REST API endpoint                  | `https://operaton-doc.open-regels.nl/engine-rest` |
| `OPERATON_BASE_URL` | Web UI base URL                    | `https://operaton-doc.open-regels.nl`             |
| `OPERATON_USERNAME` | Authentication username            | `demo`                                            |
| `OPERATON_PASSWORD` | Authentication password            | `demo`                                            |
| `PROCESSES_DIR`     | Directory containing process files | `./processes`                                     |
| `DEPLOYMENT_SOURCE` | Source identifier in Cockpit       | `screenshot-automation`                           |
| `DEBUG`             | Enable verbose output              | `false`                                           |

## Directory Structure

The script auto-discovers files in the processes directory:

```
processes/
├── bpmn/
│   ├── invoice.bpmn
│   └── order-process.bpmn
├── dmn/
│   ├── invoice-assign-approver.dmn
│   └── dish-decision.dmn
└── cmmn/
    └── loan-application.cmmn
```

Files can also be placed directly in `processes/` without subdirectories - the script scans
recursively for all supported extensions.

## File Requirements

### BPMN Files

BPMN files must include:

- `camunda:historyTimeToLive` attribute on the process element
- Valid sequence flows connecting all elements

```xml
<bpmn:process id="my-process" name="My Process"
              isExecutable="true"
              camunda:historyTimeToLive="30">
```

### DMN Files

DMN files must include:

- `camunda:historyTimeToLive` attribute on the decision element
- Valid decision table with input/output definitions

```xml
<decision id="my-decision" name="My Decision"
          camunda:historyTimeToLive="30">
```

## Deployment Options

The script uses these deployment options:

| Option                       | Value                   | Description                    |
| ---------------------------- | ----------------------- | ------------------------------ |
| `deployment-name`            | Derived from filename   | Name shown in Cockpit          |
| `deployment-source`          | `screenshot-automation` | Source identifier              |
| `enable-duplicate-filtering` | `true`                  | Skip unchanged deployments     |
| `deploy-changed-only`        | `true`                  | Only deploy modified resources |

## Exit Codes

| Code | Meaning                                                      |
| ---- | ------------------------------------------------------------ |
| `0`  | All deployments successful                                   |
| `1`  | Connection failed, directory not found, or deployment failed |

## Debug Mode

Enable debug mode for additional diagnostic information:

```bash
DEBUG=true make deploy
```

Debug mode displays:

- Full configuration (with masked password)
- Processes directory path
- File scanning patterns
- File sizes being deployed
- Detailed error responses

Example debug output:

```
Configuration:
  REST URL: https://operaton-doc.open-regels.nl/engine-rest
  Web URL: https://operaton-doc.open-regels.nl
  Username: demo
  Password: ****
  Processes dir: /path/to/processes

    [DEBUG] Scanning for bpmn files: /path/to/processes/**/*.bpmn
    [DEBUG] Deploying file: invoice.bpmn (10492 bytes)
```

## Example Output

### Successful Deployment

```
════════════════════════════════════════════════════════════
  Operaton Process Deployment
════════════════════════════════════════════════════════════

Target: https://operaton-doc.open-regels.nl/engine-rest

✓ Connected to engine: default

──────────────────────────────────────────────────
  Existing Deployments
──────────────────────────────────────────────────
  - Invoice Receipt (4326cc96...)
  - DinnerDecisions (a2a92228...)

──────────────────────────────────────────────────
  Deploying BPMN Processes
──────────────────────────────────────────────────
  ✓ Deployed: Invoice
    ID: 082792a4-d689-11f0-aba7-02295043e507
    Processes: 1

──────────────────────────────────────────────────
  Deploying DMN Decisions
──────────────────────────────────────────────────
  ✓ Deployed: Invoice Assign Approver
    ID: 083aa577-d689-11f0-aba7-02295043e507
    Decisions: 1

════════════════════════════════════════════════════════════
  Deployment Summary
════════════════════════════════════════════════════════════
  Deployed: 2
  Failed:   0
════════════════════════════════════════════════════════════
```

### Connection Failure

```
════════════════════════════════════════════════════════════
  Operaton Process Deployment
════════════════════════════════════════════════════════════

Target: http://localhost:8080/engine-rest

✗ Cannot connect to Operaton: Connection refused - is Operaton running?

Troubleshooting:
  1. Run "make check" for detailed connection diagnostics
  2. Verify Operaton is running
  3. Check .env file configuration
```

### No Process Files Found

```
════════════════════════════════════════════════════════════
  Operaton Process Deployment
════════════════════════════════════════════════════════════

Target: https://operaton-doc.open-regels.nl/engine-rest

✓ Connected to engine: default

⚠ No process files found

Expected directory structure:
  /path/to/processes/
    ├── bpmn/
    │   └── *.bpmn
    ├── dmn/
    │   └── *.dmn
    └── cmmn/
        └── *.cmmn
```

## Error Handling

The script handles various error scenarios:

| Error                 | Message                                     | Solution                              |
| --------------------- | ------------------------------------------- | ------------------------------------- |
| Connection refused    | `Connection refused - is Operaton running?` | Start Operaton or check URL           |
| Host not found        | `Host not found`                            | Verify `OPERATON_REST_URL`            |
| Authentication failed | `Authentication failed`                     | Check username/password               |
| Bad request (400)     | `Bad request - check file format`           | Validate BPMN/DMN syntax              |
| Server error (500)    | `Server error`                              | Check file content, historyTimeToLive |

## Naming Convention

Deployment names are derived from filenames:

| Filename                      | Deployment Name         |
| ----------------------------- | ----------------------- |
| `invoice.bpmn`                | Invoice                 |
| `invoice-assign-approver.dmn` | Invoice Assign Approver |
| `order_process.bpmn`          | Order Process           |

The script converts hyphens and underscores to spaces and capitalizes each word.

## Testing

### Chaos Tests

Run chaos tests to verify error handling:

```bash
# Run all chaos tests
make chaos-deploy

# Run with debug output
make chaos-deploy-debug
```

### Test Coverage

The chaos test suite (`tests/chaos-deploy-processes.js`) covers:

| Category              | Tests                                 |
| --------------------- | ------------------------------------- |
| Connection failures   | Non-existent host, connection refused |
| Directory errors      | Missing directory, empty directory    |
| Debug mode            | Configuration display                 |
| Successful deployment | BPMN discovery, DMN discovery         |
| Output format         | Header, summary section               |

## Typical Workflow

### 1. Check Connection

```bash
make check
```

### 2. Deploy Processes

```bash
make deploy
```

### 3. Generate Test Data

```bash
make data
```

### 4. Capture Screenshots

```bash
make capture
```

## Related Commands

| Command       | Description                 |
| ------------- | --------------------------- |
| `make check`  | Verify Operaton connection  |
| `make status` | Show environment statistics |
| `make data`   | Generate test data          |
| `make reset`  | Reset environment           |

## Related Files

| File                              | Description             |
| --------------------------------- | ----------------------- |
| `scripts/deploy-processes.js`     | Main script             |
| `tests/chaos-deploy-processes.js` | Chaos test suite        |
| `processes/`                      | Process files directory |

## Future Ideas

- Support for tenant-specific deployments
- Dry-run mode to validate files without deploying
- Selective deployment by file pattern or type
- Rollback/undeploy functionality
- Deployment versioning and history tracking
