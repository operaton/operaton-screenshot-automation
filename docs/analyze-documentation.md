# analyze-documentation.js

Scans documentation files to identify screenshots that need replacement with Operaton versions.

## Overview

This script analyzes markdown documentation to:

1. Find all image references (markdown and HTML syntax)
2. Categorize them by webapp (Cockpit, Tasklist, Admin, Welcome, Modeler)
3. Identify which ones need replacement based on naming patterns
4. Generate a replacement plan with file locations and reference counts

## Usage

```bash
# Via Make (recommended)
make analyze

# With specific docs path
node scripts/analyze-documentation.js /path/to/docs

# Via npm
npm run analyze

# With debug output
make analyze-debug
DEBUG=true npm run analyze
```

## Configuration

The script reads configuration from environment variables (`.env` file) or command line arguments:

| Variable      | Description                                       | Default      |
| ------------- | ------------------------------------------------- | ------------ |
| `DOCS_PATH`   | Path to documentation directory                   | `../../docs` |
| `OUTPUT_DIR`  | Directory for output files                        | `./output`   |
| `REPLACE_ALL` | Flag all images for replacement (ignore patterns) | `false`      |
| `DEBUG`       | Enable verbose output                             | `false`      |

Command line argument takes precedence over environment variable:

```bash
# Using environment variable
DOCS_PATH=/path/to/docs make analyze

# Using command line argument
node scripts/analyze-documentation.js /path/to/docs
```

### Understanding DOCS_PATH

The `DOCS_PATH` should point to the directory containing your **markdown files** (`.md`, `.mdx`),
not the images directory.

For a typical Docusaurus setup like Operaton's documentation:

```
documentation/
├── docs/              ← DOCS_PATH points here
│   ├── getting-started.md
│   ├── user-guide/
│   │   ├── cockpit.md
│   │   └── tasklist.md
│   └── ...
└── static/
    └── img/           ← Images live here (not scanned directly)
        ├── cockpit-dashboard.png
        └── ...
```

The script:

1. Scans markdown files in `DOCS_PATH` for image references
2. Extracts paths like `![Dashboard](../static/img/cockpit-dashboard.png)`
3. Analyzes those path strings to categorize and identify replacements

It does **not** access the actual image files - it only parses the text references in markdown.

**Example configuration for Operaton docs:**

```bash
# If operaton-screenshot-automation is sibling to documentation repo
DOCS_PATH=../documentation/docs

# Or absolute path
DOCS_PATH=/home/user/projects/operaton/documentation/docs
```

## Detection Logic

The script uses two separate pattern sets: one for **categorization** (organizing screenshots) and
one for **replacement detection** (flagging what needs updating).

### How Replacement Detection Works

A screenshot is flagged as "needs replacement" if its **file path or filename** matches any of these
patterns:

| Pattern              | Example Matches                                     |
| -------------------- | --------------------------------------------------- |
| `cockpit`            | `cockpit-dashboard.png`, `img/cockpit/overview.png` |
| `tasklist`           | `tasklist-filter.png`, `tasklist/task-form.png`     |
| `admin-`             | `admin-users.png`, `admin-system-settings.png`      |
| `webapp`             | `webapp-login.png`                                  |
| `dashboard`          | `dashboard-overview.png`                            |
| `process-definition` | `process-definition-view.png`                       |
| `process-instance`   | `process-instance-detail.png`                       |
| `decision-`          | `decision-table.png`, `decision-definition.png`     |
| `task-`              | `task-form.png`, `task-detail.png`                  |
| `filter-`            | `filter-create.png`, `filter-settings.png`          |
| `batch`              | `batch-operations.png`                              |
| `migration`          | `migration-wizard.png`                              |
| `cleanup`            | `cleanup-history.png`                               |

**Note:** Pattern matching is case-insensitive and checks the entire path, not just the filename.

### Examples

| Image Reference                 | Needs Replacement? | Why                           |
| ------------------------------- | ------------------ | ----------------------------- |
| `../img/cockpit-dashboard.png`  | ✓ Yes              | Contains `cockpit`            |
| `./images/tasklist/filters.png` | ✓ Yes              | Contains `tasklist`           |
| `process-definition-list.png`   | ✓ Yes              | Contains `process-definition` |
| `../img/bpmn-diagram.png`       | ✗ No               | No matching pattern           |
| `logo.svg`                      | ✗ No               | No matching pattern           |
| `architecture-overview.png`     | ✗ No               | No matching pattern           |

### Why Some Screenshots Don't Need Replacement

Screenshots categorized under "modeler" or "other" often don't need replacement because:

- **Modeler screenshots** - BPMN/DMN diagrams are tool-agnostic
- **Architecture diagrams** - Conceptual images not tied to UI
- **Logos and icons** - Static assets
- **External integrations** - Third-party tool screenshots

### Customizing Detection Patterns

The patterns are defined in `scripts/analyze-documentation.js` in the `LEGACY_PATTERNS` array. To
add or modify patterns:

```javascript
const LEGACY_PATTERNS = [
  /cockpit/i,
  /tasklist/i,
  // Add custom patterns here
  /your-pattern/i,
];
```

### Replace All Mode

For a complete replacement of all screenshots (ignoring pattern detection), use:

```bash
# Via Make
make analyze-all

# Via environment variable
REPLACE_ALL=true make analyze

# Direct
REPLACE_ALL=true node scripts/analyze-documentation.js
```

When `REPLACE_ALL=true`, every image reference is flagged for replacement regardless of its path or
filename. This is useful when:

- Starting fresh with a complete documentation overhaul
- Ensuring visual consistency across all screenshots
- Migrating to a new branding or theme

Example output with `REPLACE_ALL=true`:

```
Scanning: /path/to/docs

⚠ REPLACE_ALL mode: All screenshots will be flagged for replacement

Found 413 markdown files
Found 542 image references

  Summary
  Total screenshots:    542
  Need replacement:     542    ← All images flagged
```

### Categories vs Replacement

**Categorization** organizes screenshots for reporting purposes. **Replacement detection**
determines what actually needs updating. These are independent:

- A screenshot can be categorized as "cockpit" but NOT need replacement (if the pattern doesn't
  match)
- A screenshot can be categorized as "other" but still need replacement (if it matches a legacy
  pattern)

Example:

- `other`: 138 total, **6 need replacement** (6 matched legacy patterns despite not fitting a
  category)
- `modeler`: 42 total, **0 need replacement** (BPMN diagrams don't need updating)

## Output Files

The script generates two files in the output directory:

### screenshot-analysis.json

Machine-readable analysis results:

```json
{
  "summary": {
    "total": 150,
    "needsReplacement": 87,
    "byCategory": {
      "cockpit": { "total": 45, "needsReplacement": 42 },
      "tasklist": { "total": 30, "needsReplacement": 28 }
    }
  },
  "byCategory": { ... },
  "replacementPlan": [ ... ]
}
```

### REPLACEMENT_PLAN.md

Human-readable replacement plan with:

- Summary statistics
- Breakdown by category
- List of screenshots needing replacement
- File references and line numbers
- Next steps for the replacement workflow

## Exit Codes

| Code | Meaning                                    |
| ---- | ------------------------------------------ |
| `0`  | Analysis completed successfully            |
| `1`  | Error (directory not found, write failure) |

## Debug Mode

Enable debug mode for additional diagnostic information:

```bash
DEBUG=true make analyze
```

Debug mode displays:

- Full configuration
- Glob pattern used for file search
- Per-file image counts
- Skipped external URLs

Example debug output:

```
Configuration:
  Docs path: /path/to/docs
  Output dir: ./output

    [DEBUG] Glob pattern: /path/to/docs/**/*.{md,mdx}
    [DEBUG] Skipping external URL: https://example.com/image.png
    [DEBUG] test.md: found 5 images
```

## Example Output

### Successful Analysis

```
════════════════════════════════════════════════════════════
  Documentation Screenshot Analyzer
════════════════════════════════════════════════════════════

Scanning: /path/to/docs

Found 45 markdown files

Found 150 image references

──────────────────────────────────────────────────────────────
  Summary
──────────────────────────────────────────────────────────────
  Total screenshots:    150
  Need replacement:      87

──────────────────────────────────────────────────────────────
  By Category
──────────────────────────────────────────────────────────────
  cockpit         45 total,   42 need replacement
  tasklist        30 total,   28 need replacement
  admin           25 total,   12 need replacement
  welcome          5 total,    3 need replacement
  modeler         20 total,    0 need replacement
  other           25 total,    2 need replacement

──────────────────────────────────────────────────────────────
  Output Files
──────────────────────────────────────────────────────────────
  ✓ /path/to/output/screenshot-analysis.json
  ✓ /path/to/output/REPLACEMENT_PLAN.md

════════════════════════════════════════════════════════════
```

### No Documentation Found

```
════════════════════════════════════════════════════════════
  Documentation Screenshot Analyzer
════════════════════════════════════════════════════════════

Scanning: /nonexistent/path

✗ Documentation directory not found: /nonexistent/path

Troubleshooting:
  1. Verify the path exists
  2. Set DOCS_PATH in .env file
  3. Pass path as argument: node scripts/analyze-documentation.js /path/to/docs
```

## Typical Workflow

### 1. Analyze Documentation

```bash
make analyze
```

Review the generated `output/REPLACEMENT_PLAN.md` to understand the scope.

### 2. Deploy and Generate Data

```bash
make deploy
make data
```

### 3. Capture Screenshots

```bash
make capture
```

### 4. Replace Screenshots

Copy captured screenshots from `output/screenshots/` to the documentation, matching the paths listed
in the replacement plan.

### 5. Re-analyze to Verify

```bash
make analyze
```

Confirm the "Need replacement" count has decreased.

## Image Syntax Support

The script detects images in both formats:

### Markdown Syntax

```markdown
![Alt text](path/to/image.png) ![](relative/path.jpg)
```

### HTML Syntax

```html
<img src="path/to/image.png" alt="Description" /> <img src="image.svg" />
```

### Skipped Content

- External URLs (`http://`, `https://`)
- Non-image files (only `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp` are processed)

## Testing

### Chaos Tests

Run chaos tests to verify error handling:

```bash
# Run all chaos tests
make chaos-analyze

# Run with debug output
make chaos-analyze-debug
```

### Test Coverage

The chaos test suite (`tests/chaos-analyze-documentation.js`) covers:

| Category            | Tests                                      |
| ------------------- | ------------------------------------------ |
| Invalid paths       | Non-existent directory, empty path         |
| Empty/no content    | Empty directory, no images in markdown     |
| Successful analysis | Images found, categorization, output files |
| Debug mode          | Configuration display, error details       |
| Output format       | Headers, section separators                |

## Related Commands

| Command        | Description                        |
| -------------- | ---------------------------------- |
| `make capture` | Capture replacement screenshots    |
| `make deploy`  | Deploy processes for screenshots   |
| `make data`    | Generate test data for screenshots |

## Related Files

| File                                   | Description                  |
| -------------------------------------- | ---------------------------- |
| `scripts/analyze-documentation.js`     | Main script                  |
| `tests/chaos-analyze-documentation.js` | Chaos test suite             |
| `output/screenshot-analysis.json`      | Analysis results (generated) |
| `output/REPLACEMENT_PLAN.md`           | Replacement plan (generated) |

## Future Ideas

- Add `--format` flag for different output formats (JSON, CSV, HTML)
- Support for checking if referenced images actually exist on disk
- Integration with capture script to auto-generate missing screenshots
- Watch mode for continuous analysis during documentation editing
- Filtering by category or replacement status
