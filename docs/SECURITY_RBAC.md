# Security and RBAC

## Current stage

The first stage has no production identity provider wired in. The UI uses a demo cycle administrator only to communicate the operational context.

## Required production model

Production identity is expected to be Google behind Cloudflare Access. The application must map external identity to local users, roles, permissions, and department scopes.

Required authorization rule: department access is enforced server-side. Hiding a navigation item is never sufficient authorization.

Planned roles include Super Admin, MMF Administrator, MMF Committee, Hospital Administrator, Department Head, Department Member, Reviewer, Finance/Planning, and Read-only Viewer.