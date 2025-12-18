# create-incidents.js

Creates intentional incidents and failed jobs for screenshot capture and testing error handling
views in Operaton.

## Overview

This script generates various error states to demonstrate:

- Cockpit incident views
- Failed job drill-down
- Job retry functionality
- External task failure handling

## Usage

```bash
# Via Make (recommended) - creates all incident types
make incidents

# With debug output
make incidents-debug
DEBUG=true npm run incidents

# Specific incident types only
make incidents-script       # Script task incidents
make incidents-service      # Service task incidents
make incidents-expression   # Expression evaluation incidents
make incidents-job          # Job/external task incidents

# Via npm
npm run incidents
npm run incidents -- --script-errors
```

## Configuration

The script reads configuration from environment variables (`.env` file):

| Variable            | Description             | Default                                           |
| ------------------- | ----------------------- | ------------------------------------------------- |
| `OPERATON_REST_URL` | REST API endpoint       | `https://operaton-doc.open-regels.nl/engine-rest` |
| `OPERATON_BASE_URL` | Web UI base URL         | `https://operaton-doc.open-regels.nl`             |
| `OPERATON_USERNAME` | Authentication username | `demo`                                            |
| `OPERATON_PASSWORD` | Authentication password | `demo`                                            |
| `DEBUG`             | Enable verbose output   | `false`                                           |

## Command Line Options

| Flag                  | Description                                       |
| --------------------- | ------------------------------------------------- |
| `--script-errors`     | Create only script task incidents                 |
| `--service-errors`    | Create only service task incidents                |
| `--expression-errors` | Create only expression evaluation incidents       |
| `--job-errors`        | Create only async job and external task incidents |

When no flags are provided, all incident types are created.

## Incident Types Created

### 1. Script Task Incidents (3 instances)

Deploys `failing-script-process` with a JavaScript script that throws an error:

```javascript
throw new Error('Intentional script failure for incident demo');
```

**Incident message:** `Unable to evaluate script while executing activity 'failingScript'`

### 2. Service Task Incidents (2 instances)

Deploys `failing-service-process` with a delegate expression referencing a non-existent bean:

```xml
<serviceTask camunda:delegateExpression="${nonExistentBean}" />
```

**Incident message:** `Unknown property used in expression: ${nonExistentBean}`

### 3. Expression Evaluation Incidents (1 instance)

Deploys `failing-expression-process` with a gateway that references an undefined variable:

```xml
<conditionExpression>${undefinedVariable == true}</conditionExpression>
```

**Incident message:** `Unknown property used in expression: ${undefinedVariable}`

### 4. Async Job Incidents (2 instances)

Deploys `failing-job-process` with a service task referencing a non-existent Java class:

```xml
<serviceTask camunda:class="org.operaton.NonExistentClass" />
```

**Incident message:** `Cannot load class 'org.operaton.NonExistentClass'`

### 5. External Task Incidents (2 instances)

Deploys `external-task-process` with an external task, then:

1. Fetches the tasks
2. Fails them with `retries: 0`

**Incident message:** `Intentional failure for incident demo`

## Exit Codes

| Code | Meaning                        |
| ---- | ------------------------------ |
| `0`  | Incidents created successfully |
| `1`  | Connection failed              |

## Debug Mode

Enable debug mode for additional diagnostic information:

```bash
DEBUG=true make incidents
```

Debug mode displays:

- Full configuration (with masked password)
- Deployment IDs
- Process instance IDs
- Detailed error messages

## Example Output

```
════════════════════════════════════════════════════════════
  Operaton Incident Creator
════════════════════════════════════════════════════════════

Target: https://operaton-doc.open-regels.nl/engine-rest

✓ Connected to engine: default

──────────────────────────────────────────────────
  Creating Script Task Incidents
──────────────────────────────────────────────────
  ✓ Deployed: failing-script-process
  Starting failing script instance 1...
  Starting failing script instance 2...
  Starting failing script instance 3...
  Waiting for job execution...

──────────────────────────────────────────────────
  Creating Service Task Incidents
──────────────────────────────────────────────────
  ✓ Deployed: failing-service-process
  Starting failing service instance 1...
  Starting failing service instance 2...
  Waiting for job execution...

──────────────────────────────────────────────────
  Creating Expression Evaluation Incidents
──────────────────────────────────────────────────
  ✓ Deployed: failing-expression-process
  Starting instance without required variable...

──────────────────────────────────────────────────
  Creating Async Job Incidents
──────────────────────────────────────────────────
  ✓ Deployed: failing-job-process
  Starting async failing instance 1...
  Starting async failing instance 2...
  Waiting for job execution...

──────────────────────────────────────────────────
  Creating External Task Incidents
──────────────────────────────────────────────────
  ✓ Deployed: external-task-process
  Starting external task instance 1...
  Starting external task instance 2...
  Fetching external tasks to fail them...
  Found 2 external task(s)
  ✓ Failed external task 00defbfa...
  ✓ Failed external task 01137980...

════════════════════════════════════════════════════════════
  Incident Creation Summary
════════════════════════════════════════════════════════════
  Deployments:     5 created, 0 failed
  Instances:       9 started, 1 failed immediately
  External tasks:  2 failed

  Total incidents: 9
  Failed jobs:     7

  Incidents by type:
    failedExternalTask: 2
    failedJob: 7
════════════════════════════════════════════════════════════

✓ Incidents created successfully
```

## Testing

### Chaos Tests

Run chaos tests to verify error handling:

```bash
# Run all chaos tests
make chaos-incidents

# Run with debug output
DEBUG=true make chaos-incidents
```

### Test Coverage

The chaos test suite (`tests/chaos-create-incidents.js`) covers:

| Category              | Tests                                                 |
| --------------------- | ----------------------------------------------------- |
| Connection failures   | Non-existent host, connection refused                 |
| Debug mode            | Configuration display                                 |
| Successful operations | Connection, script incidents, external task incidents |
| Flag handling         | Script-only, expression-only                          |
| Output format         | Header, summary section                               |

## Typical Workflow

```bash
# 1. Reset environment
make reset-force

# 2. Deploy processes
make deploy

# 3. Generate normal test data
make data

# 4. Create incidents
make incidents

# 5. Verify
make status
make list-incidents

# 6. Capture screenshots
make capture
```

## Viewing Incidents

After running the script, you can view incidents in:

1. **Cockpit Dashboard** - Shows incident count
2. **Cockpit > Incidents** - Lists all incidents with details
3. **Process Instance View** - Shows incidents on the BPMN diagram
4. **Job View** - Shows failed jobs with stack traces

Or via CLI:

```bash
make list-incidents    # JSON output of all incidents
make status            # Summary with warnings
```

## Cleanup

To remove all incident-related data:

```bash
make reset-force
```

This will delete:

- All process instances (including failed ones)
- All deployments (including failing processes)
- All incidents and failed jobs

## Related Commands

| Command               | Description               |
| --------------------- | ------------------------- |
| `make deploy`         | Deploy processes first    |
| `make data`           | Generate normal test data |
| `make status`         | View incident counts      |
| `make list-incidents` | List all incidents (JSON) |
| `make reset`          | Clean up everything       |

## Related Files

| File                              | Description      |
| --------------------------------- | ---------------- |
| `scripts/create-incidents.js`     | Main script      |
| `tests/chaos-create-incidents.js` | Chaos test suite |

## Future Ideas

- Timer-based incidents (jobs that fail after delay)
- Message correlation failures
- Multi-instance failures
- Subprocess incident propagation
- Incident resolution/retry automation
- Custom incident messages via configuration
- Batch operation failures
- History cleanup job failures
