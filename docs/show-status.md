# show-status.js

Displays the current state of an Operaton environment by querying various REST API endpoints and
presenting counts in a structured format.

## Overview

This script provides a quick overview of:

- Deployed processes, decisions, and cases
- Running process instances and tasks
- Job and incident status
- User and group counts

Use it to verify the environment state before and after running automation scripts.

## Usage

```bash
# Via Make (recommended)
make status

# Via npm
npm run status

# Direct execution
node scripts/show-status.js

# With debug output
make status-debug
DEBUG=true npm run status
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

## Output Sections

### Deployments

Shows counts for deployed artifacts:

```
──────────────────────────────────────────────────
  Deployments
──────────────────────────────────────────────────
  Deployments:                2
  Process definitions:        3
  Decision definitions:       4
  Case definitions:           0
```

| Metric               | API Endpoint                 | Description                |
| -------------------- | ---------------------------- | -------------------------- |
| Deployments          | `/deployment/count`          | Number of deployment units |
| Process definitions  | `/process-definition/count`  | BPMN process definitions   |
| Decision definitions | `/decision-definition/count` | DMN decision definitions   |
| Case definitions     | `/case-definition/count`     | CMMN case definitions      |

### Runtime

Shows the current execution state:

```
──────────────────────────────────────────────────
  Runtime
──────────────────────────────────────────────────
  Running instances:          8
  Tasks:                      6
  External tasks:             0
  Jobs:                       0
  Failed jobs:                0
  Incidents:                  0
```

| Metric            | API Endpoint                    | Description                        |
| ----------------- | ------------------------------- | ---------------------------------- |
| Running instances | `/process-instance/count`       | Active process instances           |
| Tasks             | `/task/count`                   | User tasks awaiting action         |
| External tasks    | `/external-task/count`          | Tasks for external workers         |
| Jobs              | `/job/count`                    | Scheduled async jobs               |
| Failed jobs       | `/job/count?withException=true` | Jobs that failed execution         |
| Incidents         | `/incident/count`               | Runtime errors requiring attention |

### History

Shows historical data:

```
──────────────────────────────────────────────────
  History
──────────────────────────────────────────────────
  Historic instances:         8
```

| Metric             | API Endpoint                      | Description                         |
| ------------------ | --------------------------------- | ----------------------------------- |
| Historic instances | `/history/process-instance/count` | All instances (completed + running) |

### Identity

Shows user management data:

```
──────────────────────────────────────────────────
  Identity
──────────────────────────────────────────────────
  Users:                      1
  Groups:                     1
```

| Metric | API Endpoint   | Description      |
| ------ | -------------- | ---------------- |
| Users  | `/user/count`  | Registered users |
| Groups | `/group/count` | User groups      |

### Warnings

Displayed when issues are detected:

```
──────────────────────────────────────────────────
  Warnings
──────────────────────────────────────────────────
  ⚠ 3 incident(s) detected - run "make list-incidents" for details
  ⚠ 2 failed job(s) detected
```

## Exit Codes

| Code | Meaning                       |
| ---- | ----------------------------- |
| `0`  | Status retrieved successfully |
| `1`  | Connection failed             |

## Debug Mode

Enable debug mode for additional diagnostic information:

```bash
DEBUG=true make status
```

Debug mode displays:

- Full configuration (with masked password)
- Detailed error messages for failed API calls

Example debug output:

```
Configuration:
  REST URL: https://operaton-doc.open-regels.nl/engine-rest
  Web URL: https://operaton-doc.open-regels.nl
  Username: demo
  Password: ****
```

## Error Handling

### Connection Failure

```
✗ Cannot connect to Operaton: Connection refused

Troubleshooting:
  1. Run "make check" for detailed connection diagnostics
  2. Verify Operaton is running
  3. Check .env file configuration
```

### Partial Failures

If individual endpoints fail while the connection succeeds, affected metrics show `?`:

```
  Running instances:          8
  Tasks:                      ?
  External tasks:             0
```

In debug mode, the specific error for each failed endpoint is logged.

## Typical Use Cases

### Before Running Automation

Check the starting state:

```bash
make status
# Note: 0 deployments, 0 instances

make deploy
make status
# Note: 2 deployments, 3 process definitions
```

### After Data Generation

Verify data was created:

```bash
make data
make status
# Note: Running instances, tasks, users increased
```

### Troubleshooting Incidents

Check for problems:

```bash
make status
# Shows: ⚠ 3 incident(s) detected

make list-incidents
# Shows detailed incident information
```

### Before Reset

Confirm what will be deleted:

```bash
make status
# Review all counts

make reset-force
make status
# Verify everything is cleared
```

## Testing

### Chaos Tests

Run chaos tests to verify error handling:

```bash
# Run all chaos tests
make chaos-status

# Run with debug output
make chaos-status-debug
```

### Test Coverage

The chaos test suite (`tests/chaos-show-status.js`) covers:

| Category              | Tests                                                  |
| --------------------- | ------------------------------------------------------ |
| Connection failures   | Non-existent host, wrong port, invalid URL, wrong path |
| Debug mode            | Configuration display, error details                   |
| Successful connection | All sections displayed, stats verification             |
| Output format         | Headers, troubleshooting on failure                    |

## Example Output

### Successful Status

```
══════════════════════════════════════════════════
  Operaton Environment Status
══════════════════════════════════════════════════

Target: https://operaton-doc.open-regels.nl/engine-rest

✓ Connected to engine: default

──────────────────────────────────────────────────
  Deployments
──────────────────────────────────────────────────
  Deployments:                2
  Process definitions:        3
  Decision definitions:       4
  Case definitions:           0

──────────────────────────────────────────────────
  Runtime
──────────────────────────────────────────────────
  Running instances:          8
  Tasks:                      6
  External tasks:             0
  Jobs:                       0
  Failed jobs:                0
  Incidents:                  0

──────────────────────────────────────────────────
  History
──────────────────────────────────────────────────
  Historic instances:         8

──────────────────────────────────────────────────
  Identity
──────────────────────────────────────────────────
  Users:                      1
  Groups:                     1

══════════════════════════════════════════════════
```

### Connection Failure

```
══════════════════════════════════════════════════
  Operaton Environment Status
══════════════════════════════════════════════════

Target: http://localhost:59999/engine-rest

✗ Cannot connect to Operaton: Connection refused

Troubleshooting:
  1. Run "make check" for detailed connection diagnostics
  2. Verify Operaton is running
  3. Check .env file configuration
```

## Related Commands

| Command                 | Description                     |
| ----------------------- | ------------------------------- |
| `make check`            | Detailed connection diagnostics |
| `make list-deployments` | List deployment details         |
| `make list-instances`   | List running instances          |
| `make list-incidents`   | List incident details           |
| `make list-tasks`       | List current tasks              |

## Related Files

| File                         | Description        |
| ---------------------------- | ------------------ |
| `scripts/show-status.js`     | Main script        |
| `tests/chaos-show-status.js` | Chaos test suite   |
| `.env`                       | Configuration file |

## Future Ideas

- Add `--json` flag for machine-readable output
- Add `--watch` mode for continuous monitoring
- Show detailed lists with `--verbose` flag (deployment names, task assignees)
- Add comparison mode to show changes since last run
- Include response times for performance monitoring
