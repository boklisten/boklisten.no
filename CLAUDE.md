# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Rules

These rules override default agent behavior — follow them on every task:

1. **Interview before starting.** Before any task that is not a trivial, fully-specified fix, interview the user about scope, assumptions, and direction. Ask as many questions as you need (use `AskUserQuestion` or plain questions) and keep asking until the task is unambiguous. Do not start implementing on guessed requirements.
2. **Never create git branches, never commit, and never create documentation files** (README, *.md, docs/) unless the user explicitly asks for that specific action in this session. Editing the working tree is fine.
3. **Use the `frontend-design` skill whenever designing new UI or reshaping existing UI.**
4. **Verify your changes with Playwright** (the MCP browser) whenever it makes sense. The browser is already logged in with an admin account on `localhost:3000`. You may create additional users through the UI and modify the database directly to set permission levels when a test needs a different role.
5. **The staging databases are yours to modify.** `backend/.env.local` points at the Railway staging DBs; change whatever data you need — staging resets every night.
6. **Finish every task by running `bun fix`** (lint:fix + typecheck + format) and resolving everything it reports before declaring the task done.

## Project Overview

`boklisten.no` is a monorepo for a library and book management service for upper secondary schools. It unifies what were previously separate `bl-web` and `bl-admin` projects into a single customer-facing site with integrated administration.

## Workspaces

- **`backend/`** — AdonisJS v7 REST API. Dual-DB: legacy data on MongoDB/Mongoose v9, new tables on Postgres via Lucid (active migration in progress).
- **`frontend/`** — TanStack Start (React 19) SPA with Mantine v9 UI.
- **`cron_jobs/`** — Standalone scheduled tasks (DB cleanup, prod→staging sync).

The frontend imports from `@boklisten/backend`: shared types (`./shared/*`), the Tuyau RPC registry (`./registry`), and Tuyau data types (`./data`). `backend/.adonisjs/client/` is **generated and committed** because the frontend needs it at build time — don't gitignore it.

## Commands

Run from the repo root unless noted:

```bash
bun install          # Install all workspace dependencies
bun dev              # Start frontend (:3000) and backend (:3333) concurrently
bun build            # Build all workspaces
bun run test         # Run backend tests (the only workspace with tests; bare `bun test` invokes Bun's own runner and fails)
bun lint             # oxlint across all workspaces
bun lint:fix         # Auto-fix lint issues
bun format           # oxfmt formatter
bun format:check     # Check formatting
bun typecheck        # TypeScript type checking for all workspaces
bun fix              # Runs lint:fix + typecheck + format sequentially
bun ace              # AdonisJS CLI (e.g. bun ace make:controller Foo)
bun migrate:backend  # Run Lucid Postgres migrations (--force; also runs in Railway predeploy)
```

Backend commands (tests, lint, `bun fix`) require **Node 24** (`backend/.nvmrc`), but non-interactive shells here default to v22 with cryptic `.ts`-extension errors — prefix with `fnm exec --using=24 <cmd>` if `node -v` disagrees.

**Run a single backend test file:**

```bash
cd backend && bun run test --files tests/blid_service.spec.ts
```

**Production start (backend requires custom ENV_PATH):**

```bash
bun build:backend && ENV_PATH=../ bun start:backend
bun build:frontend && bun start:frontend
```

## Environment Setup

Copy `.env.example` → `.env.local` in both `backend/` and `frontend/`. Minimum required:

- `backend/.env.local`: `MONGODB_URI`, `POSTGRES_URL`, `APP_KEY`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`
- `frontend/.env.local`: `VITE_API_URL` (point to backend, e.g. `http://localhost:3333`)

`backend/start/env.ts` is the source of truth for required vars (validated at boot — boot fails if any are missing).

## Architecture

### Backend (`backend/`)

AdonisJS follows a standard MVC layout:

- `app/models/*.ts` — **Lucid** models; each extends a class from `database/schema.ts`
- `app/models/mongoose/*.schema.ts` — Legacy **Mongoose** schemas (still in active use during migration)
- `app/controllers/` — Route handlers; auth has its own subdirectory
- `app/services/` — Business logic
- `app/services/legacy/` — Legacy collection-endpoint pattern; large surface still in active use during migration
- `app/validators/` — VineJS request validators
- `app/transformers/` — Response shaping
- `app/middleware/` — HTTP middleware
- `app/exceptions/` — Custom exception classes
- `app/types/` — Backend-internal TS types
- `start/routes.ts` — All route definitions
- `start/env.ts` — Validated environment variable declarations
- `config/` — Per-concern config files (auth, cors, database, logger, etc.)
- `database/schema.ts` — **Auto-generated** Lucid base classes; do not edit manually (regenerated by `bun ace migration:run`)
- `database/migrations/` — Lucid migration files
- `shared/` — TypeScript types re-exported to the frontend via `package.json` `exports`
- `tests/` — Japa unit tests (`*.spec.ts`); uses Chai assertions and Sinon mocking

Backend uses Node subpath imports defined in `backend/package.json` `imports`: `#controllers/*`, `#services/*`, `#models/*`, `#shared/*`, `#database/*`, `#validators/*`, `#config/*`. Always import via these aliases — never via relative `../../app/...` paths.

Emails and SMS are sent imperatively from services (e.g. `app/services/dispatch_service.ts` for SendGrid). There is no event/listener layer.

### Frontend (`frontend/`)

TanStack Start uses file-based routing:

- `src/routes/` — Pages; route groups in parentheses: `(administrasjon)`, `(offentlig)`, `(legacy)`
- `src/features/` — Feature modules (auth, order, checkout, payment, cart, items, branches, matches, etc.); each encapsulates its own components, hooks, and queries
- `src/shared/` — Cross-feature hooks, utilities, and components

Data fetching uses TanStack React Query v5 wrapped around the Tuyau RPC client (`src/shared/utils/publicApiClient.ts` builds it from `@boklisten/backend/registry`). Forms use TanStack React Form v1.

## Testing

Write Japa specs (`backend/tests/*.spec.ts`, Chai + Sinon) for new backend business logic. The frontend has no automated tests — verify UI changes manually with Playwright instead (see Working Rules).

## CI/CD & Branches

- `main` → auto-deploys to **staging**
- `production` → auto-deploys to **live**

GitHub Actions runs: format check → typecheck → lint → build backend → build frontend → backend tests.

## Deployment

Both services deploy to **Railway** via per-service config-as-code:

- `frontend/railway.json` → frontend service (Service Settings → Config-as-code Path: `/frontend/railway.json`)
- `backend/railway.json` → backend service (Service Settings → Config-as-code Path: `/backend/railway.json`)

Both services have `root_dir` empty so Bun workspace deps resolve at build time. Both pinned to `europe-west4-drams3a` (Amsterdam). Staging is serverless (`sleepApplication: true`); production stays warm. Backend runs `bun migrate:backend` via `preDeployCommand` on every deploy in every environment.

Custom domains and env vars (e.g. `VITE_API_URL`, `POSTGRES_URL`) are dashboard-only — they cannot be set in `railway.json`.

## Key External Integrations

| Service          | Purpose                                            |
| ---------------- | -------------------------------------------------- |
| Vipps Mobile Pay | Payment processing                                 |
| SendGrid         | Transactional email (sent from `dispatch_service`) |
| Twilio           | SMS notifications                                  |
| Bring            | Shipping/logistics                                 |
| Sentry           | Error tracking (both frontend and backend)         |
