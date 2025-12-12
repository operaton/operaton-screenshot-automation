# Documentation Screenshot Scan Report

**Generated:** 2025-12-12T21:08:03.687Z

**Documentation path:** C:/Users/mail/Development/documentation/docs

## Summary

- Markdown files scanned: 413
- Total image references: 541
- **Webapp screenshots: 210**
- Other images: 331

## Webapp Screenshots by Category

| Category  | Count   |
| --------- | ------- |
| cockpit   | 155     |
| tasklist  | 25      |
| admin     | 28      |
| welcome   | 2       |
| **Total** | **210** |

## Generated Config Files

| File                      | Description     | Screenshots |
| ------------------------- | --------------- | ----------- |
| screenshots-cockpit.json  | cockpit webapp  | 155         |
| screenshots-tasklist.json | tasklist webapp | 25          |
| screenshots-admin.json    | admin webapp    | 28          |
| screenshots-welcome.json  | welcome webapp  | 2           |
| screenshots-all.json      | All webapps     | 210         |

## Usage

```bash
# Copy desired config
cp config/generated/screenshots-cockpit.json config/screenshots.json

# Or use all
cp config/generated/screenshots-all.json config/screenshots.json

# Capture screenshots
make capture

# Replace in docs
make replace-screenshots-live
```

## Notes

- Only images from `webapps/` documentation sections are included
- Screenshots with `needsReview: true` have dynamic URL parameters
- Duplicate images (same output path) are automatically deduplicated
