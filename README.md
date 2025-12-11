# ⚠️ Operaton Screenshot Automation ⚠️

[![status](https://img.shields.io/badge/status-work%20in%20progress-yellow)](https://github.com/sgort/operaton-screenshot-automation)
[![license](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

[![release](https://img.shields.io/github/v/release/sgort/operaton-screenshot-automation)](https://github.com/sgort/operaton-screenshot-automation/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/sgort/operaton-screenshot-automation/ci.yml?branch=dev&label=CI)](https://github.com/sgort/operaton-screenshot-automation/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](package.json)

> 🚧 **Work in Progress — Baseline Under Development** 🚧
>
> This repository is a **baseline toolkit** intended to be battle-tested in practice. APIs, scripts,
> and automation may change frequently. **Not ready for production use**.
>
> Contributions, testing, and feedback are highly encouraged to improve the project.

---

Automated toolkit for capturing Operaton webapp screenshots to replace Camunda screenshots in
documentation.

## Features

- **Process Deployment**: Deploy BPMN/DMN processes to Operaton
- **Data Generation**: Create users, groups, process instances, and tasks
- **Scenario Simulation**: Create specific states (tokens, history, task states)
- **Incident Creation**: Generate intentional failures for error screenshots
- **Screenshot Capture**: Automated Puppeteer-based screen capture
- **Environment Reset**: Clean wipe functionality for fresh starts
- **Makefile Interface**: Convenient commands for all operations

## Quick Start

```bash
# 1. Install dependencies
make install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Operaton instance details

# 3. Check connection
make check

# 4. Run quick workflow (deploy + data + capture)
make quick

# Or run full workflow (includes incidents)
make full
```

## Available Commands

Run `make help` to see all available commands:

### Setup & Installation

| Command        | Description                       | Docs                           |
| -------------- | --------------------------------- | ------------------------------ |
| `make install` | Install npm dependencies          |                                |
| `make setup`   | Full setup: install + create .env |                                |
| `make check`   | Check connection to Operaton      | [📖](docs/check-connection.md) |

### Deployment & Data

| Command           | Description                  | Docs                           |
| ----------------- | ---------------------------- | ------------------------------ |
| `make deploy`     | Deploy BPMN/DMN processes    | [📖](docs/deploy-processes.md) |
| `make users`      | Create users and groups only |                                |
| `make data`       | Generate full test data      |                                |
| `make data-light` | Generate minimal test data   |                                |

### Simulation Scenarios

| Command                 | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `make simulate`         | Run all simulation scenarios                   |
| `make simulate-tokens`  | Create instances with tokens at various stages |
| `make simulate-history` | Generate completed instances for history views |

### Incident Creation

| Command                  | Description                   |
| ------------------------ | ----------------------------- |
| `make incidents`         | Create all types of incidents |
| `make incidents-script`  | Script task failures only     |
| `make incidents-service` | Service task failures only    |

### Screenshot Capture

| Command                 | Description                                      | Docs                                |
| ----------------------- | ------------------------------------------------ | ----------------------------------- |
| `make analyze`          | Analyze documentation for screenshots to replace | [📖](docs/analyze-documentation.md) |
| `make capture`          | Capture all screenshots (headless)               |                                     |
| `make capture-debug`    | Capture with visible browser                     |                                     |
| `make capture-cockpit`  | Capture only Cockpit screenshots                 |                                     |
| `make capture-tasklist` | Capture only Tasklist screenshots                |                                     |
| `make capture-admin`    | Capture only Admin screenshots                   |                                     |

### Cleanup & Reset

| Command                  | Description                        |
| ------------------------ | ---------------------------------- |
| `make reset`             | Reset Operaton (with confirmation) |
| `make reset-force`       | Reset without confirmation         |
| `make reset-instances`   | Delete process instances only      |
| `make reset-deployments` | Delete deployments only            |
| `make clean`             | Clean local output files           |
| `make wipe`              | Full wipe: reset + clean           |

### Workflows

| Command      | Description                                    |
| ------------ | ---------------------------------------------- |
| `make quick` | Deploy → Data → Capture                        |
| `make full`  | Deploy → Data → Simulate → Incidents → Capture |
| `make fresh` | Reset → Full workflow                          |

### Status & Debugging

| Command                 | Description              | Docs                      |
| ----------------------- | ------------------------ | ------------------------- |
| `make status`           | Show environment status  | [📖](docs/show-status.md) |
| `make list-deployments` | List current deployments |                           |
| `make list-instances`   | List running instances   |                           |
| `make list-incidents`   | List current incidents   |                           |
| `make list-tasks`       | List current tasks       |                           |

## Configuration

### Environment Variables (.env)

```bash
# Operaton Instance
OPERATON_BASE_URL=https://operaton-doc.open-regels.nl
OPERATON_REST_URL=https://operaton-doc.open-regels.nl/engine-rest
OPERATON_USERNAME=demo
OPERATON_PASSWORD=demo

# Screenshot Settings
SCREENSHOT_WIDTH=1920
SCREENSHOT_HEIGHT=1080
SCREENSHOT_SCALE=2

# Capture Settings
HEADLESS=true
DEBUG=false
OUTPUT_DIR=./output/screenshots
```

### Screenshot Definitions (config/screenshots.json)

The configuration file defines:

- Screenshot categories (cockpit, tasklist, admin, welcome)
- Individual screenshot definitions with URLs and selectors
- Required data prerequisites
- Output file paths

## Directory Structure

```
operaton-screenshot-automation/
├── Makefile                            # Command interface
├── package.json                        # Node.js dependencies
├── .env.example                        # Environment template
├── config/
│   └── screenshots.json                # Screenshot definitions
├── processes/
│   ├── bpmn/                           # BPMN process files
│   │   └── invoice.bpmn                # Sample invoice process
│   ├── dmn/                            # DMN decision files
│   │   ├── invoice-assign-approver.dmn
│   │   └── dish-decision.dmn
│   └── cmmn/                           # CMMN case files
├── scripts/
│   ├── check-connection.js             # Connection checker
│   ├── show-status.js                  # Status display
│   ├── deploy-processes.js             # Process deployment
│   ├── generate-data.js                # Data generation
│   ├── simulate-scenarios.js           # Scenario simulation
│   ├── create-incidents.js             # Incident creation
│   ├── capture-screenshots.js          # Screenshot capture
│   ├── analyze-documentation.js        # Doc analyzer
│   └── reset-environment.js            # Environment reset
└── output/
    └── screenshots/                    # Captured screenshots
```

## Simulation Scenarios

### Token Positions

Creates process instances with execution tokens at specific activities:

- Token at "Approve Invoice" user task
- Token at "Review Invoice" user task
- Token at "Prepare Bank Transfer" user task

### History Data

Generates completed process instances with various outcomes:

- Approved and paid invoices
- Rejected invoices
- Clarified and re-approved invoices

### Task States

Creates tasks in various states:

- Unassigned tasks (candidate groups)
- Assigned tasks
- Overdue tasks
- Tasks with follow-up dates

## Incident Types

### Script Task Failures

Deploys processes with JavaScript that throws errors.

### Service Task Failures

Deploys processes with non-existent delegate expressions.

### Expression Evaluation Errors

Deploys processes with gateway conditions referencing undefined variables.

### Async Job Failures

Deploys async processes that fail during job execution.

### External Task Failures

Creates external tasks and explicitly fails them with error details.

## Typical Workflow

```bash
# 1. Start fresh
make reset-force

# 2. Deploy processes
make deploy

# 3. Generate base data
make data

# 4. Create specific scenarios
make simulate

# 5. Add incidents for error screenshots
make incidents

# 6. Check what we have
make status

# 7. Capture all screenshots
make capture

# 8. Review output
ls -la output/screenshots/
```

## Troubleshooting

### Connection Issues

```bash
make check  # Diagnose connection problems
```

### Screenshots Not Capturing

```bash
make capture-debug  # Run with visible browser
```

### Processes Not Deploying

- Check process XML validity
- Verify REST API permissions
- Check for existing deployments: `make list-deployments`

### Incidents Not Created

- Ensure processes are deployed first
- Check job executor is running
- Wait for async jobs: incidents may take a few seconds

## Adding Custom Processes

1. Add BPMN/DMN files to `processes/` directory
2. Update `config/screenshots.json` with new screenshot definitions
3. Add deployment config to deploy script if needed
4. Run `make deploy`

## License

Licensed under the Apache License, Version 2.0. See the LICENSE file for details.
