# The server database: native PostgreSQL

`apps/api` (the Node + Hono backend in
[`R&D/Backend_Node_Plan.md`](../../R&D/Backend_Node_Plan.md)) stores accounts and
synced content in PostgreSQL. This guide sets up that database on a developer
machine.

You do **not** need it to work on the apps. Web, desktop and mobile are
local-first and run entirely on their own storage (IndexedDB or SQLite; see
[storage](../architecture/storage.md)). You only need Postgres to run or test
`apps/api`.

> **No Docker.** Noto runs Postgres as a native install, locally and in CI. There
> is no `docker-compose.yml`, and there should not be one. Developing against
> the same engine you ship to is the point; a container adds a daemon and a
> virtualisation layer and gives nothing back here.

## 1. Install PostgreSQL 18

Any version from 17 up runs every feature the schema uses (`citext`, `pgcrypto`,
native enums, row-level security, `tsvector`). 18 is what the team develops
against.

| OS      | How                                                                                                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows | The EDB installer from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/). It installs a Windows service on port 5432 that starts with the machine. |
| macOS   | [Postgres.app](https://postgresapp.com/), or `brew install postgresql@18 && brew services start postgresql@18`.                                                                  |
| Linux   | Your distribution's `postgresql` package, or the [PGDG repository](https://www.postgresql.org/download/linux/) for 18. `sudo systemctl enable --now postgresql`.                 |

Check it answers:

```bash
psql -U postgres -h localhost -c "select version();"
```

On Windows, add `C:\Program Files\PostgreSQL\18\bin` to `PATH` if `psql` is not
found.

## 2. Create the database and its roles

The API never connects as a superuser. It uses two roles (plan §3):

| Role           | Used by                                                                                         | Row-level security                                                       |
| -------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `noto_api`     | every request, through `DATABASE_URL`                                                           | **Applies.** Not the owner of any table, not `bypassrls`.                |
| `noto_service` | six server-only paths (audit log, rate limits, billing webhook), through `DATABASE_SERVICE_URL` | Bypassed, deliberately. Never used by a route that takes a workspace id. |

As the `postgres` superuser:

```sql
create database noto;

create role noto_api login password 'change-me-locally';
create role noto_service login password 'change-me-locally' bypassrls;

\c noto
grant usage on schema public to noto_api, noto_service;
```

The migrations grant table privileges as they create tables, so there is
nothing more to do by hand. Use real passwords on anything that is not your own
laptop.

## 3. Point the API at it

`apps/api/.env` (ignored by git):

```dotenv
DATABASE_URL=postgres://noto_api:change-me-locally@localhost:5432/noto
DATABASE_SERVICE_URL=postgres://noto_service:change-me-locally@localhost:5432/noto
# Migrations only: the database owner, because they create tables and grants.
DATABASE_MIGRATE_URL=postgres://postgres:your-postgres-password@localhost:5432/noto
```

`apps/api/src/env.ts` validates these at startup. A missing value stops the
process at boot rather than on the first sign-in.

## 4. Migrations

Migrations are plain, numbered `.sql` files in `apps/api/db/migrations/`,
applied in filename order by a small runner. Each file runs in its own
transaction, and a `schema_migrations` table records what has run.

```bash
pnpm db:migrate     # apply everything not yet applied
pnpm db:status      # list what would run; change nothing
pnpm db:psql        # a psql shell on DATABASE_URL
```

Never edit a migration that has run anywhere but your own machine. Add a new one.

## 5. Tests

Integration tests in `apps/api/test/` create a throwaway database per run
(`noto_test_<random>`), migrate it, and drop it afterwards, so they never touch
your development data. They need a role allowed to create databases:

```sql
alter role postgres createdb;  -- already true for the installer's superuser
```

In CI, `ci.yml` starts the GitHub-hosted runner's PostgreSQL service
(`sudo systemctl start postgresql` on Ubuntu) rather than a container.

## Troubleshooting

| Symptom                                        | Cause and fix                                                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connection refused` on 5432                   | The service is not running. Windows: `services.msc` → postgresql-x64-18 → Start. macOS: `brew services start postgresql@18`.                         |
| `password authentication failed`               | Wrong password in `.env`, or `pg_hba.conf` requires a method your client does not send. Local installs default to `scram-sha-256`, which works.      |
| Every query returns no rows, even your own     | You are connected as `noto_api` without a caller set. Requests set `app.user_id` inside their transaction (plan §3); a bare `psql` session does not. |
| `permission denied for table …` in a migration | The migration ran as `noto_api`. `DATABASE_MIGRATE_URL` must name the database owner (`postgres` locally).                                           |
| Two Postgres versions installed                | Each needs its own port. Check with `psql -p 5433 …`, and set the port in `DATABASE_URL`.                                                            |
