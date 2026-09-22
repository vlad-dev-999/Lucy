# Railway production deployment

This directory preserves the service deployment configuration used by the working Railway production environment.

## Services

- **Lucy** — API service
- **Lucy-Frontend** — Vite frontend
- **Postgres** — Railway-managed PostgreSQL

## API

Build:

`pnpm --filter @workspace/api-server run build`

Start:

`pnpm --filter @workspace/api-server run start`

Healthcheck:

`/api/healthz`

Pre-deploy schema push:

`pnpm --filter @workspace/db run push`

The API uses Railway's `DATABASE_URL` reference to the Postgres service.

## Frontend

Build:

`pnpm --filter @workspace/hospital-mmf run build`

Serve:

`pnpm --filter @workspace/hospital-mmf run serve`

Required build-time variable:

`VITE_API_BASE_URL=https://${{ Lucy.RAILWAY_PUBLIC_DOMAIN }}`

The Vite variable is intentionally a Railway reference rather than a hard-coded generated domain.

## Important

Secrets and live database data are **not** stored in Git.

The Drizzle schema and application code are stored in Git. The production PostgreSQL data remains in Railway.

The JSON files in this directory are service configuration snapshots. They are not automatically discovered as root-level Railway Config-as-Code files. Railway's current Infrastructure as Code system uses `.railway/railway.ts`; however, the current IaC DSL does not expose Railway's `preDeployCommand`, so the working production pre-deploy schema push remains a Railway service setting until that limitation is resolved.

Before migrating the live project to Railway IaC, run `railway config pull` against the production project and review `railway config plan`. Do not apply an unreviewed plan to production.
