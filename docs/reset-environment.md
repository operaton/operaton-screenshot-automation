# reset-environment.js

Resets the Operaton environment by deleting deployments, instances, history, and test data.

## Overview

This script cleans up the Operaton instance by deleting:

- Process instances (running and completed)
- Historic process instances
- Decision instances
- Deployments (BPMN, DMN, CMMN)
- Jobs and batches
- Created test users and groups

## Usage

```bash
# Via Make (with confirmation prompt)
make reset

# Force reset without confirmation
make reset-force

# With debug output
make reset-debug
DEBUG=true npm run reset -- --force

# Via npm
npm run reset
npm run reset -- --force
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

| Flag                 | Short | Description                   |
| -------------------- | ----- | ----------------------------- |
| `--force`            | `-f`  | Skip confirmation prompt      |
| `--instances-only`   |       | Delete only process instances |
| `--deployments-only` |       | Delete only deployments       |
| `--history-only`     |       | Delete only history data      |
| `--users-only`       |       | Delete only users and groups  |

## What Gets Deleted

### Full Reset (default)

When running without flags, the script deletes everything in this order:

1. **Jobs** - Pending and failed jobs
2. **Process instances** - All running instances
3. **Historic instances** - Completed process history
4. **Decision instances** - DMN evaluation history
5. **Batches** - Running and historic batches
6. **Deployments** - All BPMN/DMN/CMMN definitions
7. **Users** - Test users (john, mary, peter)
8. **Groups** - Test groups (accounting, management, sales)

### Protected Resources

The following are NOT deleted:

- **demo** user - Default admin user
- **operaton-admin** group - Default admin group
- System configurations

## Exit Codes

| Code | Meaning                           |
| ---- | --------------------------------- |
| `0`  | Reset completed successfully      |
| `1`  | Connection failed or user aborted |

## Debug Mode

Enable debug mode for additional diagnostic information:

```bash
DEBUG=true make reset-force
```

Debug mode displays:

- Full configuration (with masked password)
- Instance IDs being deleted
- Detailed error messages for failed deletions

## Example Output

### Full Reset

```
════════════════════════════════════════════════════════════
  Operaton Environment Reset
════════════════════════════════════════════════════════════

Target: https://operaton-doc.open-regels.nl/engine-rest

✓ Connected to engine: default

Deleting jobs...
  No jobs found

Deleting process instances...
  Found 5 running instance(s)
  ✓ Deleted 5 process instance(s)

Deleting historic process instances...
  Found 12 historic instance(s)
  ✓ Deleted 12 historic instance(s)

Deleting decision instances...
  Found 8 decision instance(s)
  ✓ Deleted 8 decision instance(s)

Deleting historic batches...
  No historic batches found

Deleting batches...
  No batches found

Deleting deployments...
  Found 4 deployment(s)
    Deleted: Invoice
    Deleted: Invoice Assign Approver
    Deleted: Heusdenpas
    Deleted: DinnerDecisions
  ✓ Deleted 4 deployment(s)

Deleting created users...
    Deleted user: john
    Deleted user: mary
    Deleted user: peter
  ✓ Deleted 3 user(s)

Deleting created groups...
    Deleted group: accounting
    Deleted group: management
    Deleted group: sales
  ✓ Deleted 3 group(s)

════════════════════════════════════════════════════════════
  Reset Summary
════════════════════════════════════════════════════════════
  Process instances:   5
  Historic instances:  12
  Decision instances:  8
  Deployments:         4
  Jobs:                0
  Batches:             0
  Historic batches:    0
  Users:               3
  Groups:              3
════════════════════════════════════════════════════════════

✓ Environment reset complete

To start fresh, run:
  make deploy     # Deploy processes
  make data       # Generate test data
```

### Connection Failure

```
════════════════════════════════════════════════════════════
  Operaton Environment Reset
════════════════════════════════════════════════════════════

Target: http://localhost:8080/engine-rest

✗ Cannot connect to Operaton: Connection refused - is Operaton running?

Troubleshooting:
  1. Run "make check" for detailed connection diagnostics
  2. Verify Operaton is running
  3. Check .env file configuration
```

## Selective Reset

### Instances Only

Delete running and historic process instances without removing deployments:

```bash
make reset-instances
```

Useful when you want to clear test data but keep process definitions.

### Deployments Only

Delete all deployments (automatically deletes instances first):

```bash
make reset-deployments
```

### History Only

Delete only history data (historic instances, decision instances, historic batches):

```bash
make reset-history
```

### Users Only

Delete only test users and groups:

```bash
make reset-users
```

## Typical Workflow

### Development Cycle

```bash
# 1. Deploy processes
make deploy

# 2. Generate test data
make data

# 3. Work with the application...

# 4. Reset when done
make reset-force
```

### Before Screenshots

```bash
# Clean slate
make reset-force

# Fresh deployment
make deploy

# Generate specific data for screenshots
make data

# Capture screenshots
make capture
```

## Testing

### Chaos Tests

Run chaos tests to verify error handling:

```bash
# Run all chaos tests
make chaos-reset

# Run with debug output
make chaos-reset-debug
```

**Note:** Chaos tests run against the live Operaton instance with `--force` flag. This means running
`make chaos-reset` will actually reset your environment. This is expected behavior - always run
chaos tests in a development/test environment.

### Test Coverage

The chaos test suite (`tests/chaos-reset-environment.js`) covers:

| Category              | Tests                                     |
| --------------------- | ----------------------------------------- |
| Connection failures   | Non-existent host, connection refused     |
| Debug mode            | Configuration display                     |
| Successful operations | Connection, force mode, deletion progress |
| Flag handling         | Instances-only, deployments-only          |
| Output format         | Header, summary section                   |

## Error Handling

The script handles various error scenarios:

| Error                     | Behavior                           |
| ------------------------- | ---------------------------------- |
| Connection refused        | Exit with troubleshooting tips     |
| Instance deletion fails   | Retry with force options, continue |
| Deployment deletion fails | Log warning, continue with others  |
| User not found            | Skip silently (already deleted)    |

## Safety Features

1. **Confirmation prompt** - Requires explicit `y` to proceed (unless `--force`)
2. **Protected users** - Never deletes `demo` user
3. **Protected groups** - Never deletes `operaton-admin` group
4. **Cascade delete** - Deployments deleted with cascade to clean up properly

## Related Commands

| Command       | Description                  |
| ------------- | ---------------------------- |
| `make deploy` | Deploy processes after reset |
| `make data`   | Generate test data           |
| `make status` | Check environment state      |
| `make check`  | Verify connection            |

## Related Files

| File                               | Description      |
| ---------------------------------- | ---------------- |
| `scripts/reset-environment.js`     | Main script      |
| `tests/chaos-reset-environment.js` | Chaos test suite |

## Future Ideas

- Dry-run mode to preview what would be deleted without actually deleting
- Backup/export data before reset (JSON dump of instances, variables)
- Selective deployment deletion by name or pattern (e.g., `--deployment=Invoice*`)
- Configurable user/group lists via environment variable or config file
- Reset only data older than N days (preserve recent work)
- Interactive mode to select what to delete
- Restore from backup after reset
- Tenant-specific reset for multi-tenant environments
- Batch deletion for large datasets (pagination beyond 1000 items)
- Webhook/notification on reset completion
