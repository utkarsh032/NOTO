# The Noto backend

The cloud half of Noto: Postgres, authentication, storage and the few functions
that need a secret. The design and the reasoning behind it are in
[`R&D/Backend_Plan.md`](../R&D/Backend_Plan.md); this file is how to run it.

**Nothing here is required to work on Noto.** The applications are local-first
and every one of them builds, runs and passes its tests with no Supabase
environment variables at all. If you are not working on the cloud, you can stop
reading.

---

## Layout

```text
supabase/
├── config.toml       The local stack: ports, auth settings, mail catcher
├── migrations/       The schema, in order. Reviewed like any other code
└── functions/
    ├── _shared/      The HTTP layer every function shares
    └── device-register/
```

The service layer the functions call lives in
[`packages/backend`](../packages/backend), not here, so the same code runs in a
function and on a device:

```text
packages/backend/src/
├── ports/       Interfaces the services depend on
├── services/    The rules. No HTTP, no SQL, no vendor
├── supabase/    Adapters implementing the ports, plus the composition root
├── schemas/     Zod, validating the DTOs from @noto/types/api
├── helpers/     Errors, crypto, password rules, validation
└── testing/     In-memory ports, so services test without a database
```

---

## Running it locally

Requires [Docker Desktop](https://docker.com/products/docker-desktop). The
Supabase CLI is a dev dependency of the repository, so there is nothing to
install globally.

```bash
pnpm supabase start      # Postgres, GoTrue, PostgREST, Storage and Studio
pnpm supabase db reset   # Drops, recreates and re-applies every migration
```

| What         | Where                                                     |
| ------------ | --------------------------------------------------------- |
| Studio       | http://localhost:54323                                    |
| API          | http://localhost:54321                                    |
| Postgres     | `postgresql://postgres:postgres@localhost:54322/postgres` |
| Mail catcher | http://localhost:54324 — no address is ever contacted     |

The local stack is free and unlimited. Schema work happens here, not against one
of the two free cloud projects.

---

## Adding a migration

```bash
pnpm supabase migration new add_documents
```

Then edit the generated file and run `pnpm supabase db reset` to apply it from
scratch. Migrations are **append-only** once merged: a migration that has run
in staging is history, and history is edited by writing another migration.

---

## Environment

Nothing in this repository holds a key. The applications read:

| Variable                    | Where it comes from    | Who may see it             |
| --------------------------- | ---------------------- | -------------------------- |
| `NOTO_SUPABASE_URL`         | Project settings → API | anyone; it is public       |
| `NOTO_SUPABASE_ANON_KEY`    | Project settings → API | anyone; RLS is the defence |
| `SUPABASE_SERVICE_ROLE_KEY` | Project settings → API | **Edge Functions only**    |

The service-role key bypasses Row Level Security. It belongs in Supabase's
function secrets and in GitHub Actions, and nowhere else — never in a client
bundle, never in a `VITE_`-prefixed variable, and never in this repository.

`readCloudConfig` in `@noto/config` also accepts the `VITE_` and `EXPO_PUBLIC_`
spellings of the first two, because each bundler exposes variables its own way.

---

## Deploying

```bash
pnpm supabase link --project-ref <ref>
pnpm supabase db push          # applies pending migrations
pnpm supabase functions deploy device-register
```

Staging first, always. The free plan allows two active projects, which is
exactly staging and production — a third would have to displace one of them.

> **A free-plan trap:** a project with no database request for seven days is
> paused, and unpausing is a manual click in the dashboard. Staging will hit
> this; production with real users will not. A scheduled workflow that runs
> `select 1` against staging every few days avoids it.
