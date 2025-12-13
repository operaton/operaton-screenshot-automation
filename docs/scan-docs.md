# scan-docs.js

Scan Operaton documentation for webapp screenshot references and generate capture configurations.

## Overview

This script scans markdown files in the Operaton documentation repository to find image references,
identifies which ones are webapp screenshots (Cockpit, Tasklist, Admin, Welcome), and generates JSON
configuration files for the screenshot capture process.

## Usage

```bash
# Scan documentation (uses DOCS_PATH from .env)
make scan-docs
```

Or run directly:

```bash
# Using .env configuration
node scripts/scan-docs.js

# With custom docs path
DOCS_PATH=/path/to/documentation/docs node scripts/scan-docs.js
```

## Configuration

All settings can be configured via `.env` file or environment variables:

| Variable               | Description                            | Default              |
| ---------------------- | -------------------------------------- | -------------------- |
| `DOCS_PATH`            | Path to documentation `docs/` folder   | (required)           |
| `GENERATED_CONFIG_DIR` | Output directory for generated configs | `./config/generated` |
| `DEBUG`                | Enable debug output                    | `false`              |

### Example .env Configuration

```bash
# Path to Operaton documentation repository
DOCS_PATH=C:/Users/username/Development/documentation/docs

# Where to save generated configs
GENERATED_CONFIG_DIR=./config/generated
```

## How It Works

1. **Find Markdown Files**: Recursively scans `DOCS_PATH` for `.md` and `.mdx` files
2. **Extract Image References**: Parses markdown and HTML image syntax
3. **Categorize Images**: Identifies webapp screenshots based on:
   - Source file location (e.g., `webapps/cockpit/`, `webapps/admin/`)
   - Image filename prefix (e.g., `cockpit-`, `admin-`)
4. **Infer URLs**: Determines webapp URLs from image filenames
5. **Generate Configs**: Creates JSON configuration files per category

### Categorization Logic

Only images that are **actual webapp screenshots** are included:

| Criteria                          | Example                                          |
| --------------------------------- | ------------------------------------------------ |
| Source in `webapps/cockpit/` docs | `documentation/webapps/cockpit/dashboard.md`     |
| Source in `webapps/admin/` docs   | `documentation/webapps/admin/user-management.md` |
| Filename starts with `cockpit-`   | `cockpit-dashboard.png`                          |
| Filename starts with `admin-`     | `admin-users.png`                                |

Images that don't match (BPMN diagrams, modeler screenshots, etc.) are categorized as "other" and
excluded from generated configs.

### URL Inference

The script infers webapp URLs from image filenames:

| Pattern in Filename  | Inferred URL                                  |
| -------------------- | --------------------------------------------- |
| `dashboard`          | `#/dashboard`                                 |
| `process-definition` | `#/process-definition/{processDefinitionKey}` |
| `process-instance`   | `#/process-instance/{processInstanceId}`      |
| `batch`              | `#/batch`                                     |
| `users`              | `#/users`                                     |
| `groups`             | `#/groups`                                    |
| `tenants`            | `#/tenants`                                   |
| `authorization`      | `#/authorization?resource=0`                  |
| `system`             | `#/system`                                    |

## Output

### Generated Files

Location: `config/generated/`

| File                        | Description                     |
| --------------------------- | ------------------------------- |
| `screenshots-cockpit.json`  | Cockpit webapp screenshots      |
| `screenshots-tasklist.json` | Tasklist webapp screenshots     |
| `screenshots-admin.json`    | Admin webapp screenshots        |
| `screenshots-welcome.json`  | Welcome webapp screenshots      |
| `screenshots-all.json`      | All webapp screenshots combined |
| `scan-report.md`            | Detailed scan report            |

### Console Output

```
============================================================
  Documentation Screenshot Scanner v2
============================================================

Docs path: C:/Users/mail/Development/documentation/docs

Finding markdown files...
  Found 413 markdown files

Scanning for image references...
  Found 541 image references
  Webapp screenshots: 210
  Other images: 331

Generating configuration files...

  + screenshots-cockpit.json (155 screenshots)
  + screenshots-tasklist.json (25 screenshots)
  + screenshots-admin.json (28 screenshots)
  + screenshots-welcome.json (2 screenshots)
  + screenshots-all.json (210 screenshots)
  + scan-report.md

Output directory: ./config/generated

============================================================
  Scan Summary
============================================================

Webapp screenshots by category:

  cockpit       155  #############################################################################
  tasklist       25  ############
  admin          28  ##############
  welcome         2  #

  Total webapp screenshots: 210
  Other images (not captured): 331

============================================================

+ Scan complete!
```

### Generated JSON Structure

```json
{
  "version": "1.0.0",
  "description": "Admin webapp screenshots - generated from documentation",
  "generatedAt": "2025-12-12T21:08:03.470Z",
  "categories": {
    "admin": {
      "description": "Admin webapp screenshots",
      "baseUrl": "/operaton/app/admin/default"
    }
  },
  "screenshots": [
    {
      "id": "admin-users",
      "category": "admin",
      "description": "User management page",
      "path": "#/users",
      "outputFile": "img/documentation/webapps/admin/admin-users.png",
      "sourceDoc": "documentation\\webapps\\admin\\user-management.md",
      "sourceLine": 16,
      "needsReview": false
    }
  ],
  "users": [],
  "groups": []
}
```

### Screenshot Entry Fields

| Field         | Description                                         |
| ------------- | --------------------------------------------------- |
| `id`          | Unique identifier for the screenshot                |
| `category`    | Webapp category (cockpit, tasklist, admin, welcome) |
| `description` | Alt text from markdown or generated from filename   |
| `path`        | Inferred URL path within the webapp                 |
| `outputFile`  | Output path matching documentation structure        |
| `sourceDoc`   | Markdown file where image is referenced             |
| `sourceLine`  | Line number in source file                          |
| `needsReview` | `true` if URL contains dynamic parameters           |

## Workflow Integration

```bash
# 1. Configure .env with DOCS_PATH
cp .env.example .env
# Edit .env and set DOCS_PATH

# 2. Scan documentation
make scan-docs

# 3. Review generated report
cat config/generated/scan-report.md

# 4. Select a config to use
cp config/generated/screenshots-admin.json config/screenshots.json

# 5. Capture screenshots
make capture

# 6. Replace in documentation
make replace-screenshots-live
```

## Report Locations Summary

| Command                    | Report Location                   |
| -------------------------- | --------------------------------- |
| `make scan-docs`           | `config/generated/scan-report.md` |
| `make replace-screenshots` | `output/replace-report.md`        |

## Troubleshooting

### "Documentation path not found"

Set `DOCS_PATH` in your `.env` file:

```bash
DOCS_PATH=C:/Users/username/Development/documentation/docs
```

### "0 webapp screenshots found"

- Check that the documentation has a `webapps/` folder structure
- Verify image filenames follow naming conventions (e.g., `cockpit-*.png`, `admin-*.png`)
- Run with `DEBUG=true` for more details

### Screenshots marked as `needsReview: true`

These screenshots have URLs with dynamic parameters like `{processDefinitionKey}`. The capture
script will attempt to resolve these using live data from the Operaton instance.

## Future Enhancements

- [ ] Support for custom categorization rules
- [ ] Automatic URL inference from surrounding markdown content
- [ ] Integration with documentation build system
- [ ] Incremental scanning (only changed files)
- [ ] Configuration-driven data generation based on screenshot requirements
