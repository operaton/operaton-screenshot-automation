# generate-data.js

Generates test data for Operaton screenshots including users, groups, process instances, and
decision evaluations.

## Overview

This script populates the Operaton instance with test data:

1. Creates users and groups from configuration
2. Adds users to groups (memberships)
3. Starts process instances (active and completed)
4. Evaluates decisions for history

## Usage

```bash
# Via Make (recommended)
make data

# With debug output
make data-debug
DEBUG=true npm run data

# Via npm
npm run data
```

## Configuration

The script reads configuration from environment variables (`.env` file):

| Variable            | Description              | Default                                           |
| ------------------- | ------------------------ | ------------------------------------------------- |
| `OPERATON_REST_URL` | REST API endpoint        | `https://operaton-doc.open-regels.nl/engine-rest` |
| `OPERATON_BASE_URL` | Web UI base URL          | `https://operaton-doc.open-regels.nl`             |
| `OPERATON_USERNAME` | Authentication username  | `demo`                                            |
| `OPERATON_PASSWORD` | Authentication password  | `demo`                                            |
| `CONFIG_PATH`       | Path to screenshots.json | `./config/screenshots.json`                       |
| `DEBUG`             | Enable verbose output    | `false`                                           |

## Configuration File

The script reads user and group definitions from `config/screenshots.json`:

```json
{
  "users": [
    {
      "id": "john",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "password": "john123"
    }
  ],
  "groups": [
    {
      "id": "accounting",
      "name": "Accounting",
      "type": "WORKFLOW"
    }
  ],
  "memberships": [{ "userId": "john", "groupId": "accounting" }]
}
```

### User/Group ID Restrictions

Operaton has restrictions on user and group IDs:

- No hyphens allowed (use `johnsmith` not `john-smith`)
- Alphanumeric characters only

## What Gets Created

### Users

Default users created:

- `john` - Added to accounting group
- `mary` - Added to management group
- `peter` - Added to sales group

### Groups

Default groups created:

- `accounting` - For invoice approvers
- `management` - For managers
- `sales` - For sales team

### Process Instances

The script creates:

- **5 active instances** - Waiting at "Approve Invoice" task
- **3 completed instances** - Approved and moved to next step

Each instance includes variables:

- `amount` - Random invoice amount
- `creditor` - Vendor name
- `invoiceNumber` - Unique invoice number
- `invoiceCategory` - Travel Expenses, Misc, or Software License
- `approver` - Assigned approver (john, mary, peter, or demo)

### Decision Evaluations

Evaluates the `invoice-assign-approver` decision with different amounts to create decision history.

## Exit Codes

| Code | Meaning                                                    |
| ---- | ---------------------------------------------------------- |
| `0`  | Data generation successful (or only non-critical failures) |
| `1`  | Critical failure (user/group creation failed)              |

Note: Process instance failures are not critical - they may occur if processes aren't deployed.

## Debug Mode

Enable debug mode for additional diagnostic information:

```bash
DEBUG=true make data
```

Debug mode displays:

- Full configuration (with masked password)
- Config file path and contents summary
- Group membership checks
- Detailed process start/complete operations

## Example Output

### Successful Generation

```
════════════════════════════════════════════════════════════
  Operaton Test Data Generator
════════════════════════════════════════════════════════════

Target: https://operaton-doc.open-regels.nl/engine-rest

✓ Connected to engine: default

──────────────────────────────────────────────────
  Creating Users
──────────────────────────────────────────────────
  ⊘ User demo already exists
  ✓ Created user: john
  ✓ Created user: mary
  ✓ Created user: peter

──────────────────────────────────────────────────
  Creating Groups
──────────────────────────────────────────────────
  ⊘ Group operaton-admin already exists
  ✓ Created group: accounting
  ✓ Created group: management
  ✓ Created group: sales

──────────────────────────────────────────────────
  Adding Users to Groups
──────────────────────────────────────────────────
  ✓ Added john to group accounting
  ✓ Added mary to group management
  ✓ Added peter to group sales

──────────────────────────────────────────────────
  Process Definitions
──────────────────────────────────────────────────
  Found 1 process definition(s)
    - Invoice Receipt (invoice)

──────────────────────────────────────────────────
  Creating Active Process Instances
──────────────────────────────────────────────────
  ✓ Started process: invoice (f0137c8a...)
  ✓ Started process: invoice (f03b00cc...)
  ✓ Started process: invoice (f060632e...)
  ✓ Started process: invoice (f086fe10...)
  ✓ Started process: invoice (f0ad98f2...)

──────────────────────────────────────────────────
  Creating Completed Process Instances
──────────────────────────────────────────────────
  ✓ Started process: invoice (f0d32264...)
    ✓ Completed instance f0d32264...
  ✓ Started process: invoice (f151532d...)
    ✓ Completed instance f151532d...
  ✓ Started process: invoice (f1cdd946...)
    ✓ Completed instance f1cdd946...

──────────────────────────────────────────────────
  Decision Definitions
──────────────────────────────────────────────────
  Found 14 decision definition(s)
    - Assign Approver (invoice-assign-approver)
    ...

──────────────────────────────────────────────────
  Evaluating Decisions
──────────────────────────────────────────────────
  ✓ Evaluated decision: invoice-assign-approver
  ✓ Evaluated decision: invoice-assign-approver
  ✓ Evaluated decision: invoice-assign-approver

════════════════════════════════════════════════════════════
  Data Generation Summary
════════════════════════════════════════════════════════════
  Users:     3 created, 1 existed, 0 failed
  Groups:    3 created, 1 existed, 0 failed
  Instances: 8 created, 3 completed, 0 failed
  Decisions: 3 evaluated, 0 failed
════════════════════════════════════════════════════════════

✓ Data generation complete

Next steps:
  make status     # Verify data in Operaton
  make capture    # Capture screenshots
```

### No Process Definitions

```
──────────────────────────────────────────────────
  Process Definitions
──────────────────────────────────────────────────
  Found 0 process definition(s)

⚠ No process definitions found

Run "make deploy" first to deploy processes.
```

## Testing

### Chaos Tests

Run chaos tests to verify error handling:

```bash
# Run all chaos tests
make chaos-data

# Run with debug output
make chaos-data-debug
```

**Note:** Chaos tests create a temporary `chaosuser` and `chaosgroup` which are automatically
cleaned up after the tests complete.

### Test Coverage

The chaos test suite (`tests/chaos-generate-data.js`) covers:

| Category              | Tests                                 |
| --------------------- | ------------------------------------- |
| Connection failures   | Non-existent host, connection refused |
| Configuration errors  | Missing file, invalid JSON            |
| Debug mode            | Configuration display                 |
| Successful operations | User/group creation, empty config     |
| Output format         | Header, summary section               |

## Typical Workflow

```bash
# 1. Reset environment
make reset-force

# 2. Deploy processes
make deploy

# 3. Generate test data
make data

# 4. Verify
make status

# 5. Capture screenshots
make capture
```

## Error Handling

The script handles various scenarios:

| Scenario               | Behavior                                    |
| ---------------------- | ------------------------------------------- |
| User already exists    | Shows "⊘ User X already exists", continues  |
| Group already exists   | Shows "⊘ Group X already exists", continues |
| User already in group  | Silently skips (no error)                   |
| Process start fails    | Shows error, continues with next            |
| No process definitions | Shows warning, skips instance creation      |

## Protected Resources

The script never modifies these protected resources:

- `demo` user
- `admin` user
- `operaton-admin` group

## Related Commands

| Command        | Description            |
| -------------- | ---------------------- |
| `make deploy`  | Deploy processes first |
| `make status`  | Verify generated data  |
| `make reset`   | Clean up all data      |
| `make capture` | Capture screenshots    |

## Related Files

| File                           | Description                |
| ------------------------------ | -------------------------- |
| `scripts/generate-data.js`     | Main script                |
| `tests/chaos-generate-data.js` | Chaos test suite           |
| `config/screenshots.json`      | User/group definitions     |
| `processes/bpmn/invoice.bpmn`  | Invoice process definition |

## Known Issues

### BPMN with Spring Bean Dependencies

BPMN processes that reference Spring beans via delegate expressions will fail to instantiate in a
standalone Operaton instance. For example:

```xml
<camunda:taskListener delegateExpression="${approverAssignment}" event="create" />
```

This causes
`ENGINE-03051 There was an exception while invoking the TaskListener. Message: 'Unknown property used in expression'`.

**Solution:** Use simplified BPMN files without delegate expressions for standalone testing. The
`invoice.bpmn` in this project has been modified to remove such dependencies.

## Future Ideas

- Configurable number of instances to create
- Support for additional process definitions beyond invoice
- Variable data patterns (e.g., specific amounts for screenshots)
- Batch creation for large datasets
- Import/export of test data snapshots
- Support for external task workers
- Incident creation for error screenshots
- Timer job creation for scheduled task screenshots
- BPMN validation before deployment to detect Spring bean dependencies (e.g.,
  `${approverAssignment}` delegate expressions that require a full application context)
