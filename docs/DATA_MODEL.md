# Data Model

## Implemented

### `mmf_imports`

Stores one review or committed baseline:

- immutable source filename and SHA-256 hash
- file size and worksheet name
- row and column counts
- department count
- unique, missing, and conflicting identifier counts
- warning and error counts
- review/committed status and timestamps
- preview row JSON
- quality issue JSON

## Planned normalized entities

The next stages will add hospital, user, role, permission, department scope, MMF cycle, legacy item, canonical item, lineage, department assignment, MMF revision, benchmark price revision, vocabulary review, new item proposal, audit event, release, amendment, and export mapping.

Legacy rows and canonical vocabulary must remain separate so that review decisions never erase lineage.