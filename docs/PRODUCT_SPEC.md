# Product Specification

## Purpose

Hospital MMF is an external collaboration and governance layer around the hospital's internal Tools Committee vocabulary and XLSX export. It is not a replacement for the internal system.

## MVP boundary

The MVP will eventually support validated import, canonical vocabulary review, department workspaces, DGLP/ECHS MMF editing, benchmark pricing, forecast views, submissions, freeze, release, and exact legacy export.

The first implementation stage focuses on the import boundary because the legacy workbook is the authoritative interface and contains clinically meaningful data-quality ambiguity.

## Non-negotiable rules

1. Never destroy source data.
2. Never silently merge vocabulary.
3. Never treat PVMS/NIV as a primary key.
4. Keep DGLP and ECHS values separate.
5. Human users decide clinical equivalence.
6. Every consequential action is auditable.
7. Freeze and release are governance states, not cosmetic labels.