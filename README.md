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

- **Documentation Scanning** : Scan docs for image references and generate capture configs
- **Process Deployment** : Deploy BPMN/DMN processes to Operaton
- **Data Generation** : Create users, groups, process instances, and tasks
- **Scenario Simulation** : Create specific states (tokens, history, task states)
- **Incident Creation** : Generate intentional failures for error screenshots
- **Screenshot Capture** : Automated Puppeteer-based screen capture
- **Screenshot Replacement** : Copy captured screenshots to documentation
- **Environment Reset** : Clean wipe functionality for fresh starts

## Quick Start

```bash
# 1. Install dependencies
make install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Operaton instance details

# 3. Check connection
make check

# 4. Run the screenshot workflow
make screenshots-workflow
```

## Screenshot Workflow

The complete workflow for updating documentation screenshots:

```bash
# 1. Scan documentation for image references
make scan-docs

# 2. Select a generated config (cockpit, tasklist, admin, or all)
cp cp output/scan/screenshots-admin.json config/screenshots.json

# 3. Set up the Operaton environment
make  deploy # Deploy processes
make data # Generate test data

# 4. Capture screenshots
mak capture

# 5. Preview what will be replaced
make  replace-screenshots

# 6. Actually replace files in documentation
make replace-screenshots-live

# 7. Commit changes in documentation repo

cd /path/to/documentation
git add -A && git commit -m "Update webapp screenshots"
```

## Available Commands

Run `make help` to see all available commands:

### Setup & Conncetion

| Command        | Description                       | Docs                           |
| -------------- | --------------------------------- | ------------------------------ |
| `make install` | Install npm dependencies          |                                |
| `make setup`   | Full setup: install + create .env |                                |
| `make check`   | Check connection to Operaton      | [📖](docs/check-connection.md) |
| `make status`  | Show environment status           | [📖](docs/show-status.md)      |

### Documentation Scanning and Replacement

| Command                         | Description                                      | Docs                                |
| ------------------------------- | ------------------------------------------------ | ----------------------------------- |
| `make analyze`                  | Analyze documentation for screenshots to replace | [📖](docs/analyze-documentation.md) |
| `make scan-docs`                | Scan docs, generate configs                      | [📖](docs/scan-docs.md)             |
| `make replace-screenshots`      | Preview replacements (dry run)                   | [📖](docs/replace-screenshots.md)   |
| `make replace-screenshots-live` | Actually replace in docs                         | [📖](docs/replace-screenshots.md)   |
| `make screenshots-workflow`     | Show full workflow instructions                  |                                     |

### Deployment & Data

| Command       | Description                  | Docs                           |
| ------------- | ---------------------------- | ------------------------------ |
| `make deploy` | Deploy BPMN/DMN processes    | [📖](docs/deploy-processes.md) |
| `make users`  | Create users and groups only | [📖](docs/generate-data.md)    |
| `make data`   | Generate full test data      | [📖](docs/generate-data.md)    |

### Simulation and Incidents

| Command                 | Description                                    | Docs                             |
| ----------------------- | ---------------------------------------------- | -------------------------------- |
| `make simulate`         | Run all simulation scenarios                   | [📖](docs/simulate-scenarios.md) |
| `make simulate-tokens`  | Create instances with tokens at various stages | [📖](docs/simulate-scenarios.md) |
| `make simulate-history` | Generate completed instances for history views | [📖](docs/simulate-scenarios.md) |
| `make incidents`        | Create all types of incidents                  | [📖](docs/create-incidents.md)   |

### Screenshot Capture

| Command                | Description                        | Docs                              |
| ---------------------- | ---------------------------------- | --------------------------------- |
| `make capture`         | Capture all screenshots (headless) | [📖](docs/capture-screenshots.md) |
| `make capture-debug`   | Capture with debug output          | [📖](docs/capture-screenshots.md) |
| `make capture-visible` | Capture with visible browser       | [📖](docs/capture-screenshots.md) |

### Cleanup & Reset

| Command            | Description                        | Docs                            |
| ------------------ | ---------------------------------- | ------------------------------- |
| `make reset`       | Reset Operaton (with confirmation) | [📖](docs/reset-environment.md) |
| `make reset-force` | Reset without confirmation         | [📖](docs/reset-environment.md) |
| `make clean`       | Clean local output files           |                                 |

### Testing

```bash
make test            # Run all chaos tests
make chaos-check     # Test check-connection.js
make chaos-status    # Test show-status.js
make chaos-deploy    # Test deploy-processes.js
make chaos-data      # Test generate-data.js
make chaos-simulate  # Test simulate-scenarios.js
make chaos-incidents # Test create-incidents.js
make chaos-capture   # Test capture-screenshots.js
```

## Configuration

### Environment Variables (.env)

```bash
# Operaton Instance
OPERATON_BASE_URL=https://operaton-doc.open-regels.nl
OPERATON_REST_URL=https://operaton-doc.open-regels.nl/engine-rest
OPERATON_USERNAME=demo
OPERATON_PASSWORD=demo

# Screenshot Capture
SCREENSHOT_WIDTH=1920
SCREENSHOT_HEIGHT=1080
SCREENSHOT_SCALE=2
HEADLESS=true
OUTPUT_DIR=./output/screenshots

# Documentation Paths (required for scan/replace)
DOCS_PATH=C:/Users/username/Development/documentation/docs
STATIC_PATH=C:/Users/username/Development/documentation/static/img

# Replacement Settings
DRY_RUN=true
VERBOSE=false

# Debug
DEBUG=false
```

### Generated Reports

```bash
Command                   Report Location
------------------------- ----------------------------------
make scan-docs            config/generated/scan-report.md
make replace-screenshots  output/replace-report.md
```

### Generated Configs

After running `make scan-docs`:

```bash
config/generated/screenshots-cockpit.json   Cockpit webapp screenshots
config/generated/screenshots-tasklist.json  Tasklist webapp screenshots
config/generated/screenshots-admin.json     Admin webapp screenshots
config/generated/screenshots-welcome.json   Welcome webapp screenshots
config/generated/screenshots-all.json       All webapp screenshots
config/generated/scan-report.md             Scan summary and statistics
```

## Directory Structure

```
operaton-screenshot-automation/
├── Makefile                    # Command interface
├── package.json                # Node.js dependencies
├── .env.example                # Environment template
├── config/
│   ├── screenshots.json        # Active screenshot config
│   └── generated/              # Generated configs from scan
├── docs/                       # Script documentation
├── processes/
│   ├── bpmn/                   # BPMN process files
│   ├── dmn/                    # DMN decision files
│   └── cmmn/                   # CMMN case files
├── scripts/
│   ├── check-connection.js
│   ├── show-status.js
│   ├── deploy-processes.js
│   ├── generate-data.js
│   ├── simulate-scenarios.js
│   ├── create-incidents.js
│   ├── capture-screenshots.js
│   ├── scan-docs.js
│   ├── replace-screenshots.js
│   └── reset-environment.js
├── tests/                      # Chaos test suites
└── output/
    ├── screenshots/            # Captured screenshots
    └── replace-report.md       # Replacement report
```

## Typical Workflows

### Update All Admin Screenshots

```bash
make reset-force
make deploy && make data
cp config/generated/screenshots-admin.json config/screenshots.json
make capture
make replace-screenshots
make replace-screenshots-live
```

### Update All Webapp Screenshots

```bash
make reset-force
make deploy && make data && make simulate
cp config/generated/screenshots-all.json config/screenshots.json
make capture
make replace-screenshots-live
```

### Fresh Full Workflow with Incidents

```bash
make fresh    # Reset + Deploy + Data + Simulate + Incidents + Capture
```

## Troubleshooting

### Connection Issues

```bash
make check  # Diagnose connection problems
DEBUG=true make check
```

### Screenshots Not Capturing

```bash
make capture-visible  # Run with visible browser
DEBUG=true make capture
```

### Processes Not Deploying

- Check process XML validity
- Verify REST API permissions
- Check for existing deployments: `make list-deployments`

### Incidents Not Created

- Ensure processes are deployed first
- Check job executor is running
- Wait for async jobs: incidents may take a few seconds

### Scan Not Finding Images

- Verify DOCS_PATH points to the docs folder
- Check documentation has webapps/ folder structure
- Images must be in webapps/cockpit/, webapps/admin/, etc.

### Replacement Not Working

- Set DRY_RUN=false or use make replace-screenshots-live
- Verify DOCS_PATH and STATIC_PATH are correct
- Check output/replace-report.md for details

## Adding Custom Processes

1. Add BPMN/DMN files to `processes/` directory
2. Update `config/screenshots.json` with new screenshot definitions
3. Add deployment config to deploy script if needed
4. Run `make deploy`

## License

Licensed under the Apache License, Version 2.0. See the LICENSE file for details.
