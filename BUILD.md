# Lucy Build Instructions

## Source of truth

- Repository: `vlad-dev-999/Lucy`
- Branch: `main`
- Package manager: **pnpm**
- This is a **pnpm workspace monorepo**.
- Do not introduce npm/yarn lockfiles.

## Required build environment

Use the Node/pnpm versions declared or locked by the repository. Railway currently builds with Railpack.

Install dependencies with the lockfile:

```bash
pnpm install --frozen-lockfile
```

If frozen installation reports a lockfile/config mismatch, **do not bypass it in Railway**. Fix the repository lockfile locally:

```bash
pnpm install --no-frozen-lockfile
pnpm install --frozen-lockfile
```

Then commit the resulting `pnpm-lock.yaml`.

## Repository checks

Before deployment:

```bash
pnpm run typecheck
git diff --check
```

Database schema verification/push:

```bash
pnpm --filter @workspace/db run push
```

## API service

Package:

`artifacts/api-server`

Build:

```bash
pnpm --filter @workspace/api-server run build
```

Start:

```bash
pnpm --filter @workspace/api-server run start
```

The start script is responsible for starting the compiled API and must use Railway's `PORT`. Do not hard-code a production port.

Railway healthcheck:

`/api/healthz`

## Frontend service

Package:

`artifacts/hospital-mmf`

Build:

```bash
pnpm --filter @workspace/hospital-mmf run build
```

Serve:

```bash
pnpm --filter @workspace/hospital-mmf run serve
```

The Vite configuration must remain build-safe when Railway does not provide `PORT` or `BASE_PATH` during the build.

Current safe defaults are:

- `PORT` → `5000`
- `BASE_PATH` → `/`

Do not reintroduce mandatory build-time failures for these variables.

## Frontend → API routing

The frontend must call the API service, not its own Railway origin.

`artifacts/hospital-mmf/src/main.tsx` sets:

```ts
setBaseUrl(import.meta.env.VITE_API_BASE_URL || null);
```

Railway production should provide:

```text
VITE_API_BASE_URL=https://${{ Lucy.RAILWAY_PUBLIC_DOMAIN }}
```

`VITE_*` variables are baked into the Vite bundle at build time. A change requires a frontend rebuild/redeploy.

## Do not "fix" these deployment issues by changing application architecture

Do not:

- create a Railway Function to run migrations;
- create tables manually with ad-hoc SQL;
- replace the Drizzle schema push with a separate schema implementation;
- add temporary fixtures to make production appear populated;
- switch the database to an alternative service just to make deployment easier;
- hard-code the generated Railway API domain into application source;
- hard-code Railway's dynamic `PORT`;
- remove the pnpm lockfile;
- weaken `--frozen-lockfile` as the permanent Railway solution.

The application schema, fixture/import workflow, and deployment configuration are part of the repository's reproducible build.

## Railway database initialization

The API service should run the repository's normal Drizzle schema push before deployment:

```bash
pnpm --filter @workspace/db run push
```

The API's `DATABASE_URL` should reference the Railway Postgres private URL.

Keep secrets and database data out of Git.

## Known Railway failure modes

### "No start command detected"

Railpack may not infer the correct workspace service from the monorepo. Configure explicit build/start commands for each Railway service.

### "ERR_PNPM_LOCKFILE_CONFIG_MISMATCH"

This means `package.json`/workspace dependency configuration and `pnpm-lock.yaml` are out of sync. Regenerate and commit the lockfile; do not work around it with a permanently non-frozen install.

### API health works but app has no data / tables are missing

Check that:

1. `DATABASE_URL` points to Railway Postgres.
2. The API pre-deploy command runs `pnpm --filter @workspace/db run push`.
3. The deployment succeeded after the schema push.

Do not manually create the tables.

### Frontend loads but API calls fail

Check `VITE_API_BASE_URL` on the frontend service. Because it is a Vite build-time variable, redeploy the frontend after changing it.

## Deployment principle

Make the smallest repository change necessary. Preserve the working production topology:

`Lucy API → Railway Postgres`

`Lucy-Frontend → Lucy API`

The Git repository is the source of truth for application code, schema, build commands, and documented deployment requirements. Railway remains the source of truth for secrets and live database state.
