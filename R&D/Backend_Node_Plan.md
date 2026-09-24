# Noto — Backend Plan (Node.js + PostgreSQL)

The Node replacement for [`Backend_Plan.md`](Backend_Plan.md). That document
stays the reference for _what_ the backend does — the data model, the flows, the
security rules. This one says how the same thing is built when Supabase is not
in the picture: who issues a token, who checks a permission, and which file a
request lands in.

Four decisions were taken before this was written, and they shape everything
below:

1. **All controller groups are in scope** — auth, account, workspaces, sync,
   files, search, billing, AI, sharing.
2. **Identity is password + email verification + reset.** OAuth and MFA are
   designed for but not built (§4.4).
3. **Content reaches the server through sync alone.** There is no REST CRUD for
   documents, folders or memory items — §6.3 explains why, and what it costs.
4. **Node first, Workers kept open.** One file imports the driver (§1.1).

Read §0 first. It is the honest accounting, and it is the part that decides
whether this is worth doing.

---

## 0. What changes, and what does not

Supabase is four products, not one. Dropping it drops four things, and they have
very different replacement costs.

| What Supabase gave                  | Cost to replace                     | Replacement                                   |
| ----------------------------------- | ----------------------------------- | --------------------------------------------- |
| **Postgres**                        | ~zero                               | Postgres. Same engine, different host.        |
| **PostgREST** — ~76 CRUD endpoints  | **53 routes to write**              | Hono controllers (§6)                         |
| **GoTrue** — identity               | **3 new tables, 11 routes**         | Own it (§4.1, §9)                             |
| **RLS as the enforcement point**    | one SQL helper + a transaction rule | Keep RLS, drive it from your own session (§3) |
| **Storage**                         | small                               | Cloudflare R2, S3 API                         |

**What does not change at all:**

- `packages/backend/src/ports/` — every port stays exactly as written.
- `packages/backend/src/services/` — `AuthService`, `AccountService` and their
  tests do not know a vendor's name and never did. The lockout rule, the rate
  limits, the audit writes and the timing padding all survive untouched.
- `packages/database/` — SQLite on desktop and mobile, Dexie on web. The local
  layer is the product; it is not up for renegotiation.
- The data model in `Backend_Plan.md` §5, minus `profiles`, plus the three
  identity tables in §4.1.
- Every DTO in `packages/types/src/api/`.

**What is genuinely new work, stated plainly:**

1. **Owning identity.** Password hashing, refresh-token rotation with reuse
   detection, email verification, password reset. `Backend_Plan.md` §1.1 called
   this "the single worst thing to own by accident". Owning it on purpose, with
   a written design, is a different proposition — but it is still the riskiest
   part of this plan and it is where the review effort belongs.
2. **53 HTTP routes** that PostgREST used to generate.
3. **A server that costs money every month**, whether anyone uses Noto or not.

**The table count goes 19 → 21**, and to 24 if OAuth and MFA are ever built.
`profiles` becomes `users`; `sessions` and `email_tokens` arrive with it.

---

## 1. Stack

| Layer           | Choice                                        | Why this and not the other thing                                                                                           |
| --------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Runtime         | **Node.js 20.19+**                            | Already the repo's `engines` floor. Web Crypto is built in, which `helpers/crypto.ts` already relies on.                    |
| Framework       | **Hono**                                      | Handlers are `Request → Response`, so `supabase/functions/*/index.ts` ports almost line-for-line. Runs on Node and Workers. |
| Database        | **PostgreSQL 17**                             | The 451 lines of SQL already written use `citext`, `pgcrypto`, native enums, RLS and `tsvector`.                            |
| Host            | **Neon**                                      | No 7-day pause, scale-to-zero, a database branch per pull request. Swappable for any Postgres.                             |
| Driver          | **`pg`** (node-postgres) + pool                | Boring, and a real pool is what makes the `SET LOCAL` rule in §3 safe.                                                      |
| Query layer     | **Kysely**                                    | Typed SQL, not an ORM. No entity graph, no lazy loading, and raw SQL when a query wants to be raw — which `sync_push` does. |
| Migrations      | **plain `.sql` + a small runner**              | The seven files in `supabase/migrations/` move across nearly unchanged. Reviewed in pull requests, as they are now.         |
| Local dev DB    | **A native Postgres install**                 | Not SQLite. Developing against a different engine than you ship to is how `citext` and RLS surprise you in production. No Docker — see the note below. |
| Local client DB | **SQLite / Dexie — unchanged**                | `packages/database/`. See §5 for the two migrations sync needs.                                                              |
| Passwords       | **argon2id** (`@node-rs/argon2`)              | What GoTrue used. Not bcrypt — the 72-byte limit is why `checkPassword` counts bytes today.                                  |
| Access tokens   | **JWT, 15 min** (`jose`)                      | Short, stateless, never stored. `jose` because it is the same API in Node and Workers.                                      |
| Refresh tokens  | **opaque, rotating, in `sessions`**           | A stored token can be revoked; a JWT cannot. Reuse detection needs a row (§9.3).                                             |
| Validation      | **Zod**                                       | Already a `@noto/backend` dependency, already the source of the per-field errors the login form renders.                     |
| Object storage  | **Cloudflare R2**                             | S3 API, 10 GB free, and zero egress fees — which matters for a product that hands back attachments.                          |
| Email           | **Resend**                                    | Unchanged from the Supabase plan. Verification, reset, new-device alerts.                                                    |
| Bot defence     | **Cloudflare Turnstile**                      | Unchanged. `CloudflareTurnstile` moves to `shared/` and is otherwise untouched.                                              |
| Scheduled work  | **`node-cron` in-process**                    | Replaces `pg_cron`. Seven jobs, §12. Moves to an authenticated endpoint the moment there are two instances.                   |
| Deployment      | **Native Node host, no containers**           | A long-lived Node process, one region, a real pool: Render or Railway native Node builds, or a small VM under systemd. See audit decision D1. |

### 1.1 Node first, Workers kept open

Workers is tempting — `wrangler` already deploys two apps in this repo. It is not
the choice today because `pg` needs TCP, which Workers does not have: it would
mean Hyperdrive or the Neon serverless driver and no long-lived pool.

Keeping the door open costs one rule, and the rule is worth writing down:

> **`apps/api/src/db/pool.ts` is the only file in the repository that may import
> `pg`.** Everything else goes through the Kysely instance it exports.

Hono runs unchanged on both runtimes. So the move, if it is ever wanted, is that
one file plus a deploy config — not a rewrite. Anything that reaches for
`pool.query` from a controller has broken the rule and should fail review.

### 1.2 A note on the local database

This plan originally specified Postgres in Docker. The development machine
turned out to already have **PostgreSQL 18.6 running as a Windows service on
5432**, and Docker Desktop on that machine could not start at all — it needs
WSL 2, which was not installed.

**Decision (23 September 2026): no Docker, anywhere.** The native install is
the only documented path, locally and in CI (a Postgres service on the runner,
not a container we build). There is no `docker-compose.yml` and no
`Dockerfile`; production runs on a host that builds and runs Node natively.
It is the better default anyway: no virtualisation, no daemon to remember to
start, and it survives a reboot.

Nothing else in this plan changes. 18 runs every feature the schema uses, and
[`docs/development/database.md`](../docs/development/database.md) is the setup
guide.

---

## 2. Repository layout

Two places, and the split matters: **`packages/backend` holds rules, `apps/api`
holds HTTP.** That is the same split the Edge Functions already respect, and it
is what keeps the service tests free of a server.

```text
packages/backend/
├── src/
│   ├── ports/          UNCHANGED — the interfaces
│   ├── services/       UNCHANGED — AuthService, AccountService, + the new ones
│   ├── helpers/        UNCHANGED — crypto, password, errors, validation
│   ├── schemas/        UNCHANGED — the Zod boundary
│   ├── testing/        UNCHANGED — in-memory fakes
│   ├── shared/         turnstile.ts moves here (it is not Supabase-specific)
│   ├── postgres/       NEW — the adapters. Mirrors src/supabase/ exactly.
│   │   ├── auth.ts             PostgresAuthAdapter      implements AuthPort
│   │   ├── profiles.ts         PostgresProfileAdapter   implements ProfilePort
│   │   ├── devices.ts          PostgresDeviceAdapter    implements DevicePort
│   │   ├── settings.ts         PostgresSettingsAdapter  implements SettingsPort
│   │   ├── audit.ts            PostgresAuditAdapter     implements AuditPort
│   │   ├── rate-limit.ts       PostgresRateLimitAdapter implements RateLimitPort
│   │   ├── rows.ts             row → DTO, snake_case → camelCase
│   │   └── index.ts
│   └── supabase/       KEPT until cutover completes, then deleted
│
apps/api/
├── src/
│   ├── index.ts        the composition root — builds ports, starts the server
│   ├── app.ts          the Hono app and the middleware chain
│   ├── env.ts          Zod-validated environment. Fails at boot, not at 3 a.m.
│   ├── db/
│   │   ├── pool.ts     THE ONLY FILE THAT IMPORTS pg  (§1.1)
│   │   ├── tx.ts       withUser() — transaction + SET LOCAL app.user_id  (§3)
│   │   └── schema.ts   Kysely table types
│   ├── middleware/
│   │   ├── request-id.ts
│   │   ├── cors.ts     ONE definition. The whole class of bug in 1.4.1.
│   │   ├── auth.ts     bearer → { userId, sessionId, deviceId } or 401
│   │   ├── workspace.ts resolves :workspaceId and the caller's role, or 404
│   │   ├── rate-limit.ts
│   │   ├── validate.ts Zod on body / params / query
│   │   └── error.ts    Result → Response. The port of _shared/http.ts.
│   ├── controllers/    §6 — one file per group
│   ├── repositories/   folders, documents, memory. NO controllers — sync only.
│   ├── services/       only what is HTTP-shaped: signed URLs, Stripe, AI relay
│   └── jobs/           §12
├── db/
│   ├── migrations/     *.sql, numbered. The seven existing files land here.
│   ├── seed/           plan_limits, and a development account
│   └── migrate.ts      the runner
├── test/               integration tests against a throwaway Postgres database
└── package.json        @noto/api
```

`apps/api` depends on `@noto/backend`, `@noto/types` and `@noto/config`. It is
the only workspace that may import `pg`, and no client package may import it.

**Note `repositories/`.** Folders, documents and memory items have no
controllers, because §6.3 routes all content through sync. They still need
repositories — `sync_push` and `sync_pull` write and read those tables. The
absence of a controller is not the absence of a table.

---

## 3. Authorization — what replaces RLS

This is the section to get right. Everything else is typing.

Under Supabase, authorization lived in the database: PostgREST ran every query
as the caller, and ~50 RLS policies decided what came back. Seventy-six
endpoints could not forget a check, because none of them performed one.

A Node server connects as **one** database user. Naively, that means every RLS
policy stops applying and authorization moves into 53 handlers that can each
forget it. That is a real downgrade, and it is how data leaks.

**So keep RLS, and drive it from your own session.**

**1. Connect as a non-superuser role that RLS applies to.**

```sql
create role noto_api login password :'api_password';
grant usage on schema public to noto_api;
grant select, insert, update, delete on all tables in schema public to noto_api;
-- NOT bypassrls, and NOT the owner of any table.
```

**2. Every request runs inside a transaction that names its caller.**

```ts
// apps/api/src/db/tx.ts
export async function withUser<T>(
  userId: string | null,
  fn: (tx: Transaction<Schema>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (tx) => {
    // SET LOCAL, never SET: it is scoped to this transaction, so a pooled
    // connection cannot carry one request's identity into the next one.
    // This is the single most important line in the backend.
    await sql`select set_config('app.user_id', ${userId ?? ''}, true)`.execute(tx);
    return fn(tx);
  });
}
```

**3. One SQL helper changes, and every policy keeps working.**

```sql
-- was: select auth.uid() = target;
create or replace function public.is_self(target uuid)
returns boolean language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid = target;
$$;

create or replace function public.current_user_id()
returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;
```

`supabase/migrations/20260901120600_rls.sql` — all 138 lines — then applies
unchanged. So does the `is_self()` call in the foundation migration. **The RLS
safety net survives the move**, which is what makes this plan defensible rather
than merely possible.

**The service role.** Three tables must be writable by nobody's session:
`subscriptions` (only the Stripe webhook), `auth_events` and `auth_attempts`
(only the server). Those use a second pool connecting as `noto_service`, which
has `bypassrls`. It is used by six code paths and never by a route that takes a
workspace id.

**Belt and braces.** RLS is the net, not the plan. Handlers still check
explicitly — `workspace.ts` middleware resolves the caller's `member_role`
before the controller runs, and a controller that needs `editor` says so. RLS is
what catches the one that forgets.

---

## 4. Database — every table

**21 tables, 1 view, 8 enums**, plus three more if OAuth and MFA are built.
Naming is `snake_case` in Postgres and `camelCase` in TypeScript;
`packages/backend/src/postgres/rows.ts` performs the mapping, the way
`src/supabase/rows.ts` does today.

Every content table carries `created_at`, `updated_at` and `deleted_at`, because
soft deletes are tombstones the sync layer needs.

### The build sheet

| #   | Table                | Cols | Phase | New?                  | What it is                                     |
| --- | -------------------- | ---- | ----- | --------------------- | ---------------------------------------------- |
| 1   | `users`              | 15   | 1     | ⬤ replaces `profiles` | Identity **and** credentials                   |
| 2   | `sessions`           | 12   | 1     | ⬤ new                 | One row per live refresh token                 |
| 3   | `email_tokens`       | 8    | 1     | ⬤ new                 | Verification, reset, email change              |
| 4   | `devices`            | 14   | 1     |                       | Every installation that has signed in          |
| 5   | `auth_events`        | 9    | 1     |                       | Security log, append-only                      |
| 6   | `auth_attempts`      | 4    | 1     |                       | Rate-limit counters                            |
| 7   | `user_settings`      | 6    | 1     |                       | The `Settings` tree, as JSONB                  |
| 8   | `workspaces`         | 9    | 2     |                       | Top-level container                            |
| 9   | `workspace_members`  | 6    | 2     |                       | Who may see a workspace                        |
| 10  | `folders`            | 11   | 2     |                       | The tree. Written by sync, no controller       |
| 11  | `documents`          | 18   | 2     |                       | The documents. Written by sync, no controller  |
| 12  | `document_versions`  | 9    | 2     |                       | Hosted history                                 |
| 13  | `change_log`         | 8    | 2     |                       | The pull feed. The cursor lives here           |
| 14  | `sync_state`         | 6    | 2     |                       | One row per device per workspace               |
| 15  | `files`              | 13   | 3     |                       | Attachment metadata; bytes live in R2          |
| 16  | `memory_items`       | 15   | 3     |                       | Noto Memory. Written by sync, no controller    |
| 17  | `subscriptions`      | 11   | 3     |                       | Stripe's answer, webhook-written only          |
| 18  | `plan_limits`        | 9    | 3     |                       | Basic / Pro / Pro Max, as data                 |
| 19  | `usage_counters`     | 6    | 3     |                       | AI requests and bytes, per month               |
| 20  | `jobs`               | 11   | 3     |                       | Export and deletion work                       |
| 21  | `share_links`        | 14   | 4     |                       | Public and guest links                         |
|     | `entitlements`       | view | 3     |                       | `plan_limits` ⋈ `subscriptions`, default basic |
|     | _`oauth_accounts`_   | _8_  | _—_   | _deferred_            | _§4.4_                                         |
|     | _`mfa_factors`_      | _7_  | _—_   | _deferred_            | _§4.4_                                         |
|     | _`mfa_recovery_codes`_ | _5_ | _—_  | _deferred_            | _§4.4_                                         |

**Phase 1 is 7 tables.** That is a complete, working account system with nothing
borrowed.

Tables 4–21 and the `entitlements` view are specified column-by-column in
[`Backend_Plan.md` §5](Backend_Plan.md) and are **unchanged** by this plan — the
same columns, types, indexes and triggers. Only the identity tables below are
new, so only those are specified here.

### 4.1 `users` — replaces `profiles`

`profiles` existed to mirror `auth.users`, which no longer exists. The two merge.

| Column                                     | Type               | Notes                                                                 |
| ------------------------------------------ | ------------------ | --------------------------------------------------------------------- |
| `id`                                       | `uuid` PK          | `gen_random_uuid()`                                                   |
| `email`                                    | `citext` UNIQUE    | Case-insensitive, which is what `citext` is for                       |
| `email_verified_at`                        | `timestamptz` null | Null = unverified. Sync is refused until it is set                    |
| `password_hash`                            | `text` null        | argon2id. Null only becomes possible if OAuth is ever added           |
| `password_changed_at`                      | `timestamptz` null | Sessions issued before this are refused (§9.3)                        |
| `display_name`                             | `text`             | Defaults to the local part of the email                               |
| `avatar_url`                               | `text` null        | R2 object key. Resolved to a signed URL on read, never stored as one  |
| `locale`                                   | `text`             | `en` by default                                                       |
| `marketing_opt_in`                         | `boolean`          | Default `false`. Separate from transactional mail                     |
| `onboarded_at`                             | `timestamptz` null |                                                                       |
| `locked_until`                             | `timestamptz` null | Set by `AuthService`'s existing lockout rule                          |
| `mfa_enabled`                              | `boolean`          | Written now, read only when §4.4 is built. Costs one column, not a migration later |
| `created_at` / `updated_at` / `deleted_at` | `timestamptz`      | `deleted_at` is the 30-day grace period                               |

**15 columns.** Maps onto `User` in `packages/types/src/user.ts` exactly as
`profiles` did, so `ProfilePort` and every DTO are unaffected.

`password_hash` never leaves this table. It is not in any DTO, not in any
`select *`, and `rows.ts` has no branch that could emit it.

### 4.2 `sessions` — one row per live refresh token

| Column                | Type               | Notes                                                                      |
| --------------------- | ------------------ | -------------------------------------------------------------------------- |
| `id`                  | `uuid` PK          | The `sid` claim in the access token                                        |
| `user_id`             | `uuid` FK          | → `users.id` `ON DELETE CASCADE`                                           |
| `device_id`           | `uuid` null FK     | → `devices.id`. Null for a browser that has not registered one             |
| `refresh_token_hash`  | `text` UNIQUE      | SHA-256. **Never the token** — a database dump must not be a set of keys   |
| `previous_token_hash` | `text` null        | The hash this one replaced. Presented again = theft (§9.3)                 |
| `user_agent`          | `text` null        |                                                                            |
| `ip`                  | `inet` null        |                                                                            |
| `expires_at`          | `timestamptz`      | 30 days, sliding                                                           |
| `rotated_at`          | `timestamptz` null | Last refresh                                                               |
| `revoked_at`          | `timestamptz` null | Sign-out, device revoke, password change, or reuse detection               |
| `revoked_reason`      | `text` null        | `signout·rotated·reuse_detected·password_changed·device_revoked·admin`     |
| `created_at`          | `timestamptz`      |                                                                            |

**12 columns.** Indexes: unique on `refresh_token_hash`, `(user_id, revoked_at)`
for "sign out everywhere", and `(previous_token_hash)` for the reuse lookup.

### 4.3 `email_tokens` — verification, reset, email change

| Column        | Type               | Notes                                                              |
| ------------- | ------------------ | ------------------------------------------------------------------ |
| `id`          | `uuid` PK          |                                                                    |
| `user_id`     | `uuid` FK          |                                                                    |
| `kind`        | `text`             | `verify_email · reset_password · change_email`                     |
| `token_hash`  | `text` UNIQUE      | SHA-256 of a 32-byte random token — `randomToken()` already exists |
| `new_email`   | `citext` null      | Only for `change_email`                                            |
| `expires_at`  | `timestamptz`      | 24 h to verify, 1 h to reset. Short, because email is not secure   |
| `consumed_at` | `timestamptz` null | Single use, enforced by an update that filters on null             |
| `created_at`  | `timestamptz`      |                                                                    |

**8 columns.** Issuing a `reset_password` token invalidates every unconsumed
sibling for that user, so a stream of "forgot password" mails cannot leave a
dozen live keys behind.

### 4.4 Deferred: OAuth and MFA

Not built, but designed, because the shape of `users` and `sessions` has to
accommodate them or the later migration is painful.

- **`oauth_accounts`** (8 cols) — `user_id`, `provider`, `provider_account_id`
  unique together, plus encrypted provider tokens. The PKCE `state` and
  `code_verifier` belong in a signed 10-minute cookie, not a table.
  `users.password_hash` is already nullable for this.
- **`mfa_factors`** (7 cols) and **`mfa_recovery_codes`** (5 cols) — TOTP
  secrets encrypted with a key from the environment, ten single-use recovery
  codes hashed like passwords. `users.mfa_enabled` already exists, so sign-in
  gains a branch rather than a join.

When they arrive, sign-in gains one two-step response shape:
`{ mfaRequired: true, challengeId }` with no session attached. Design the
client's sign-in call to tolerate a session-less success **now**, and building
MFA later touches no screen.

### 4.5 Object storage — R2 replaces Supabase Storage

| Bucket / prefix | Path                                     | Holds                        |
| --------------- | ---------------------------------------- | ---------------------------- |
| `attachments`   | `{workspace_id}/{document_id}/{file_id}` | Document attachments         |
| `memory`        | `{workspace_id}/{memory_item_id}`        | Screenshots, captures        |
| `avatars`       | `{user_id}/avatar`                       | Profile pictures             |
| `exports`       | `{user_id}/{job_id}.zip`                 | GDPR exports, 7-day lifetime |

Nothing is public. Reads are presigned for five minutes; uploads are presigned
only after the quota check passes. **Bytes never pass through the API** — the
client PUTs to R2 directly, which is what keeps a 40 MB attachment from
occupying a Node process for thirty seconds.

---

## 5. The local SQLite schema — the two migrations sync needs

`packages/database/src/sqlite/schema.ts` is at `DATABASE_VERSION` 1 and creates
four tables: `workspaces`, `folders`, `documents`, `files`. That is the correct
schema for a local-only application, which is what Noto is today.

Sync needs two more versions. Both are additive, both are idempotent, and
`DATABASE_VERSION` in `@noto/config` moves with each — the rule the file already
states.

**Version 2 — the sync columns.** Every syncable table gains:

| Column         | Type      | Why                                                          |
| -------------- | --------- | ------------------------------------------------------------ |
| `server_seq`   | `INTEGER` | `0` = never pushed. The cursor's other half                  |
| `version`      | `INTEGER` | The `baseVersion` a push carries, for the check in §9.6      |
| `content_hash` | `TEXT`    | Skips writing a body the device already has (documents only) |
| `dirty`        | `INTEGER` | `1` = has local changes not yet acknowledged                 |

Plus two tables the queue needs, which `InMemoryQueue` currently stands in for:

```sql
CREATE TABLE IF NOT EXISTS sync_queue (
  id           TEXT PRIMARY KEY NOT NULL,
  entity_kind  TEXT NOT NULL,      -- document·folder·file·workspace·memory_item
  entity_id    TEXT NOT NULL,
  operation    TEXT NOT NULL,      -- create·update·delete
  base_version INTEGER NOT NULL,
  payload      TEXT NOT NULL,      -- JSON
  attempts     INTEGER NOT NULL DEFAULT 0,
  queued_at    TEXT NOT NULL,
  UNIQUE (entity_kind, entity_id)  -- coalescing, in the schema rather than in code
);

CREATE TABLE IF NOT EXISTS sync_state (
  workspace_id         TEXT PRIMARY KEY NOT NULL,
  last_pulled_seq      INTEGER NOT NULL DEFAULT 0,
  last_pulled_at       TEXT,
  last_pushed_at       TEXT,
  full_resync_required INTEGER NOT NULL DEFAULT 0
);
```

The `UNIQUE (entity_kind, entity_id)` is the whole coalescing rule: fifty
keystrokes in one document are one queue row, upserted, not fifty.

**Version 3 — `memory_items`**, mirroring the cloud table. Phase 3.

The Dexie store in `packages/database/src/web/` takes the same two versions.
`DATABASE_VERSION` is shared precisely so the two cannot drift.

**Nothing here changes what the local app does offline.** A device that never
signs in writes `dirty = 1` rows nobody reads.

---

## 6. The API surface — every controller and route

**53 routes across 10 controllers.** All under `/v1`. Every response is JSON,
every error has the `ApiErrorDto` shape `_shared/http.ts` already produces, and
every handler ends by returning a `Result` to `middleware/error.ts` — no
controller builds a `Response` by hand.

### 6.1 Route table

#### `controllers/auth.ts` — 11 routes

| Method | Path                    | Phase | Guard                | Notes                                          |
| ------ | ----------------------- | ----- | -------------------- | ---------------------------------------------- |
| `POST` | `/auth/signup`          | 1     | public + Turnstile   | §9.1                                           |
| `POST` | `/auth/signin`          | 1     | public               | §9.2                                           |
| `POST` | `/auth/signout`         | 1     | session              | Revokes this session only                      |
| `POST` | `/auth/signout-all`     | 1     | session              | Revokes every session for the user             |
| `POST` | `/auth/refresh`         | 1     | refresh token        | §9.3 — rotation and reuse detection            |
| `GET`  | `/auth/session`         | 1     | session              | The current user; the client's "am I signed in" |
| `POST` | `/auth/verify-email`    | 1     | public (token)       | Consumes an `email_tokens` row                 |
| `POST` | `/auth/verify-email/resend` | 1 | public, hard-limited | 3 per hour per address                         |
| `POST` | `/auth/password/forgot` | 1     | public               | Always 200 — §9.4                              |
| `POST` | `/auth/password/reset`  | 1     | public (token)       | §9.4                                           |
| `POST` | `/auth/password/change` | 1     | session + password   | Revokes other sessions                         |

#### `controllers/account.ts` — 12 routes

| Method   | Path                       | Phase | Guard              | Notes                                         |
| -------- | -------------------------- | ----- | ------------------ | --------------------------------------------- |
| `GET`    | `/account/profile`         | 1     | session            |                                               |
| `PATCH`  | `/account/profile`         | 1     | session            | display name, locale, marketing opt-in        |
| `POST`   | `/account/email/change`    | 1     | session + password | Issues a `change_email` token to the new address |
| `POST`   | `/account/avatar`          | 3     | session            | Presigned R2 PUT                              |
| `GET`    | `/account/settings`        | 1     | session            | The whole `Settings` tree                     |
| `PUT`    | `/account/settings`        | 1     | session            | Whole-object write, last-write-wins           |
| `GET`    | `/account/devices`         | 1     | session            | The account screen's list                     |
| `POST`   | `/account/devices`         | 1     | session            | Upsert on the client-generated id             |
| `DELETE` | `/account/devices/:deviceId` | 1   | session            | Revokes the device **and its sessions**       |
| `GET`    | `/account/events`          | 1     | session            | The security log, paginated                   |
| `GET`    | `/account/entitlements`    | 3     | session            | Reads the view                                |
| `POST`   | `/account/export`          | 3     | session + password | Enqueues a `jobs` row                         |
| `DELETE` | `/account`                 | 3     | session + password | Schedules deletion 30 days out                |

#### `controllers/workspaces.ts` — 10 routes

| Method   | Path                                     | Phase | Guard        | Notes                              |
| -------- | ---------------------------------------- | ----- | ------------ | ---------------------------------- |
| `GET`    | `/workspaces`                            | 2     | session      | Every workspace the caller is in   |
| `POST`   | `/workspaces`                            | 2     | session      | A cloud-native workspace           |
| `GET`    | `/workspaces/:workspaceId`               | 2     | member       |                                    |
| `PATCH`  | `/workspaces/:workspaceId`               | 2     | owner        | name, icon                         |
| `DELETE` | `/workspaces/:workspaceId`               | 2     | owner        | Soft delete                        |
| `POST`   | `/workspaces/:workspaceId/claim`         | 2     | session      | §9.5 — adopts a local workspace    |
| `GET`    | `/workspaces/:workspaceId/members`       | 4     | member       |                                    |
| `POST`   | `/workspaces/:workspaceId/members`       | 4     | owner        | Invite                             |
| `PATCH`  | `/workspaces/:workspaceId/members/:userId` | 4   | owner        | Change role                        |
| `DELETE` | `/workspaces/:workspaceId/members/:userId` | 4   | owner / self | Remove, or leave                   |

#### `controllers/sync.ts` — 3 routes

| Method | Path           | Phase | Guard            | Notes                                                     |
| ------ | -------------- | ----- | ---------------- | --------------------------------------------------------- |
| `POST` | `/sync/push`   | 2     | session + device | One transaction, per-row version checks. Cap 200 changes. |
| `POST` | `/sync/pull`   | 2     | session + device | One cursor read across five tables. Cap 500 rows.         |
| `GET`  | `/sync/state`  | 2     | session + device | Cursor and `full_resync_required`                         |

**These three carry every document, folder and memory item in the product.**
See §6.3.

#### `controllers/files.ts` — 6 routes

| Method   | Path                                          | Phase | Guard  | Notes                                    |
| -------- | --------------------------------------------- | ----- | ------ | ---------------------------------------- |
| `POST`   | `/workspaces/:workspaceId/files/grant`        | 3     | editor | Quota check → presigned PUT, 60 s        |
| `PATCH`  | `/workspaces/:workspaceId/files/:fileId`      | 3     | editor | Completes the upload; HEADs the real size |
| `GET`    | `/workspaces/:workspaceId/files`              | 3     | member | Metadata list                            |
| `GET`    | `/workspaces/:workspaceId/files/:fileId`      | 3     | member | Metadata                                 |
| `GET`    | `/workspaces/:workspaceId/files/:fileId/url`  | 3     | member | Presigned GET, 5 min                     |
| `DELETE` | `/workspaces/:workspaceId/files/:fileId`      | 3     | editor | Soft delete; the object is swept later   |

Files keep a controller where documents do not, because bytes cannot travel
through `sync_push` and a presigned URL has to be asked for.

#### `controllers/search.ts` — 1 route

| Method | Path                                   | Phase | Guard  | Notes                                            |
| ------ | -------------------------------------- | ----- | ------ | ------------------------------------------------ |
| `GET`  | `/workspaces/:workspaceId/search`      | 3     | member | `tsvector` rank across documents and memory items |

Cloud search exists for content this device has not pulled. Local search stays
local and stays instant.

#### `controllers/billing.ts` — 4 routes

| Method | Path                     | Phase | Guard                     | Notes                                     |
| ------ | ------------------------ | ----- | ------------------------- | ----------------------------------------- |
| `POST` | `/billing/checkout`      | 3     | session                   | Stripe Checkout session                   |
| `POST` | `/billing/portal`        | 3     | session                   | Stripe Billing Portal session             |
| `GET`  | `/billing/subscription`  | 3     | session                   | The user's row, or the basic default      |
| `POST` | `/billing/webhook`       | 3     | **Stripe signature only** | The one writer of `subscriptions`. §9.8   |

#### `controllers/ai.ts` — 1 route

| Method | Path           | Phase | Guard           | Notes                                                        |
| ------ | -------------- | ----- | --------------- | ------------------------------------------------------------ |
| `POST` | `/ai/complete` | 3     | session + quota | Streaming relay. The model key never leaves the server.       |

Checks `usage_counters.ai_requests` against `entitlements.ai_requests_per_month`
before the first token, and increments after the last one — so a dropped
connection does not bill for a completion nobody received.

#### `controllers/share.ts` — 4 routes

| Method   | Path                                                        | Phase | Guard  | Notes                                     |
| -------- | ----------------------------------------------------------- | ----- | ------ | ----------------------------------------- |
| `POST`   | `/workspaces/:workspaceId/documents/:documentId/share`       | 4     | owner  | Token shown once; only its hash is stored |
| `GET`    | `/workspaces/:workspaceId/documents/:documentId/share`       | 4     | owner  | Existing links                            |
| `DELETE` | `/workspaces/:workspaceId/documents/:documentId/share/:linkId` | 4   | owner  | Revoke                                    |
| `GET`    | `/s/:token`                                                  | 4     | public | Hash lookup, expiry, view count, password |

`/s/:token` is the only public route that reads a document, and it is mounted
outside `/v1` because it is a link a person opens, not an API a client calls.

#### `controllers/health.ts` — 2 routes

| Method | Path       | Guard  | Notes                          |
| ------ | ---------- | ------ | ------------------------------ |
| `GET`  | `/healthz` | public | The process is up              |
| `GET`  | `/readyz`  | public | `select 1` — the database is up |

### 6.2 What a controller looks like

Thin, and identical in shape to the Edge Functions already written:

```ts
// apps/api/src/controllers/auth.ts
export function authRoutes(ports: BackendPorts) {
  const routes = new Hono<Env>();
  const auth = new AuthService(ports); // the SAME service, unchanged

  routes.post('/signup', turnstile('signup'), async (c) =>
    respond(c, await auth.signUp(await c.req.json(), { ip: clientIp(c) })),
  );

  routes.post('/signin', async (c) =>
    respond(c, await auth.signIn(await c.req.json(), { ip: clientIp(c) })),
  );

  return routes;
}
```

Compare that to
[`supabase/functions/auth-signup/index.ts`](../supabase/functions/auth-signup/index.ts).
It is the same handler with a router around it — which is the point of having
had ports in the first place.

### 6.3 Why documents have no controller

This was a deliberate choice, and it has a cost worth writing down.

**Why sync-only is right here.** Noto is local-first. A signed-in client already
has every document in SQLite or Dexie, and it reads them from there — that is
what makes the editor instant and what makes the app work on a plane. A
`GET /documents/:id` would be a route the product never calls. Meanwhile every
one of those ~30 CRUD routes would need its own cross-tenant authorization test,
because RLS is no longer automatic per endpoint (§3). Thirty routes nothing calls
is thirty chances to leak someone's notes.

So: **the client writes locally, queues, and pushes. The server's content API is
three endpoints.**

**What it costs.** Three things become harder, and all three are acceptable
today:

1. **A read-only web client** — someone opening Noto in a browser on a borrowed
   laptop — must pull a workspace before it can show anything. That is a slower
   first paint, not an impossibility.
2. **A public API**, if Noto ever wants one, starts from nothing.
3. **Debugging production data** means SQL, not `curl`.

If any of those becomes pressing, the repositories in `apps/api/src/repositories/`
are already the whole implementation — adding a read controller over them is an
afternoon. The decision is reversible in the direction it is likely to need
reversing.

---

## 7. The middleware chain

Order matters, and this order is the specification:

```text
request
  │
  ├─ requestId()          a UUID, into logs and every error body
  ├─ cors()               ONE allow-list, one place. See the note below.
  ├─ bodyLimit(1 MB)      documents are JSON; attachments do not come through here
  ├─ rateLimit()          per IP, before anything touches the database
  ├─ auth()               bearer → { userId, sessionId, deviceId } or 401
  ├─ workspace()          :workspaceId → member_role, or 404 (never 403 —
  │                       "forbidden" tells a stranger the workspace exists)
  ├─ validate(schema)     Zod on body/params/query → per-field errors
  │
  ├─ CONTROLLER  ────────▶ SERVICE ────────▶ PORT ────────▶ POSTGRES
  │                        (all rules)      (adapters)      (RLS as the net)
  │
  └─ error()              Result → Response, cause logged and never returned
```

**On CORS.** Version 1.4.1 shipped a CORS fix, and the reason the bug was
possible is that the allow-list lived in a file each of nine functions imported
and each could have diverged from. Here it is one `app.use()` call, applied
before any route exists, and there is no way to write a route it does not cover.
The list itself — `noto.app`, `www.noto.app`, the `workers.dev` origin, plus
`NOTO_ALLOWED_ORIGINS` and any localhost port — carries over verbatim from
`supabase/functions/_shared/http.ts`.

**One exception, and it must be deliberate:** `/v1/billing/webhook` mounts
**before** the JSON body parser. Stripe's signature is computed over the raw
bytes, and a re-serialised body will not verify. This is the single most common
way to break Stripe webhooks.

---

## 8. Ports and adapters — the mapping

Every port keeps its interface. Only the implementation changes.

| Port            | Supabase adapter (today)       | Postgres adapter (new)                                                                                          |
| --------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `AuthPort`      | `SupabaseAuthAdapter` → GoTrue | `PostgresAuthAdapter` — argon2 + `users` + `sessions` + `email_tokens`. **The one with real work in it.**        |
| `ProfilePort`   | `profiles` via PostgREST       | `users` via Kysely                                                                                              |
| `DevicePort`    | `devices` via PostgREST        | `devices` via Kysely — same SQL, different caller                                                               |
| `SettingsPort`  | `user_settings`                | `user_settings`                                                                                                 |
| `AuditPort`     | service-role insert            | service pool insert                                                                                             |
| `RateLimitPort` | `auth_attempts`                | `auth_attempts`                                                                                                 |
| `TurnstilePort` | `CloudflareTurnstile`          | **unchanged** — moves to `shared/`, not one line edited                                                         |

Five of the seven are a query-builder swap. The sixth is unchanged. `AuthPort` is
where the effort goes, and it is ~400 lines: hash, verify, issue, rotate, revoke,
token issue-and-consume.

`AuthPort` has two methods this plan leaves unimplemented for now —
`startOAuth()` returns `err('not_supported')` until §4.4 is built. That is
better than deleting it from the interface, because the interface is what the
Supabase adapter still satisfies during cutover.

Because `packages/backend/src/testing/` already provides in-memory fakes for all
seven, **every existing service test keeps passing throughout the migration** —
they never touched a database and still do not.

---

## 9. Flows

### 9.1 Sign-up

```text
POST /v1/auth/signup  { email, password, displayName, turnstileToken }
  │
  ├─ Turnstile verify (fails closed — an unverifiable token is a rejected sign-up)
  ├─ rate limit: ip:<addr> / sign_up      ← the IP is read from the edge, never the body
  ├─ checkPassword()                      ← existing helper, unchanged
  ├─ argon2id hash
  ├─ INSERT users (email_verified_at = NULL)
  │    unique violation → the SAME response as success (enumeration, §8.3)
  ├─ INSERT user_settings  (defaults)
  ├─ issue email_token(verify_email, 24 h) → Resend
  ├─ auth_events: sign_up / success
  └─ 200 { user, session: null, confirmationRequired: true }
```

`confirmationRequired: true` with a null session is the shape `AuthSignUpDto`
already carries, and the shape the desktop and web forms already render. Nothing
on the client changes.

### 9.2 Sign-in

```text
POST /v1/auth/signin  { email, password, device? }
  │
  ├─ rate limit: email:<sha256> AND ip:<addr>
  ├─ SELECT users WHERE email = $1
  │    not found → argon2 against a dummy hash, then fail   ← constant time
  ├─ locked_until in the future → 423, no password check
  ├─ argon2.verify
  │    fail → auth_attempts + auth_events, and lockout at the 6th
  ├─ email_verified_at IS NULL → 403 email_unverified (a distinct code the UI acts on)
  ├─ INSERT devices (upsert on the client-generated id)
  ├─ INSERT sessions (refresh_token_hash, 30 d)
  ├─ auth_events: sign_in / success
  └─ 200 { user, session: { accessToken 15 m, refreshToken, expiresAt } }
```

The existing `padTo()` in `AuthService` still pads every outcome to the same
duration, so the response time does not report whether an address exists.

### 9.3 Refresh, and the theft case

```text
POST /v1/auth/refresh  { refreshToken }
  │
  ├─ hash it, SELECT sessions WHERE refresh_token_hash = $1
  │
  ├─ no row, but matches some session's previous_token_hash
  │     └─▶ REUSE. The token was stolen, or replayed.
  │         revoke EVERY session for that user (revoked_reason = 'reuse_detected')
  │         auth_events: failure
  │         401 — and the real user is signed out everywhere, on purpose
  │
  ├─ revoked_at or expires_at passed                  → 401
  ├─ session created before users.password_changed_at → 401
  │
  └─ rotate: previous_token_hash := current, new token, expires_at += 30 d
      200 { accessToken, refreshToken }
```

Rotation with reuse detection is why refresh tokens are rows and not JWTs, and it
is the single feature most worth getting right in this whole plan.

### 9.4 Password reset

```text
POST /v1/auth/password/forgot  { email }
  ├─ rate limit, then ALWAYS 200 — the response never says whether the address exists
  ├─ if the user exists: invalidate unconsumed reset tokens, issue one (1 h), email it
  └─ 200 { ok: true }

POST /v1/auth/password/reset  { token, newPassword }
  ├─ UPDATE email_tokens SET consumed_at = now()
  │     WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
  │     RETURNING user_id                      ← single-use, enforced by the WHERE
  ├─ checkPassword, argon2 hash
  ├─ UPDATE users SET password_hash, password_changed_at = now()
  ├─ revoke every session (reason = 'password_changed')
  └─ auth_events: password_reset / success
```

Consuming the token in the `UPDATE ... RETURNING` rather than a `SELECT` then an
`UPDATE` is what makes two simultaneous requests unable to both succeed.

### 9.5 Sign-in on a device that already has local documents

Unchanged from `Backend_Plan.md` §6.1, and step 6 stays an explicit choice in the
interface. Signing in must never silently upload someone's documents.

```text
1  sign in                          → §9.2
2  refresh token → OS keychain      ← never localStorage on desktop or mobile
3  POST /v1/account/devices         (id from local storage, or newly generated)
4  GET  /v1/account/profile, /settings, /entitlements
5  ── the local workspace is still local, and still works ──
6  the user is ASKED. If yes:
     POST /v1/workspaces/:id/claim  → owner_id set, is_local cleared,
                                      every local row enqueued as `create`
7  SyncEngine.start()
```

`claim` is one transaction, because a half-claimed workspace has no meaning:

```text
BEGIN
  INSERT workspaces (id, name, owner_id, ...)    -- the client's id, kept
  INSERT workspace_members (workspace_id, user_id, role = 'owner')
  INSERT change_log rows for everything the client declares
  UPDATE sync_state SET last_pulled_seq = <the seq just written>
COMMIT
```

### 9.6 A sync pass

```text
PUSH                                      PULL
────                                      ────
local write                               POST /v1/sync/pull
  → @noto/database (done, UI free)          { workspaceId, sinceSeq, deviceId }
  → sync_queue upsert (coalesced)                 │
        │                                         ▼
        ▼                                  change_log WHERE workspace_id = $1
POST /v1/sync/push                           AND seq > $2
  { deviceId, changes[] }                    AND actor_device_id IS DISTINCT FROM $3
        │                                         │  ← skips the device's own echo
        ▼  ONE transaction                        ▼
  per change:                                join the entity rows, cap at 500
    UPDATE ... WHERE version = base_version        │
      1 row → applied, server_seq bumped           ▼
      0 rows → conflict, current row returned  apply locally; advance last_pulled_seq
        │
        ▼
  { applied[], conflicts[], seq }
```

Cadence: on start, on reconnect, every 30 s while dirty, and 2 s after the last
edit. Backoff 1 s → 5 min with jitter. The queue survives a restart — which is
what §5's `sync_queue` table is for.

**Conflicts** resolve exactly as `Backend_Plan.md` §6.3 specifies: metadata is
last-write-wins on `updated_at`; a conflicting document body keeps the local one
live and files the remote one into history as "Edited on &lt;device&gt;"; a
delete beats an edit.

### 9.7 File upload

```text
POST /v1/workspaces/:id/files/grant  { name, size, mimeType }
  ├─ entitlements.storage_bytes vs usage_counters.storage_bytes
  │     over → 409 over_quota, and the UI offers the upgrade
  ├─ INSERT files (uploaded_at = NULL)
  └─ 200 { fileId, uploadUrl }         ← presigned R2 PUT, 60 s

client → R2 directly (chunked). No Node process ever holds the bytes.

PATCH /v1/workspaces/:id/files/:fileId  { checksum }
  ├─ HEAD the object — the real size, not the one the client claimed
  ├─ UPDATE files SET uploaded_at = now(), size = <actual>
  └─ trigger recounts usage → change_log → other devices
```

### 9.8 Plan upgrade

```text
PlansScreen → POST /v1/billing/checkout → Stripe Checkout (hosted)
                                                 │
                                     the user pays on Stripe
                                                 │
Stripe ──webhook──▶ POST /v1/billing/webhook
                          │  signature verified against the RAW body (§7)
                          │  service pool — the only writer of `subscriptions`
                          ▼
                    upsert subscriptions
                          │
            client re-reads /account/entitlements on next focus
```

A lapsed subscription never deletes anything — sync goes read-only and history
stops extending. Someone's documents are not the leverage.

---

## 10. Migrations and tooling

```bash
pnpm db:bootstrap   # create the `noto` database. Once per machine.
pnpm db:migrate     # apply db/migrations/*.sql in order
pnpm db:status      # say what would run, change nothing
pnpm db:psql        # a shell on the database
```

The runner is ~40 lines: a `schema_migrations` table, `SELECT` what has run,
apply the rest in one transaction each, in filename order. No framework, because
the seven existing files are already plain SQL and the point is that they stay
readable in a pull request.

**The migration set:**

```text
0001_foundation.sql      extensions, 8 enums, set_updated_at(), is_self()   ← §3 edit
0002_users.sql           users                                    (was profiles)
0003_sessions.sql        sessions, email_tokens
0004_devices.sql         devices
0005_auth_events.sql     auth_events, auth_attempts
0006_user_settings.sql   user_settings
0007_roles_rls.sql       noto_api / noto_service roles + policies
0008_workspaces.sql      workspaces, workspace_members                      Phase 2
0009_content.sql         folders, documents, document_versions
0010_sync.sql            change_log, sync_state, the change-log triggers
0011_files.sql           files                                              Phase 3
0012_memory.sql          memory_items
0013_billing.sql         subscriptions, plan_limits, usage_counters, entitlements
0014_jobs.sql            jobs
0015_share_links.sql     share_links                                        Phase 4
                         ── deferred (§4.4) ──
00xx_oauth.sql           oauth_accounts
00xx_mfa.sql             mfa_factors, mfa_recovery_codes
```

Files `0001`, `0004`, `0005`, `0006` and `0007` are the existing
`supabase/migrations/` files with `auth.users` → `users` and `auth.uid()` →
`current_user_id()`. That is a genuinely small diff for 451 lines.

---

## 11. Configuration

`apps/api/src/env.ts` validates all of this with Zod at boot. A missing secret
fails the process at startup, not on the first sign-in at 3 a.m.

| Variable                                      | Notes                                                         |
| --------------------------------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`                                | as `noto_api` — the role RLS applies to                       |
| `DATABASE_SERVICE_URL`                        | as `noto_service` — `bypassrls`, six code paths only          |
| `JWT_SECRET`                                  | ≥32 bytes. Rotating it signs everyone out, which is the point |
| `ACCESS_TOKEN_TTL`                            | `15m`                                                         |
| `REFRESH_TOKEN_TTL`                           | `30d`                                                         |
| `TURNSTILE_SECRET` / `TURNSTILE_HOSTNAMES`    | unchanged                                                     |
| `NOTO_ALLOWED_ORIGINS`                        | unchanged — adds origins without a deployment                 |
| `RESEND_API_KEY` / `MAIL_FROM`                |                                                               |
| `R2_ACCOUNT_ID` / `R2_BUCKET` / `R2_ACCESS_KEY_ID` / `R2_SECRET` | Phase 3                                     |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Phase 3                                                       |
| `AI_API_KEY`                                  | Phase 3. Never reaches a client, by construction              |
| `SENTRY_DSN`                                  | optional                                                      |

Clients need exactly one: `NOTO_API_URL`. The anon key disappears — there is no
such concept once PostgREST is gone, which is one fewer public credential to
rotate.

---

## 12. Scheduled jobs — the `pg_cron` replacement

`node-cron` in-process is enough while there is one instance. Move them to a
GitHub Actions schedule hitting an authenticated endpoint the moment there are
two, so they do not run twice.

| Job                     | Cadence  | Does                                                                                |
| ----------------------- | -------- | ----------------------------------------------------------------------------------- |
| `sweep-auth-attempts`   | hourly   | Deletes `auth_attempts` older than an hour                                          |
| `sweep-sessions`        | daily    | Deletes sessions expired or revoked more than 30 days ago                           |
| `sweep-email-tokens`    | daily    | Deletes consumed and expired tokens                                                 |
| `compact-change-log`    | daily    | Trims rows past 30 days; sets `full_resync_required` on any `sync_state` left behind |
| `sweep-version-history` | daily    | Applies `entitlements.version_history_days` — 90 on Pro, unlimited on Pro Max        |
| `reset-usage-counters`  | monthly  | New `period_start` row per user                                                     |
| `run-jobs`              | minutely | Picks up `jobs` — exports, and deletions past their grace period                    |

---

## 13. Testing

Three layers, and the first one already exists.

1. **Service tests — unchanged.** `packages/backend/src/services/*.test.ts` runs
   against `src/testing/` fakes: no network, no Docker, no Postgres. "Six
   failures locks the account" is still tested without a database, exactly as the
   ports comment promises.
2. **Adapter tests — new.** Each `postgres/` adapter against a real Postgres in a
   container, one transaction per test, rolled back. This is where `citext`
   uniqueness, the enum values and the `ON DELETE CASCADE` behaviour get proven.
3. **Route tests — new.** Hono's `app.request()` needs no listening socket, so
   the full middleware chain runs in-process. Every route gets at least: the
   happy path, the unauthenticated 401, and **the cross-tenant 404** — user B
   asking for user A's workspace. That third case is the one RLS used to
   guarantee for free, so it is now the test that must exist for every route
   that takes an id.

Choosing sync-only content (§6.3) means this third obligation lands on **12
id-taking routes instead of ~40**, which was a large part of the reason for the
choice.

A `test:rls` suite is worth its own file: connect as `noto_api`, set
`app.user_id` to a stranger, and assert every table returns zero rows.

**Two tests that must exist before Phase 2 ships:**

- A refresh token presented twice revokes every session for that user (§9.3).
- A pooled connection cannot leak `app.user_id`: run two requests as different
  users back to back on a pool of size 1, and assert the second sees only its
  own rows.

---

## 14. Delivery phases

Each phase is shippable and nothing before it is thrown away.

| Phase | Scope                                                                                                                        | Result                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **0** | `apps/api` skeleton: Hono, env, pool, middleware chain, `/healthz`. Native Postgres. Migrations `0001`–`0007`.                | The server boots and answers. Nothing else.                                                       |
| **1** | `PostgresAuthAdapter` + the three identity tables. `auth` and `account` controllers — 23 routes. Resend.                      | **Sign-up, sign-in, verification, reset, devices, settings.** Supabase is no longer needed for accounts. |
| **2** | Cutover: `@noto/sync` points at `NOTO_API_URL`, the six app files change, `supabase/` is deleted. Local schema v2.            | One backend. Supabase is gone.                                                                    |
| **3** | Workspaces + sync — 13 routes. `sync_push` / `sync_pull` / `claim`, the change-log triggers.                                  | **Sync works.** This is the feature the backend exists for.                                       |
| **4** | R2, files, search, Stripe, entitlements, the AI proxy, jobs — 12 routes.                                                      | The paid product.                                                                                 |
| **5** | Share links and members — 8 routes. Then OAuth and MFA (§4.4).                                                                | The rest.                                                                                         |

**Phase 2 is the risky one**, because sign-in is broken for every client if it is
wrong. Do it after Phase 1 is proven against a staging database, and never at the
same time as a schema change.

The client-side surface of Phase 2 is genuinely small — the six files that
mention Supabase today:

- [`packages/sync/src/supabase/`](../packages/sync/src/supabase/) → `packages/sync/src/api/`
- [`apps/web/src/platform/cloud.ts`](../apps/web/src/platform/cloud.ts), `cloud-config.ts`, `use-web-account.ts`
- [`apps/desktop/src/renderer/platform/cloud.ts`](../apps/desktop/src/renderer/platform/cloud.ts), `cloud-config.ts`, `use-desktop-account.ts`

`createSupabaseClient()` becomes `createApiClient()` returning a `fetch` wrapper
that attaches the access token and refreshes on 401. The DTOs on the wire do not
change, so no screen does.

---

## 15. What this costs

| Item                 | Supabase (today)       | Node + Postgres                                             |
| -------------------- | ---------------------- | ----------------------------------------------------------- |
| Database             | free, pauses at 7 days | Neon free 0.5 GB, no pause. $19/mo when outgrown            |
| API host             | free                   | **~$5/mo** — a machine that runs whether anyone does or not |
| Object storage       | free 1 GB              | R2 free 10 GB, **zero egress**                              |
| Email                | Resend free            | unchanged                                                   |
| Auth                 | free, 50 000 MAU       | **free in money, expensive in review**                      |
| **Code to maintain** | 9 functions            | **53 routes, 6 adapters, 15 migrations**                    |

The money is nearly a wash. The real price is the last row, and the real gain is
that the CORS bug, the deploy flow and the Deno toolchain stop being three
separate things you fight — they become one `app.use()`, one deploy, and
the Node you already run.

---

## Appendix — what to delete, and when

Not before Phase 2 is verified in production:

```text
supabase/functions/          3 functions + _shared
supabase/migrations/         after they are ported to apps/api/db/migrations/
supabase/config.toml
packages/backend/src/supabase/
packages/sync/src/supabase/
@supabase/supabase-js        from packages/backend and packages/sync
supabase                     the CLI, from root devDependencies
db:* scripts                 from the root package.json (replaced by §10)
```

Keep `supabase/migrations/` in git history regardless. It is the record of how
the schema got its shape, and the Node migrations are its continuation rather
than its replacement.
