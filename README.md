# CommerceOS

CommerceOS is an Angular storefront and admin console backed by an Express REST API and MongoDB. The current implementation is the initial Phase 0 foundation; commerce features and seed data are scheduled for later phases.

## Architecture

```text
Angular SPA (apps/web) → /api/v1 → Express (apps/api) → MongoDB replica set
                                ↘ shared DTOs/enums (packages/shared)
```

The API uses route → controller → service → model/mapper layers. `createApp()` has no listener; `server.ts` validates the environment, connects MongoDB, starts the HTTP server and closes it on shutdown. The sample `/api/v1/system/echo` route demonstrates Zod validation, thin controller, service, mapper and the standard response/error envelopes.

## Prerequisites

- Node.js 24 LTS recommended (22.12+ is supported by Angular 21); npm 11.
- Docker Engine with Compose for the container workflow, or a local MongoDB 7 replica set for `npm run dev`.
- Copy `.env.example` to `.env`. For production, set a unique `JWT_ACCESS_SECRET` of at least 32 characters and enable `COOKIE_SECURE=true`. Development generates an ephemeral secret when the variable is blank.

## Quick start

```sh
cp .env.example .env
npm ci
docker compose up --build
```

The web app is at `http://localhost:4200`, the API at `http://localhost:4000`, Swagger UI at `http://localhost:4000/api/docs`, and health at `http://localhost:4000/health`. The MongoDB container initiates the single-node `rs0` replica set.

For local development with a separately running MongoDB replica set:

```sh
cp .env.example .env
npm ci
npm run dev
```

The Angular dev server proxies `/api` to the API. The local MongoDB URI in `.env.example` uses `directConnection=true` so it can reach a replica-set container whose advertised host is `mongo`.

## Workspaces and scripts

| Workspace         | Purpose                                                                               |
| ----------------- | ------------------------------------------------------------------------------------- |
| `apps/web`        | Angular standalone SPA, lazy storefront/admin shells, design tokens, typed API client |
| `apps/api`        | Express API, MongoDB connection, validation, logging, errors, OpenAPI                 |
| `packages/shared` | Dependency-free enums and DTO interfaces                                              |

`npm run build`, `npm run lint`, and `npm test` run across workspaces. `npm run docker:up` and `npm run docker:down` manage Compose. `npm run seed`, `npm run seed:reset`, and `npm run test:e2e` are reserved for the later phases that introduce seed data and E2E journeys.

## Environment

See `.env.example` for all variables. `MONGODB_URI`, CORS origins, web base URL, upload directory, logging level, mail transport and auth TTLs are read only in `apps/api/src/config/env.ts` and validated at startup. The Angular API base URL is `/api/v1`.

## Testing and current scope

The foundation includes a validated sample API route test and an Angular shell test. Docker is required to verify the full Phase 0 clean-clone exit criterion. Seed accounts and credentials will be documented when the Phase 2/7 seed work is delivered. See `IMPLEMENTATION_CHECKLIST.md` for phase gates and `DECISIONS.md` for version and design decisions.
