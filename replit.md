# Blessing Funeral Scheme

Operations workspace for managing funeral-scheme members, branches, contributions, claims, and staff access.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-server test` — run role and evidence validation tests
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string; `BOOTSTRAP_ADMIN_EMAIL` — verified OIDC email allowed to create the initial administrator
- Optional env: `PUBLIC_APP_URL` — canonical public app origin used in staff sign-in links

After schema changes, apply them to a development database with `pnpm --filter @workspace/db run push`. Review production schema changes before applying them to production.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/blessing-funeral-scheme-app` — React operations interface
- `artifacts/api-server` — authenticated operations API and route-level access checks
- `lib/db/src/schema/index.ts` — PostgreSQL/Drizzle source-of-truth schema
- `lib/api-spec/openapi.yaml` — API contract; generated clients and validators live in `lib/api-client-react` and `lib/api-zod`
- `lib/api-zod/src/permissions.ts` — shared role capability policy

## Architecture decisions

- Hosted OIDC establishes identity; the staff directory assigns role and branch scope.
- The initial administrator must match `BOOTSTRAP_ADMIN_EMAIL` and have a verified OIDC email.
- Coordinators and support staff are limited to their assigned active branch; managers and administrators can access all branches.
- Branches are deactivated rather than deleted so historical records retain valid references.
- Claim evidence is stored in PostgreSQL, limited to 5 MB, and restricted to PDF, JPEG, and PNG signatures.

## Product

The workspace supports member enrollment and profile maintenance, beneficiary records, contribution tracking, claim review and evidence files, branch reporting and lifecycle management, operational settings, and staff access management. Settings are persisted in PostgreSQL. Staff invitations produce a shareable OIDC sign-in link; email delivery is not configured in this repository.

## User preferences

No additional user preferences recorded.

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after editing the OpenAPI contract.
- Apply new Drizzle schema fields/tables before using settings or claim evidence endpoints.
- Configure `BOOTSTRAP_ADMIN_EMAIL` before the first sign-in; other unassigned users are not promoted automatically.
- Staff sign-in links can be copied and shared; outbound email and scheduled email reminders require a configured provider and are not implemented.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
