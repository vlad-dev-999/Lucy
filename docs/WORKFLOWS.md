# Workflows

## Import review

1. Select an XLSX, XLS, or CSV file.
2. Inspect the workbook in the browser.
3. Validate sheet structure and the first 11 required headers.
4. Detect missing identifiers, malformed MMF values, duplicate identifiers, and conflicting nomenclature.
5. Review counts, issues, and preview rows.
6. Save the review to PostgreSQL.
7. Review the import detail page.
8. Acknowledge findings and commit an immutable baseline when there are no import errors.

## Conflict policy

Identifier matches are candidates for review only. The UI keeps conflicting rows visible and never silently merges them.

## Future governance

Department submission, hospital approval, freeze, release, amendment, and exact legacy export are planned after canonical vocabulary and department workspace stages.