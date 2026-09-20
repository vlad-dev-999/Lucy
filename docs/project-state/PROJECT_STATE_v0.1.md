# Hospital MMF — Project State v0.1

## Product

Hospital MMF Command Centre is a desktop governance workspace around the hospital's internal Tools Committee workbook.

## Current Stage

Stage 3 — Ticket 3: Department MMF Editing.

## Implementation Status

- Workbook inspection: IMPLEMENTED
- Structural validation: IMPLEMENTED
- Semantic identifier checks: IMPLEMENTED
- Browser preview: IMPLEMENTED
- Import review persistence: IMPLEMENTED
- Immutable baseline status transition: IMPLEMENTED
- Vocabulary review workflow: IMPLEMENTED — runtime verified through the API and desktop review queue
- Source workbook byte storage: PLANNED
- Canonical vocabulary: IMPLEMENTED — searchable, paginated list with server-side sorting and detail view
- Department item assignments: IMPLEMENTED — persistence, API, duplicate protection, ACTIVE/REMOVED lifecycle, real department IDs, and history preservation
- Department workspace: IMPLEMENTED — runtime verified with a persisted department, active assignment, removed-assignment exclusion, canonical detail, and source lineage
- MMF editing/history: IMPLEMENTED — VERIFIED with independent DGLP/ECHS persistence, validation, department scope enforcement, and revision history
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

The MMF, canonical vocabulary, review, department, lineage, department assignment, and department MMF revision tables are pushed to the development PostgreSQL database. The API returns 69 persisted department IDs. Runtime verification used the supported fixture/bootstrap path to create a canonical item and assignments: the active assignment is returned while the removed assignment is excluded. MMF changes persist against the assignment and create revision records independently of the canonical item.

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
- Canonical vocabulary list and detail views are implemented and runtime-verified, including preserved legacy lineage and review-history fields; the vocabulary review workflow remains available for review decisions.
- Export is not implemented.

## Tests

Stage 3 Ticket 2 runtime verification completed against persisted development data: API health returned HTTP 200; departments returned 69 real IDs; the Department Workspace loaded through the web preview; selecting the first real department loaded one ACTIVE assignment; a REMOVED assignment was excluded from the active list; canonical detail showed the canonical item, department assignment, and preserved source lineage; and the UI rendered with normal Vite/React browser messages and no application errors.

Stage 3 Ticket 3 runtime verification completed against supported development fixture/bootstrap data: 69 departments were present; a canonical item and ACTIVE/REMOVED assignments were created through the documented APIs; DGLP and ECHS updates each persisted independently and survived reload; the MMF revision record captured the assignment, department, canonical item, prior/new DGLP and ECHS values, user, and timestamp; a REMOVED assignment could not be edited; and a different department could not manipulate the assignment. The actual Department Workspace preview rendered the inline editor correctly, with no browser-console application errors. Negative and malformed MMF payloads are rejected with HTTP 400 and do not reach persistence. API and web typechecks and production builds passed after the validation-response fix.

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
- `/departments` Department Workspace with active assignment list, client-side search/filter, canonical/source detail, and inline DGLP/ECHS MMF editing for ACTIVE assignments
- `/review-queue` vocabulary review workflow
- `/canonical-vocabulary` searchable, paginated canonical vocabulary
- `/canonical-vocabulary/:id` canonical item detail and lineage

## Next Stage

Stage 4 — New Item Proposals + Common-use MMF + Department Submission. Do not implement benchmark prices, RBAC, freeze/release, amendments, or export as part of Ticket 3.

## Do Not Break

The supplied workbook remains the authoritative legacy contract. PVMS/NIV is not the primary key. DGLP/ECHS remain separate. Review findings must remain visible and auditable.

## Git Commit

`feat: implement department mmf editing`
