# replace-screenshots.js

Replace captured screenshots in the Operaton documentation repository.

## Overview

This script copies captured screenshots from the `output/screenshots/` directory to the
documentation repository, replacing existing images with newly captured ones. It only replaces
screenshots that are defined in `config/screenshots.json`, making it safe to have multiple captures
in the output directory.

## Usage

```bash
# Preview replacements (dry run - default)
make replace-screenshots

# Actually replace files
make replace-screenshots-live

# Preview with verbose output
make replace-screenshots-verbose
```

Or run directly:

```bash
# Dry run (default)
node scripts/replace-screenshots.js

# Live replacement
DRY_RUN=false node scripts/replace-screenshots.js

# With verbose output
VERBOSE=true node scripts/replace-screenshots.js
```

## Configuration

Settings via `.env` file:

```bash
# Documentation paths (required)
DOCS_PATH=C:/Users/username/Development/documentation/docs
STATIC_PATH=C:/Users/username/Development/documentation/static/img

# Screenshot config file (default: ./config/screenshots.json)
CONFIG_PATH=./config/screenshots.json

# Safe by default - set to false to actually replace
DRY_RUN=true
```

## How It Works

1. **Load Config**: Reads `config/screenshots.json` to determine which screenshots to replace
2. **Build Index**: Scans the documentation repository for all existing images
3. **Filter**: Only processes screenshots that are defined in the config
4. **Match**: Finds matching files by basename in the docs
5. **Replace**: Copies new screenshots to matching locations (dry run shows what would happen)
6. **Report**: Generates a markdown report with results

### Config-Based Filtering

The script only replaces screenshots defined in `config/screenshots.json`:

```
output/screenshots/
  img/documentation/webapps/admin/admin-users.png      <- Skipped (not in config)
  img/documentation/webapps/welcome/welcome-dashboard-plugin.png  <- Replaced (in config)
```

This means you can:

- Have multiple captures from different scan runs in `output/screenshots/`
- Only replace specific categories by copying the appropriate config
- Safely re-run without accidentally replacing unwanted files

## Console Output

```
============================================================
  Replace Documentation Screenshots
============================================================

*** DRY RUN MODE - No files will be modified ***

Config: ./config/screenshots.json
  2 screenshots defined

Paths:
  Screenshots: ./output/screenshots
  Docs path:   C:/Users/mail/Development/documentation/docs
  Static path: C:/Users/mail/Development/documentation/static/img

Building documentation image index...
  Found 513 unique image names in documentation
  Total locations: 532

Processing captured screenshots...
  Source: ./output/screenshots

  Found 30 captured screenshots
  Matching config: 2
  Skipped (not in config): 28

  [DRY RUN] Would copy: img\documentation\webapps\welcome\welcome-dashboard-plugin.png
            -> C:\Users\mail\Development\documentation\static\img\...\welcome-dashboard-plugin.png

============================================================
  Replace Screenshots Summary
============================================================

  In config:            2
  Replacements made:    2
  Not in docs:          0
  Skipped (not in cfg): 28
  Errors:               0

  [DRY RUN MODE - no files were actually copied]

============================================================
Report saved to: output\replace-report.md

To actually replace screenshots, run:
  make replace-screenshots-live
```

## Workflow

```bash
# 1. Scan documentation
make scan-docs

# 2. Copy desired config
cp output/scan/screenshots-welcome.json config/screenshots.json

# 3. Set up environment
make deploy && make data

# 4. Capture screenshots
make capture

# 5. Preview replacements (only config-defined screenshots)
make replace-screenshots

# 6. Apply replacements
make replace-screenshots-live

# 7. Commit in documentation repo
cd /path/to/documentation
git add -A && git commit -m "Update welcome screenshots"
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

The checked-in `config/screenshots.json` is empty by default:

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

Running `make replace-screenshots-live` with this config does nothing - you must explicitly copy a
generated config first.

## Troubleshooting

### "No screenshots defined in config file"

Copy a generated config first:

```bash
cp output/scan/screenshots-admin.json config/screenshots.json
```

### "No screenshots match the current config"

The captured screenshots don't match what's defined in `config/screenshots.json`. Either:

- Re-capture with the correct config: `make capture`
- Copy a different config that matches your captures

### "0 replacements made" but screenshots exist

- Check that `DOCS_PATH` and `STATIC_PATH` are correctly set
- Verify screenshots exist with matching basenames in documentation
- Run with `VERBOSE=true` to see details

### Screenshot sizes don't match originals

Update your `.env` to match original documentation screenshot dimensions:

```bash
SCREENSHOT_WIDTH=1200
SCREENSHOT_HEIGHT=800
SCREENSHOT_SCALE=1
```

Then re-capture:

```bash
rm -rf output/screenshots/*
make capture
```

## Future Enhancements

- [ ] Backup original files before replacement
- [ ] Support for selective replacement by category
- [ ] Image comparison to skip unchanged files
- [ ] Git integration (auto-commit changes)
- [ ] Rollback functionality
