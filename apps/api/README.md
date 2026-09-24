# @noto/api

Noto's server: accounts today, sync next. Node + [Hono](https://hono.dev) +
PostgreSQL, built to [`R&D/Backend_Node_Plan.md`](../../R&D/Backend_Node_Plan.md).

The rules (rate limits, the bot check, the security log, the identical answer
for every failed sign-in) live in `@noto/backend`'s services and are tested
there without a server. This package is the HTTP around them, plus the
Postgres plumbing.

## Run it

```bash
cp apps/api/.env.example apps/api/.env   # fill in the postgres password and JWT_SECRET
pnpm db:bootstrap                        # once: database + login roles
pnpm db:migrate
pnpm dev:api                             # http://localhost:8787
```

Setup in detail: [`docs/development/database.md`](../../docs/development/database.md). Deploying: [`docs/deployment/api.md`](../../docs/deployment/api.md).

## Layout

| Path               | What it is                                                                    |
| ------------------ | ----------------------------------------------------------------------------- |
| `src/index.ts`     | Composition root: environment → ports → server. Also starts the jobs.         |
| `src/app.ts`       | The Hono app and the middleware chain, in order.                              |
| `src/env.ts`       | Every environment variable, validated at boot.                                |
| `src/db/pool.ts`   | **The only file that may import `pg`** (lint enforces it).                    |
| `src/db/tx.ts`     | `asUser` (RLS applies, caller named per transaction) and `asService`.         |
| `src/controllers/` | `/v1/auth` and `/v1/account`. Thin: body → service → `respond`.               |
| `src/security/`    | argon2id hashing and HS256 access tokens.                                     |
| `src/jobs/`        | Scheduled sweeps (`node-cron`, in-process; `NOTO_RUN_JOBS=false` to disable). |
| `db/migrations/`   | Plain numbered `.sql`, applied by `src/db/migrations.ts`.                     |
| `test/`            | Unit tests, plus RLS and route tests against a throwaway database.            |

The Postgres adapters themselves are in `packages/backend/src/postgres/`.

## Routes

`/healthz`, `/readyz`, and under `/v1`:

- **auth**: `signup`, `signin`, `refresh`, `signout`, `signout-all`,
  `session`, `verify-email`, `verify-email/resend`, `password/forgot`,
  `password/reset`, `password/change`
- **account**: `profile` (GET, PATCH), `email/change`, `settings` (GET, PUT),
  `devices` (GET, POST, DELETE `:id`), `sessions` (GET, DELETE `:id`), `events`

Errors are `ApiErrorDto` from `@noto/types/api`. Access tokens last 15 minutes;
refresh tokens rotate, and presenting a rotated one again signs the user out
everywhere.

## Commands

| Command                                                  | Does                                             |
| -------------------------------------------------------- | ------------------------------------------------ |
| `pnpm --filter @noto/api build`                          | Bundles to `dist/index.js` (`start` runs it)     |
| `pnpm --filter @noto/api test`                           | Needs `NOTO_TEST_DATABASE_URL` for the DB suites |
| `pnpm --filter @noto/api db:import-supabase <file.json>` | One-time import of Supabase accounts (cutover)   |
| `pnpm --filter @noto/api db:send-reset-mails`            | Mails imported accounts a link to set a password |
