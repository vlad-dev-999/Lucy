# Hospital MMF Command Centre

Hospital MMF Command Centre is a desktop-first governance workspace for validating the hospital's legacy Monthly Maintenance Figure workbook before it becomes an immutable cycle baseline.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/hospital-mmf run dev` — run the web application through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push development DB schema changes

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- React + Vite desktop web application
- Express 5 API at `/api`
- PostgreSQL + Drizzle ORM
- OpenAPI-first API contracts with Orval-generated React Query hooks and Zod schemas
- XLSX parsing in the browser for the guided import review

## Where things live

- `artifacts/hospital-mmf/src/App.tsx` — web routes, import inspection flow, and command centre UI
- `artifacts/hospital-mmf/src/index.css` — product theme and visual language
- `artifacts/api-server/src/routes/mmf.ts` — overview, departments, import review, and commit endpoints
- `lib/api-spec/openapi.yaml` — API source of truth
- `lib/db/src/schema/mmf.ts` — import metadata, preview, quality findings, and baseline status
- `docs/` — product, architecture, data model, workflow, security, roadmap, and handoff documentation
- `docs/project-state/PROJECT_STATE_v0.1.md` — current handoff state

## Architecture decisions

- Excel is treated as a legacy interface; the database stores governed import metadata rather than mirroring the 219-column sheet.
- PVMS/NIV values are identifiers, never primary keys or proof of clinical equivalence.
- DGLP and ECHS values remain separate throughout inspection and preview.
- A commit changes an import from review to immutable baseline status; the source review is not overwritten.
- Browser inspection uses the workbook's observed first 11 columns and 69 three-column department blocks.

## Product

The first stage provides a command centre, department inventory, review queue, guided workbook inspection, import history, preview rows, quality findings, and an immutable baseline commit control.

## Gotchas

- The artifact workflow supplies `PORT` and `BASE_PATH`; direct Vite builds need both values explicitly.
- Run codegen after every OpenAPI change and refresh shared declarations before leaf typechecks.
- The supplied fixture has one worksheet, 6,205 records, 219 columns, 69 destinations, 6,195 unique identifiers, one missing identifier, and nine identifier conflict groups.
- Source workbook bytes are not yet persisted to App Storage; the current first stage persists hash, provenance, preview, and findings. Full protected object storage is the next hardening step.