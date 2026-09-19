# Architecture

## Runtime

The web artifact is a React/Vite desktop application at `/`. The Express API is mounted at `/api` and uses the shared PostgreSQL database through Drizzle.

## Contract flow

`lib/api-spec/openapi.yaml` is the source of truth. Orval generates:

- React Query hooks in `lib/api-client-react`
- Zod request/response schemas in `lib/api-zod`

The server parses request bodies with generated Zod schemas and returns parsed response objects.

## Stage 1 data flow

The browser reads a selected workbook with SheetJS. It inspects the first worksheet, validates the observed legacy headers, extracts row-level preview data, computes a SHA-256 hash, and sends the governed review payload to the API. PostgreSQL stores provenance, quality findings, preview rows, and commit status.

The source file bytes are not yet stored in App Storage. That is an explicit next-stage hardening item, not an assumed capability.