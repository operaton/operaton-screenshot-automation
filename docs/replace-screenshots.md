# replace-screenshots.js

Replace captured screenshots in the Operaton documentation repository.

## Overview

This script copies captured screenshots from the `output/screenshots/` directory to the
documentation repository, replacing existing images with newly captured ones. It matches files by
basename and supports both `docs/` and `static/img/` locations.

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

All settings can be configured via `.env` file or environment variables:

| Variable      | Description                                | Default                |
| ------------- | ------------------------------------------ | ---------------------- |
| `OUTPUT_DIR`  | Source directory with captured screenshots | `./output/screenshots` |
| `DOCS_PATH`   | Path to documentation `docs/` folder       | (required)             |
| `STATIC_PATH` | Path to documentation `static/img/` folder | (required)             |
| `DRY_RUN`     | Preview mode - don't copy files            | `true`                 |
| `VERBOSE`     | Show detailed output                       | `false`                |
| `DEBUG`       | Enable debug output                        | `false`                |

### Example .env Configuration

```bash
# Documentation paths (required for replacement)
DOCS_PATH=C:/Users/username/Development/documentation/docs
STATIC_PATH=C:/Users/username/Development/documentation/static/img

# Safe by default - set to false to actually replace
DRY_RUN=true
```

## How It Works

1. **Build Index**: Scans the documentation repository (`docs/` and `static/img/`) for all existing
   images
2. **Match Files**: For each captured screenshot, finds matching files by basename in the docs
3. **Replace**: Copies the new screenshot to all matching locations (dry run shows what would
   happen)
4. **Report**: Generates a markdown report with results

### Matching Logic

Files are matched by **basename only** (filename without path):

```
Captured: output/screenshots/img/documentation/webapps/admin/admin-users.png
Matches:  static/img/documentation/webapps/admin/admin-users.png
          ↓
Basename: admin-users.png
```

This allows the script to work even if the captured path structure differs slightly from the docs
structure.

## Output

### Console Output

```
============================================================
  Replace Documentation Screenshots
============================================================

*** DRY RUN MODE - No files will be modified ***

Configuration:
  Screenshots: ./output/screenshots
  Docs path:   C:/Users/mail/Development/documentation/docs
  Static path: C:/Users/mail/Development/documentation/static/img

Building documentation image index...
  Found 523 unique image names in documentation
  Total locations: 891

Processing captured screenshots...
  Source: ./output/screenshots

  Found 28 captured screenshots

============================================================
  Replace Screenshots Summary
============================================================

  Screenshots found:    28
  Replacements made:    28
  Not in docs:          0
  Errors:               0

============================================================

Report saved to: ./output/replace-report.md
```

### Generated Report

Location: `output/replace-report.md`

```markdown
# Screenshot Replacement Report

**Generated:** 2025-12-13T07:54:56.448Z

**Mode:** DRY RUN

## Summary

- Screenshots processed: 28
- Replacements made: 28
- Not found in docs: 0
- Errors: 0

## Replaced Screenshots

| Source                                          | Destination     | Location |
| ----------------------------------------------- | --------------- | -------- |
| img\documentation\webapps\admin\admin-users.png | admin-users.png | static   |
| ...                                             | ...             | ...      |
```

## Exit Codes

| Code | Description                                            |
| ---- | ------------------------------------------------------ |
| 0    | Success                                                |
| 1    | Error (missing config, no screenshots directory, etc.) |

## Workflow Integration

This script is part of the screenshot automation workflow:

```bash
# 1. Scan documentation for image references
make scan-docs

# 2. Select a generated config
cp config/generated/screenshots-admin.json config/screenshots.json

# 3. Set up environment (deploy processes, generate data)
make deploy
make data

# 4. Capture screenshots
make capture

# 5. Preview what will be replaced
make replace-screenshots

# 6. Actually replace (after reviewing)
make replace-screenshots-live

# 7. Commit changes in documentation repo
cd /path/to/documentation
git add -A
git commit -m "Update admin webapp screenshots"
```

## Report Locations Summary

| Command                         | Report Location                   |
| ------------------------------- | --------------------------------- |
| `make scan-docs`                | `config/generated/scan-report.md` |
| `make replace-screenshots`      | `output/replace-report.md`        |
| `make replace-screenshots-live` | `output/replace-report.md`        |

## Troubleshooting

### "Screenshots directory not found"

Run `make capture` first to capture screenshots.

### "0 replacements made"

- Check that `DOCS_PATH` and `STATIC_PATH` are correctly set in `.env`
- Verify the documentation repository contains images with matching basenames
- Run with `VERBOSE=true` to see which files aren't matching

### Files not being replaced in live mode

- Ensure `DRY_RUN=false` is set (or use `make replace-screenshots-live`)
- Check file permissions in the documentation repository
- Review the report for any errors

### Multiple matches for same file

If an image exists in both `docs/` and `static/img/`, it will be replaced in all locations. The
report shows the "Location" column to indicate where each replacement was made.

## Test Coverage

The script is tested via the chaos test suite:

```bash
make chaos-capture
```

Tests cover:

- Configuration validation
- Missing screenshots directory handling
- Dry run mode
- Report generation

## Future Enhancements

- [ ] Backup original files before replacement
- [ ] Support for selective replacement by category
- [ ] Image comparison to skip unchanged files
- [ ] Git integration (auto-commit changes)
- [ ] Rollback functionality
