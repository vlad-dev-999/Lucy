# Hospital MMF — Project State v0.1

## Product

Hospital MMF Command Centre is a desktop governance workspace around the hospital's internal Tools Committee workbook.

## Current Stage

Stage 1: workbook inspection, validation, review persistence, and baseline status.

## Implementation Status

- Workbook inspection: IMPLEMENTED
- Structural validation: IMPLEMENTED
- Semantic identifier checks: IMPLEMENTED
- Browser preview: IMPLEMENTED
- Import review persistence: IMPLEMENTED
- Immutable baseline status transition: IMPLEMENTED
- Vocabulary review workflow: IMPLEMENTED — runtime verified through the API and desktop review queue
- Source workbook byte storage: PLANNED
- Canonical vocabulary: PLANNED
- Department workspace: SCAFFOLD
- MMF editing/history: PLANNED
- Benchmark prices/forecast: PLANNED
- Authentication/RBAC: PLANNED
- Audit log: PLANNED
- Freeze/release/amendment: PLANNED
- Exact legacy export: PLANNED

## Workbook Findings

The fixture has one worksheet named `Worksheet`, 6,205 data rows, 219 columns, and 69 department destinations. The first 11 columns are hospital-level fields. Each department destination is a three-column PVMS/DGLP/ECHS block. There are 6,195 unique nonblank PVMS/NIV values, one missing identifier, and nine duplicate identifier groups with differing nomenclature. DGLP and ECHS values are separate fields.

## Repository Structure

See `replit.md`. The main UI is in `artifacts/hospital-mmf`; the API route is `artifacts/api-server/src/routes/mmf.ts`; the OpenAPI contract is `lib/api-spec/openapi.yaml`; the import table is `lib/db/src/schema/mmf.ts`.

## Database State

The `mmf_imports`, `canonical_items`, and `vocabulary_reviews` tables are pushed to the development PostgreSQL database. The API returns the review queue successfully after schema synchronization.

## Completed Work

- Command centre overview route
- Import review route with file selection and actual browser parsing
- SHA-256 hashing
- Header, missing identifier, malformed MMF, duplicate identifier, and conflicting nomenclature checks
- Import history/detail routes
- Commit status transition guarded against import errors
- Department list and review queue views
- Generated React Query client and Zod schemas

## Known Limitations

- Uploaded workbook bytes are not yet persisted to App Storage.
- Preview rows are stored, not the complete source row set.
- Demo identity and authorization are not production-ready.
- Canonical vocabulary UI is not yet implemented; the vocabulary review workflow is available for review decisions.
- Export is not implemented.

## Tests

Runtime verification completed after managed workflows were restarted: `GET /api/healthz` returned 200, `GET /api/vocabulary-reviews?limit=20` returned 200 with review records, and `/review-queue` rendered successfully. Browser console contained only normal Vite/React development messages.

## Business Rules

- Do not silently merge identifier conflicts.
- Blank PVMS/NIV is a warning, not an automatic import error.
- Keep DGLP and ECHS separate.
- A committed import must not be edited in place.
- Do not call benchmark requirements actual expenditure.

## Current UI

- `/` command centre
- `/imports` guided import review and history
- `/imports/:id` metadata, findings, preview, and commit control
- `/departments` detected destinations
- `/review-queue` vocabulary review workflow

## Next Stage

Add protected App Storage source-object persistence, full legacy-row storage with source lineage, and Canonical Vocabulary UI.

## Do Not Break

The supplied workbook remains the authoritative legacy contract. PVMS/NIV is not the primary key. DGLP/ECHS remain separate. Review findings must remain visible and auditable.

## Git Commit

`feat: implement vocabulary review workflow`