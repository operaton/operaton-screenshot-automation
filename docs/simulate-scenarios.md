# simulate-scenarios.js

Simulates various process scenarios to create rich data for screenshot capture and documentation.

## Overview

This script creates diverse process states to demonstrate:

- Token positions at different activities
- Completed instances for history views
- Tasks in various states (assigned, unassigned, overdue, follow-up)

## Usage

```bash
# Via Make (recommended) - runs all scenarios
make simulate

# With debug output
make simulate-debug
DEBUG=true npm run simulate

# Specific scenarios only
make simulate-tokens    # Token position scenarios
make simulate-history   # History data (completed instances)
make simulate-tasks     # Task state scenarios

# Via npm
npm run simulate
npm run simulate -- --tokens
npm run simulate -- --history
npm run simulate -- --tasks
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

| Flag        | Description                                    |
| ----------- | ---------------------------------------------- |
| `--tokens`  | Create only token position scenarios           |
| `--history` | Create only history data (completed instances) |
| `--tasks`   | Create only task state scenarios               |

When no flags are provided, all scenarios are created.

## Scenarios Created

### 1. Token Position Scenarios (3 instances)

Creates process instances with tokens at specific activities for BPMN diagram screenshots:

| Scenario          | Token Position        | Variables                       |
| ----------------- | --------------------- | ------------------------------- |
| TOKEN-APPROVE-001 | Approve Invoice       | Approver: john                  |
| TOKEN-REVIEW-001  | Review Invoice        | Approver: mary, approved: false |
| TOKEN-BANK-001    | Prepare Bank Transfer | Approver: peter, approved: true |

### 2. History Data Scenarios (10 instances)

Creates completed instances with various paths through the process:

| Path                            | Count | Description            |
| ------------------------------- | ----- | ---------------------- |
| Approved → Bank Transfer        | 7     | Standard approval path |
| Rejected → Not Clarified        | 2     | Rejected and closed    |
| Rejected → Clarified → Approved | 1     | Full review cycle      |

### 3. Task State Scenarios (6 instances)

Creates tasks demonstrating different states in Tasklist:

| Scenario       | State      | Description                            |
| -------------- | ---------- | -------------------------------------- |
| TASK-U-001     | Unassigned | Task with candidate group (accounting) |
| TASK-A-001     | Assigned   | Task assigned to demo user             |
| TASK-O-001     | Overdue    | Task with due date in the past         |
| TASK-F-001     | Follow-up  | Task with follow-up date tomorrow      |
| TASK-M-001/002 | Multiple   | Multiple tasks for same user (mary)    |

## Exit Codes

| Code | Meaning                                        |
| ---- | ---------------------------------------------- |
| `0`  | Simulation completed successfully              |
| `1`  | Connection failed or invoice process not found |

## Prerequisites

Before running this script:

1. **Deploy processes**: `make deploy`
2. **Create users/groups**: `make data`

The script requires the `invoice` process to be deployed.

## Debug Mode

Enable debug mode for additional diagnostic information:

```bash
DEBUG=true make simulate
```

Debug mode displays:

- Full configuration (with masked password)
- Process instance IDs
- Task completion details
- API error details

## Example Output

```
════════════════════════════════════════════════════════════
  Operaton Simulation Scenarios
════════════════════════════════════════════════════════════

Target: https://operaton-doc.open-regels.nl/engine-rest

✓ Connected to engine: default
✓ Found invoice process: Invoice Receipt

──────────────────────────────────────────────────
  Simulating Token Positions
──────────────────────────────────────────────────
  Creating: Token at Approve Invoice
    ✓ Token at: Approve Invoice
  Creating: Token at Review Invoice
    ✓ Completed task to advance token
    ✓ Token at: Review Invoice
  Creating: Token at Prepare Bank Transfer
    ✓ Completed task to advance token
    ✓ Token at: Prepare Bank Transfer

──────────────────────────────────────────────────
  Generating History Data
──────────────────────────────────────────────────
  Processing instance 1...
  Processing instance 2...
  ...
  ✓ Created 10 completed instances for history

──────────────────────────────────────────────────
  Creating Tasks in Various States
──────────────────────────────────────────────────
  Creating: Unassigned accounting task
    ✓ Advanced to Prepare Bank Transfer (unassigned)
  Creating: Task assigned to demo
    ✓ Task created and waiting
  Creating: Overdue task
    ✓ Set task as overdue
  Creating: Task with follow-up
    ✓ Set follow-up date
  Creating: Multiple tasks scenario 1
    ✓ Task created and waiting
  Creating: Multiple tasks scenario 2
    ✓ Task created and waiting

════════════════════════════════════════════════════════════
  Simulation Summary
════════════════════════════════════════════════════════════
  Token scenarios:   3 created, 0 failed
  History instances: 10 completed, 0 failed
  Task scenarios:    6 created, 0 failed
    - Overdue tasks: 1
    - Follow-up tasks: 1
════════════════════════════════════════════════════════════

✓ Simulation complete
```

## Testing

### Chaos Tests

Run chaos tests to verify error handling:

```bash
# Run all chaos tests
make chaos-simulate

# Run with debug output
DEBUG=true make chaos-simulate
```

### Test Coverage

The chaos test suite (`tests/chaos-simulate-scenarios.js`) focuses on what can be reliably tested
without requiring pre-deployed processes:

| Category                 | Tests | Description                                       |
| ------------------------ | ----- | ------------------------------------------------- |
| Connection failures      | 2     | Non-existent host, connection refused             |
| Debug mode               | 1     | Configuration display                             |
| Successful connection    | 1     | Engine connection verification                    |
| Missing process handling | 1     | Helpful message when invoice process not deployed |
| Output format            | 2     | Header display, deploy instruction                |

**Note:** Full simulation testing (token positions, history data, task states) requires the invoice
process to be deployed first with `make deploy`.

## Typical Workflow

```bash
# 1. Reset environment
make reset-force

# 2. Deploy processes
make deploy

# 3. Generate users and groups
make data

# 4. Simulate scenarios
make simulate

# 5. Optionally add incidents
make incidents

# 6. Verify
make status

# 7. Capture screenshots
make capture
```

## Viewing Results

After running the script, you can view the data in:

### Cockpit

- **Dashboard**: Shows running instances count
- **Process Instances**: View tokens on BPMN diagram
- **History**: View completed instances

### Tasklist

- **My Tasks**: Tasks assigned to logged-in user
- **All Tasks**: Filter by assignee, due date, follow-up
- **Overdue filter**: Shows tasks past due date

### Admin

- **Users**: View created users
- **Groups**: View created groups

## Cleanup

To remove all simulation data:

```bash
make reset-force
```

This deletes all process instances, deployments, users, and groups.

## Related Commands

| Command          | Description                          |
| ---------------- | ------------------------------------ |
| `make deploy`    | Deploy processes (required first)    |
| `make data`      | Create users/groups (required first) |
| `make incidents` | Add incidents for error screenshots  |
| `make status`    | View simulation counts               |
| `make reset`     | Clean up everything                  |

## Related Files

| File                                | Description                |
| ----------------------------------- | -------------------------- |
| `scripts/simulate-scenarios.js`     | Main script                |
| `tests/chaos-simulate-scenarios.js` | Chaos test suite           |
| `processes/bpmn/invoice.bpmn`       | Invoice process definition |

## Future Ideas

- Multi-instance subprocess scenarios
- Call activity scenarios
- Timer job scenarios (jobs pending execution)
- Message correlation scenarios
- Signal event scenarios
- Parallel gateway scenarios (multiple tokens)
- Conditional event scenarios
- Configurable scenario counts via environment variables
- Custom business keys via configuration
