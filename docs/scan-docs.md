# scan-docs.js

Scan Operaton documentation for screenshots and generate capture configurations.

## Overview

This script:

1. Scans markdown files for all image references
2. Identifies webapp screenshots (Cockpit, Tasklist, Admin, Welcome)
3. Generates JSON capture configurations and a summary report

All output goes to `output/scan/` (untracked), so you can re-scan without affecting tracked files.

## Usage

```bash
# Scan documentation
make scan-docs
```

Or run directly:

```bash
node scripts/scan-docs.js
```

## Configuration

Settings via `.env` file:

```bash
# Path to documentation docs/ folder (required)
DOCS_PATH=C:/Users/username/Development/documentation/docs

# Output directory for generated files (optional)
SCAN_OUTPUT_DIR=./output/scan

# Enable debug output
DEBUG=false
```

## Output Files

All files are generated in `output/scan/`:

```
output/scan/
  screenshots-cockpit.json   # Cockpit webapp config
  screenshots-tasklist.json  # Tasklist webapp config
  screenshots-admin.json     # Admin webapp config
  screenshots-welcome.json   # Welcome webapp config
  screenshots-all.json       # All webapps combined
  scan-report.md             # Summary statistics
```

## Console Output

```
============================================================
  Documentation Screenshot Scanner
============================================================

Docs path: C:/Users/mail/Development/documentation/docs

Finding markdown files...
  Found 413 markdown files

Scanning for image references...
  Total images: 541
  Webapp screenshots: 210
  Other images: 331

Generating output files...
Output directory: ./output/scan

  + screenshots-cockpit.json (155 screenshots)
  + screenshots-tasklist.json (25 screenshots)
  + screenshots-admin.json (28 screenshots)
  + screenshots-welcome.json (2 screenshots)
  + screenshots-all.json (210 screenshots)
  + scan-report.md

============================================================
  Scan Summary
============================================================

Webapp screenshots by category:

  cockpit       155  #############################################
  tasklist       25  ############
  admin          28  ##############
  welcome         2  #

  Total webapp screenshots: 210
  Other images: 331

============================================================

Next steps:
  1. Copy a config: cp output/scan/screenshots-admin.json config/screenshots.json
  2. Capture: make capture
  3. Replace: make replace-screenshots-live

+ Scan complete!
```

## Workflow

```bash
# 1. Scan documentation
make scan-docs

# 2. Review the scan report
cat output/scan/scan-report.md

# 3. Copy desired config (admin, cockpit, tasklist, or all)
cp output/scan/screenshots-admin.json config/screenshots.json

# 4. Set up environment
make deploy && make data

# 5. Capture screenshots
make capture

# 6. Preview and apply replacements
make replace-screenshots
make replace-screenshots-live
```

## Report Locations

```
Command                   Output Location
------------------------- ---------------------------
make scan-docs            output/scan/scan-report.md
                          output/scan/screenshots-*.json

make replace-screenshots  output/replace-report.md
```

## Safe Default Config

The checked-in `config/screenshots.json` is an empty minimal config:

```json
{
  "version": "1.0.0",
  "description": "Minimal screenshot config - copy from output/scan/ to replace",
  "categories": {},
  "screenshots": [],
  "users": [],
  "groups": []
}
```

This ensures `make capture` and `make replace-screenshots-live` won't accidentally modify anything
until you explicitly copy a generated config.

## Troubleshooting

### "Documentation path not found"

Set `DOCS_PATH` in your `.env` file pointing to the docs folder.

### No webapp screenshots found

- Check documentation has `webapps/` folder structure
- Verify image filenames follow conventions (`cockpit-*.png`, `admin-*.png`)

### Screenshots marked as needsReview

These have dynamic URL parameters like `{processDefinitionKey}`. The capture script resolves them
using live data from Operaton.

## Future Enhancements

- [ ] Support for custom categorization rules
- [ ] Automatic URL inference from surrounding markdown content
- [ ] Integration with documentation build system
- [ ] Incremental scanning (only changed files)
- [ ] Configuration-driven data generation based on screenshot requirements
