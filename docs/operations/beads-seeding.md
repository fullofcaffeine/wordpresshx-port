# Beads Seeding

WPHX-803 makes the PRD task graph reproducible by keying seed data on stable `WPHX-*` external references. WPHX-000.07 extends the initial bootstrap subset with the browser-platform, Gutenberg-package, classic-browser/vendor, and validation/release worksets before those implementation tracks begin.

The seed manifest is:

```text
manifests/beads/prd-seed.v1.json
```

Check the current Beads graph against the seed:

```bash
npm run beads:seed
```

Apply missing or drifted seed data:

```bash
npm run beads:seed:apply
```

The apply command creates missing issues, updates seeded title/type/priority/description/acceptance/parent fields, and adds missing blocking dependencies. It does not close, reopen, claim, defer, or delete issues.

The seed manifest intentionally includes the stable PRD workset backbone, not every dynamically discovered implementation or compiler-pressure issue. WPHX-700.01 through WPHX-700.10 remain supplemental early evidence; they do not replace the PRD-defined WPHX-701 through WPHX-714 release worksets.

Regenerate the seed manifest only after an accepted task-graph change:

```bash
node tools/beads/export-seed-manifest.mjs
```
