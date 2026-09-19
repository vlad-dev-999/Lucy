# Hospital MMF Command Centre

Hospital MMF Command Centre is a secure external curation and governance layer around the hospital's internal Tools Committee system. It starts with the real legacy workbook contract and provides a guided path from workbook inspection to a reviewable, immutable baseline.

## Current stage

Stage 1 is implemented as a usable desktop slice:

`legacy workbook → browser inspection → quality findings → preview → import review → immutable baseline status`

The current interface includes:

- Command centre overview
- Guided import review with real XLSX/XLS/CSV parsing
- SHA-256 file hashing in the browser
- Structural header checking
- Duplicate identifier and nomenclature conflict detection
- Missing PVMS/NIV warnings
- DGLP and ECHS preview columns kept separate
- Import history and detail pages
- Baseline commit control
- Department inventory from the actual workbook vocabulary
- Identifier review queue

## Quick start

Use the managed workflows for the API and web app. For repository checks:

```bash
pnpm run typecheck
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
```

Read `docs/project-state/PROJECT_STATE_v0.1.md` before continuing development.