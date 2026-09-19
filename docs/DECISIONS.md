# Decisions

## The workbook defines the import contract

The supplied workbook is authoritative. The application does not invent a generic spreadsheet schema.

## Canonical IDs are internal

PVMS/NIV values can be blank, duplicated, or conflicted. They cannot be used as database primary keys.

## Browser inspection for Stage 1

Parsing happens in the browser so users can see structural and semantic findings before saving a review. The API remains responsible for persistence and commit-state changes.

## Preview-first baseline

Stage 1 stores provenance, quality findings, and preview rows. Full protected source-object storage is intentionally deferred to the App Storage hardening stage.