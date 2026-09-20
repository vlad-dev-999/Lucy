---
name: Development database sync after import
description: Imported MMF workspaces may have an empty development schema even when the project-state baton says it was synchronized.
---

Run the repository's existing development schema push before API lifecycle verification when the database reports missing MMF tables. This restores the declared schema without changing the application implementation.

**Why:** The imported workspace initially had no MMF tables, so the first API request failed before reaching assignment logic; the locked schema push restored the expected tables and verification then passed.

**How to apply:** Treat a missing-table error as an environment setup issue first, synchronize the current repository schema, then rerun the API checks before editing routes.