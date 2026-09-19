# Import and Export

## Observed workbook contract

- Worksheet: `Worksheet`
- Data rows: 6,205
- Columns: 219
- Base fields: System ID, PVMS/NIV No., Nomecluature, A/U, previous/current PVMS MMF, previous/current DGLP MMF, previous/current ECHS MMF, LPR
- Department destinations: 69 blocks of PVMS, DGLP, ECHS columns
- Unique PVMS/NIV values: 6,195
- Missing PVMS/NIV records: 1
- Identifier conflict groups: 9

## Current implementation

The browser parser computes a file hash, validates the required base headers, counts departments and rows, separates DGLP/ECHS current MMF values, and produces an issue-aware preview.

## Planned export

The final release must generate the exact legacy worksheet name, header order, 69 department blocks, identifiers, nomenclature, units, and DGLP/ECHS fields expected by the internal Tools Committee. Export must be generated from an immutable release, not mutable live data.