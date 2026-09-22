# Lucy Deployment Runbook

This runbook records the known-good Railway production deployment for Lucy.

## Production topology
- **Lucy**: API service
- **Lucy-Frontend**: Vite frontend
- **Postgres**: Railway PostgreSQL
- API → Postgres uses Railway private networking.
- Frontend → API uses `VITE_API_BASE_URL`.

## API Railway settings
Builder: Railpack
Build command: `pnpm --filter @workspace/api-server run build`
Pre-deploy command: `pnpm --filter @workspace/db run push`
Start command: `pnpm --filter @workspace/api-server run start`
Healthcheck: `/api/healthz`
Required variable: `DATABASE_URL=${{ Postgres.DATABASE_PRIVATE_URL }}`

## Frontend Railway settings
Builder: Railpack
Build command: `pnpm --filter @workspace/hospital-mmf run build`
Start command: `pnpm --filter @workspace/hospital-mmf run serve`
Required build-time variable: `VITE_API_BASE_URL=https://${{ Lucy.RAILWAY_PUBLIC_DOMAIN }}`

After changing any `VITE_*` variable, redeploy the frontend because Vite embeds it into the production bundle.

## First deployment / fresh database
1. Deploy the API with the Postgres service available.
2. Ensure `DATABASE_URL` references Postgres's private URL.
3. Run the normal Drizzle pre-deploy command: `pnpm --filter @workspace/db run push`.
4. Verify `/api/healthz`.
5. Deploy the frontend with the API reference variable.
6. Open the frontend and verify that API-backed data loads.

Do not manually create production tables.

## Monorepo build requirements
Railway must use explicit commands because automatic Railpack detection previously failed to identify workspace start commands.
Do not remove the explicit commands unless the repository structure is intentionally changed and deployment is re-tested.

## Lockfile protection
Railway installs with frozen lockfile semantics.
If Railway reports `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`, fix the repository, not Railway:

```bash
pnpm install --no-frozen-lockfile
pnpm install --frozen-lockfile
git add pnpm-lock.yaml
git commit -m "fix: sync pnpm lockfile"
```

Never make `--no-frozen-lockfile` the permanent production workaround.

## Production safety
Do not commit database credentials, Railway API tokens, database dumps, production secrets, or generated deployment credentials.
Keep those in Railway Variables.

## Recovery rule
If a deployment breaks, compare service settings against this document and the files under `railway/` before changing application code.

The known-good topology is: `Lucy-Frontend → Lucy API → Railway Postgres`.