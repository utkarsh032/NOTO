# Noto — Backend Plan

**Status:** proposal, nothing built yet.
**Scope:** the cloud half of Noto — accounts, sync, files, plans, AI.
**Companion documents:** [`R&D/PRD.md`](PRD.md) §13–16,
[`docs/architecture/overview.md`](../docs/architecture/overview.md),
[`docs/architecture/storage.md`](../docs/architecture/storage.md).

---

## 0. The one rule the backend has to obey

Noto is local-first. Every application writes to its own store — Dexie on web,
SQLite on desktop and mobile — through the single contract in
`packages/database`. That contract already exists and already works with no
network at all.

So the backend is **not** a data source. It is a _second copy_ that the
`SyncEngine` in `packages/sync` reconciles with in the background. Three
consequences, and every decision below follows from them:

1. **The server is never on the read or write path.** No screen waits on it. A
   request that fails is a queued change, not an error dialog.
2. **The client owns the identifiers.** Rows arrive with a UUID the device
   already generated. The server never mints an id for a document.
3. **Signed out is a supported, permanent state.** Basic is a whole local Noto
   (see `packages/ui/src/mock/plans.ts`). The account buys sync, hosted history
   and AI — the things that cost someone else money.

---

## 1. Tech stack

Three constraints decide every row below, in this order: it must not slow the
application down (§3), it must work with no network at all (§4), and it must
cost nothing until Noto has paying users (§1.2).

| Layer            | Choice                                                   | Free tier                                          | Why this and not the other thing                                                                                           |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Platform         | **Supabase** (managed Postgres)                          | Free — 500 MB DB, 1 GB files, 50 000 MAU            | Auth, Postgres, object storage, realtime and functions from one vendor. Already scaffolded in `packages/sync/src/supabase`.  |
| Database         | **PostgreSQL 17**                                        | included                                           | RLS is the authorization model; `tsvector` covers cloud search without a second engine.                                     |
| Auth             | **Supabase GoTrue**                                      | included, 50 000 MAU                               | Email + password, OAuth, magic link, TOTP MFA, refresh-token rotation — none of it worth writing again.                      |
| Object storage   | **Supabase Storage** (S3-compatible)                     | included, 1 GB                                     | Attachments, screenshots and exports never belong in a row. Signed URLs, per-user path prefix.                              |
| Server logic     | **Supabase Edge Functions** (Deno, TypeScript)           | included                                           | The few operations RLS cannot express: billing webhooks, the AI proxy, quota grants, account deletion.                      |
| Realtime         | **Supabase Realtime**                                    | included, 200 concurrent                           | Postgres logical replication → a websocket. Phase 4; polling is enough before that.                                         |
| Billing          | **Stripe** (Checkout + Billing Portal + webhooks)        | no monthly fee; ~2.9% + 30¢ per charge             | We never see a card number. Entitlements come from the webhook, never from the client.                                      |
| Email            | **Resend** (transactional)                               | Free — 3 000/month, 100/day, one domain            | Verification, password reset, new-device alerts. GoTrue's built-in SMTP is fine for development only.                       |
| Bot defence      | **Cloudflare Turnstile**                                 | Free, no request cap                               | Already a Cloudflare shop — `wrangler` deploys both the web app and the website.                                            |
| Migrations / IaC | **Supabase CLI**, `supabase/migrations/*.sql` checked in | Free (open source)                                 | The schema is reviewed in pull requests like any other code.                                                                |
| Observability    | Supabase logs + **Sentry**                               | Free — 5 000 errors/month, 1 seat                  | One error stream across the desktop app and the functions it calls.                                                         |
| Language         | **TypeScript** end to end                                | free                                               | The Edge Functions import `@noto/types`. One definition of `NotoDocument`, not two.                                         |

Client-side additions, all MIT and all already in the dependency style of the
repo: **Zod** for boundary validation, **`@supabase/supabase-js`** (already in
`packages/sync/package.json`), **`expo-secure-store`** and
**`@react-native-community/netinfo`** on mobile. Nothing here has a licence cost
and nothing here is a vendor SDK the app cannot start without.

### 1.1 Why not a custom Node/Nest service

Because there is nothing for it to do yet. Sync against Postgres with RLS is a
handful of SQL functions; billing is a webhook; AI is a proxy. A bespoke service
would mostly be re-implementing GoTrue and PostgREST, and it would need a server
that costs money every month whether anyone uses Noto or not.

The moment that stops being true — a real collaboration server, per-document
CRDT merge, a search cluster — the escape hatch is a **Cloudflare Worker +
Durable Object** service in `apps/api`, deployed by the `wrangler` already in the
repo, with Supabase demoted to Postgres-plus-auth. Nothing in this plan blocks
that, and the Workers free plan (100 000 requests/day) would carry it for a long
time.

### 1.2 What this costs, honestly

**Phases 1 and 2 — identity and sync — are free.** Everything on that path sits
inside a free tier, and none of it asks for a card. Concretely, on the free
plans as they stand in September 2026:

| Resource       | Free ceiling            | What that is in Noto terms                                                       |
| -------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| Postgres rows  | 500 MB                  | Roughly 100 000 documents of ordinary length, or ~2 000 users at 50 documents each |
| File storage   | 1 GB                    | ~1 000 screenshots, or a few hundred PDF attachments                               |
| Monthly actives| 50 000                  | Far past the point where Noto would have revenue                                   |
| Egress         | 5 GB/month              | A sync pull is kilobytes; this is a large number of syncs                          |
| Email          | 3 000/month, 100/day    | Verification and resets only — Noto sends no newsletters                           |
| Errors         | 5 000/month             | Enough unless something is badly wrong, which is when you want to know             |

**Three things are never free, and pretending otherwise would be dishonest:**

1. **Payment processing.** Stripe has no monthly fee, but it takes roughly
   2.9% + 30¢ of each charge. This only ever costs money when Noto is being
   paid, which is the correct shape for it to have.
2. **AI inference.** Every `ai-proxy` call costs real money per token. This is
   why `ai_requests_per_month` exists in `plan_limits` and why Basic has none:
   the quota is not an upsell trick, it is the actual bill. Free-tier AI is not
   a thing that exists at production quality, and shipping AI to non-paying
   users would be the one line item that could sink the project.
3. **A domain and code-signing certificates**, which the desktop release already
   pays for — see [`docs/deployment/code-signing.md`](../docs/deployment/code-signing.md).

**Two free-tier traps to plan around:**

- **Supabase pauses a free project after 7 days with no database requests**, and
  unpausing is a manual click in their dashboard. A live product with users
  never goes quiet that long, but a staging project will. Mitigation: a GitHub
  Actions cron that runs a trivial `select 1` against staging every few days.
- **The free plan allows two active projects.** That is production and staging,
  with nothing left for a third. If a separate development project is wanted,
  developers run Supabase locally through the CLI — which is free, unlimited,
  and faster anyway.

If the free tier is eventually outgrown, the next step is $25/month, and it
should arrive strictly after the revenue that justifies it. Nothing in the
schema or the DTOs changes at that boundary.

### 1.3 The free alternative, if Supabase is ever wrong

`@noto/sync` talks to the cloud through the `SyncEngine` interface, and nothing
above it knows the vendor's name. That is not an accident — it is what makes the
following a configuration decision rather than a rewrite:

| Instead of         | Use                                    | Free tier                                  |
| ------------------ | -------------------------------------- | ------------------------------------------ |
| Supabase Postgres  | **Cloudflare D1**                      | 5 GB, 5 M row reads/day, 100 k writes/day  |
| Supabase Storage   | **Cloudflare R2**                      | 10 GB, and **zero egress fees**            |
| Edge Functions     | **Cloudflare Workers**                 | 100 000 requests/day                       |
| GoTrue             | **Better Auth** or **Lucia**, self-hosted on Workers | free, but it is code we then own |
| Supabase Postgres  | **Neon**                               | 0.5 GB per project, scale-to-zero, no 7-day pause |

The Cloudflare column is tempting because `wrangler` already deploys two of the
four applications. It is not the first choice only because authentication would
become ours to write and to keep secure, which is the single worst thing to own
by accident. Neon is the better swap if the 7-day pause turns out to bite, since
it resumes on the next query instead of waiting for a human.

---

## 2. Architecture

```text
   DESKTOP (Electron)      WEB (Vite)          MOBILE (Expo + WebView)
          │                     │                        │
          ▼                     ▼                        ▼
                     @noto/ui  ·  @noto/core
                              │
                     NotoDataContext                 ← the UI reads/writes ONLY here
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
   @noto/database                          @noto/sync  (SyncEngine)
   SQLite / Dexie                          change queue, cursor, backoff
   (source of truth for the UI)                    │
                                    ┌──────────────┴──────────────┐
                                    ▼                             ▼
                            Supabase Auth (JWT)          Supabase REST / RPC
                                                                  │
        ┌────────────────────┬──────────────────┬─────────────────┴───────┐
        ▼                    ▼                  ▼                         ▼
   PostgreSQL + RLS   Supabase Storage    Edge Functions            Realtime
   rows, change log   blobs, signed URLs  billing · AI · quota      (phase 4)
                                                │
                                         Stripe · Resend · model provider
```

### Layer responsibilities

- **`@noto/database`** — unchanged. Local truth. Knows nothing about the cloud.
- **`@noto/sync`** — the only package that talks to Supabase. `SyncEngine` (the
  contract already in `packages/sync/src/types.ts`) owns the queue, the pull
  cursor, backoff and conflict resolution.
- **`@noto/types`** — grows an `api/` subpath holding the DTOs in §7, exported as
  `@noto/types/api`. Imported by the clients _and_ by the Edge Functions, so a
  rename breaks the build on both sides at once.
- **Postgres + RLS** — authorization lives here. Not in the Edge Functions, not
  in the client. Every table denies by default; a policy grants a row to a member
  of its workspace. A leaked anon key gets an attacker nothing.
- **Edge Functions** — only what RLS cannot express (§9).

---

## 3. Performance budget

The backend is only allowed to exist if it cannot be felt. A local-first
application that gets slower once you sign in has lost the argument for being
local-first, so this section is a set of numbers rather than an intention.

### 3.1 The guarantees

| Path                                       | Budget                        | How it is held                                                        |
| ------------------------------------------ | ----------------------------- | ----------------------------------------------------------------------- |
| Keystroke → glyph on screen                | < 16 ms (one frame)           | Nothing on this path touches the network, ever                          |
| Open a document                            | < 50 ms                       | A local indexed read; the cloud is not consulted                        |
| Local save acknowledged                    | < 20 ms                       | Written to SQLite/Dexie, then queued. The queue is fire-and-forget      |
| Application cold start, signed in          | no slower than signed out     | Auth and sync start **after** first paint, never before                 |
| Search across the workspace                | < 100 ms                      | Local index. Cloud search is an addition for other devices, not a replacement |
| Sync pass, main thread cost                | < 5 ms per pass               | Everything else runs off the UI thread (§3.2)                           |
| Memory added by having sync on             | < 20 MB                       | One queue, one cursor, no document cache — the database is the cache    |
| Bundle added by the cloud, signed out      | **0 KB**                      | §3.3                                                                    |

### 3.2 Where the work runs — never on the UI thread

This is the single most important performance decision, and each platform
already has the right place to put it:

| Platform    | Sync runs in                                             | Why it is already there                                                        |
| ----------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Desktop** | The Electron **main process**                            | It already owns SQLite and the IPC bridge. The renderer never opens a socket    |
| **Web**     | A **Web Worker**, with a Service Worker for retry-on-wake | Dexie is worker-safe; the main thread only receives "these ids changed"          |
| **Mobile**  | The **Expo native side**, across the existing WebView bridge | The WebView is the interface; the shell already owns SQLite and the network  |

The renderer's only involvement is receiving a list of changed entity ids and
re-reading those rows locally. It never parses a sync payload, never holds a
JWT, and never blocks on a response. This is why
[`apps/desktop/src/main/preload.ts`](../apps/desktop/src/main/preload.ts) gains a
sync channel rather than the renderer gaining a Supabase client.

### 3.3 The bundle stays the size it is

`@supabase/supabase-js` is roughly 120 KB gzipped. A user who never signs in must
not download a byte of it. Three rules:

1. The client is behind the `@noto/sync/supabase` subpath — already true in
   `packages/sync/package.json` — and reached by **dynamic `import()`**, so the
   bundler splits it into a chunk that is fetched only when sync is switched on.
2. `readCloudConfig` returning `null` is the normal state, not an error. The app
   must build, run and pass its tests with no Supabase environment variables at
   all — which is how the repository is configured today.
3. A size check in CI fails the build if the signed-out entry chunk grows. The
   free tier that matters most is the user's bandwidth.

### 3.4 The wire budget

- **Push batches** cap at 200 changes or 1 MB, whichever comes first. The queue
  already coalesces repeated edits to one entity into a single change, so three
  minutes of typing costs one request, not two hundred.
- **Pull pages** cap at 500 rows. `content_hash` lets the client skip writing a
  body it already has, which is the common case when a device reconnects after
  its own push.
- **Debounce** is 2 s after the last edit, and the pass is skipped entirely when
  the queue is empty — an idle Noto makes no requests at all.
- **Compression** is gzip on request and response; document JSON compresses to
  roughly a fifth of its size.
- **One round trip per pass.** `sync_push` and `sync_pull` are Postgres functions
  precisely so that a hundred changed rows are one call, not a hundred REST
  calls. No N+1 crosses the network.
- **Backoff** is exponential with jitter, 1 s → 5 min. A server that is down
  costs the user nothing and the project nothing.

### 3.5 What we refuse to build

- No realtime subscription per open document. One channel per workspace, or
  none.
- No blocking auth check at launch. The app opens; the session is validated
  behind it. An expired token means "sync later", not a login wall in front of
  someone's notes.
- No server-side rendering, no server round trip to draw a screen.
- No analytics beacon on interaction. The update check in
  `packages/types/src/settings.ts` is deliberately the only thing that reaches
  the network unasked, and it remains so.

### 3.6 How it is verified

The existing Playwright setup in `apps/web` gains a signed-in performance test
that fails on regression, and the desktop application is profiled once per
release with sync on and off. A budget with no test is a wish.

---

## 4. Offline, online, and everything in between

Noto must be **fully usable with the network unplugged, on all three
platforms**, and must take advantage of a connection the moment one appears —
without ever asking the user to think about which state they are in.

### 4.1 What needs the network, and what does not

| Capability                                            | Offline           | Online                        |
| ----------------------------------------------------- | ----------------- | ----------------------------- |
| Write, edit, format, tables, find and replace         | ✅ full            | ✅ full                        |
| Quick Note, the dock, global shortcuts                | ✅ full            | ✅ full                        |
| Folders, tabs, favourites, tags                       | ✅ full            | ✅ full                        |
| Search across everything on this device               | ✅ full            | ✅ full                        |
| Version history for this device                       | ✅ full            | ✅ full                        |
| Import and export Markdown, HTML, text, print         | ✅ full            | ✅ full                        |
| Noto Memory — clipboard, captures                     | ✅ full            | ✅ full                        |
| Sign in / sign up                                     | ❌ needs network   | ✅                             |
| Sync to other devices                                 | ⏳ queued          | ✅                             |
| Share a link, invite to a workspace                   | ⏳ queued as intent| ✅                             |
| Noto AI                                               | ❌ needs network   | ✅                             |
| Change plan                                           | ❌ needs network   | ✅                             |

Only four rows in that table need a connection, and none of them is writing.
**Nothing a user can lose work to is in the "needs network" column.**

Signing in is the one honest ❌: it needs a server the first time. After that the
session is cached, so a signed-in user who goes offline stays signed in and keeps
working — the app never logs anybody out for being on a train.

### 4.2 Detecting the network, per platform

`navigator.onLine` is necessary and not sufficient — it reports whether an
interface exists, not whether anything is reachable, and it is famously
optimistic on captive-portal Wi-Fi. So each platform uses a real signal, and a
failed request is treated as authoritative regardless of what the flag says:

| Platform    | Primary signal                                          | Confirmation                                                  |
| ----------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| **Web**     | `online` / `offline` events + `navigator.onLine`         | A `HEAD` to the health endpoint before the first pass after a wake |
| **Desktop** | Electron `net.isOnline()` in the main process, plus `powerMonitor` resume events | Same probe; the renderer is told the result over IPC |
| **Mobile**  | `@react-native-community/netinfo` — reachability, not just connectivity | NetInfo already reports "connected but no internet"       |

All three collapse into the `SyncStatus` union that already exists in
`packages/types/src/sync.ts`:

```text
disabled   no account, or sync switched off      → the app never mentions the cloud
offline    no reachable network                  → "N changes waiting" in the status line
syncing    a pass is in flight                   → a quiet spinner, never a modal
idle       everything pushed and pulled          → "Synced 2 minutes ago"
error      the server said no                    → one line, with what to do about it
```

The transition that matters is `offline → idle`. It is driven by an event, not a
timer: the moment the platform reports a connection, the queue flushes. On a
metered or cellular connection the pass still runs for text, but attachment
uploads wait for unmetered — someone's phone plan is not ours to spend.

### 4.3 The rules the interface follows

1. **A failed sync is never an error dialog.** It is a status line. The work is
   already saved locally; nothing was lost, so nothing needs a decision.
2. **No spinner ever blocks a screen** waiting on the network.
3. **Offline features are visibly unavailable, not broken.** "Share" is greyed
   with "available when you're online", rather than offered and then failing.
4. **Queued intent survives a restart.** Asking to share while offline records
   the intent; reconnecting completes it and tells the user it is done.
5. **The status line is honest about the count.** "3 changes waiting" beats a
   cloud icon nobody can interpret.

### 4.4 Sharing, which is the one thing that genuinely needs a server

A share link is a server-side object by definition — the whole point is a URL
someone else can open — so `share_links` (§5.2) is the one feature that cannot
degrade gracefully. It is handled like this:

```text
online   → create the row, return the URL, copy it to the clipboard
offline  → the action is disabled, with the reason shown in place of the button
         → if a share was requested and the network dropped mid-flight, the
           intent is queued and completed on reconnect, then surfaced as a toast
```

Local export is the offline answer to the same need, and it already exists:
Markdown, HTML and print work with no network at all, which covers "send this to
someone" without a server being involved.

### 4.5 Two devices, one document — the whole path

```text
DESKTOP (offline, on a plane)              PHONE (online)
──────────────────────────────             ──────────────────────
edit → SQLite (saved, < 20 ms)
     → queue: 1 change
edit → queue coalesces: still 1 change
     ✈ no network; the app is unaffected
                                           edit a different document
                                           → push → server_seq 41
lands, Wi-Fi connects
  ↓ platform fires "online"
  ↓ flush queue → sync_push (1 request)
  ↓ server_seq 42
  ↓ sync_pull since 40
  ↓ receives seq 41 (the phone's edit),
    skips 42 (its own echo, by device id)
  ↓ writes locally → UI re-reads those ids
"Synced just now"                          pulls seq 42 on next pass
```

Same-document edits on both sides take the §6.3 conflict path: the local body
stays live, the remote one is preserved as a version, and nobody is asked to
adjudicate a merge.

### 4.6 Why the three platforms cannot drift apart

Each platform stores differently and detects the network differently, and every
one of those differences is confined to a single file behind an interface that
already exists:

```text
                     one SyncEngine contract (packages/sync/src/types.ts)
                                    │
        ┌───────────────────────────┼───────────────────────────┐
     DESKTOP                      WEB                        MOBILE
  SQLite, main process      Dexie, Web Worker         SQLite, Expo bridge
  net.isOnline()            online/offline events     NetInfo
        └───────────────────────────┴───────────────────────────┘
                                    │
              identical DTOs, identical protocol, identical conflict rules
```

The sync protocol, the DTOs and the conflict rules are written once and tested
once. This mirrors what `packages/database` already does for storage, and it is
the same reason Android runs the real interface rather than a second, smaller
Noto — the argument is set out in
[`docs/architecture/overview.md`](../docs/architecture/overview.md).

---

## 5. Database

### 5.0 The build sheet

Everything that has to be created, counted. **19 tables, 189 columns, 1 view.**

| #   | Table               | Cols | Phase | What it is                                     |
| --- | ------------------- | ---- | ----- | ---------------------------------------------- |
| 1   | `profiles`          | 10   | 1     | The public half of an account                  |
| 2   | `devices`           | 14   | 1     | Every installation that has signed in          |
| 3   | `auth_events`       | 9    | 1     | Security log, append-only                      |
| 4   | `auth_attempts`     | 4    | 1     | Rate-limit counters                            |
| 5   | `user_settings`     | 6    | 1     | The `Settings` tree, as JSONB                  |
| 6   | `workspaces`        | 9    | 2     | Top-level container                            |
| 7   | `workspace_members` | 6    | 2     | Who may see a workspace — every RLS join       |
| 8   | `folders`           | 11   | 2     | The tree                                       |
| 9   | `documents`         | 18   | 2     | The documents themselves                       |
| 10  | `document_versions` | 9    | 2     | Hosted history                                 |
| 11  | `change_log`        | 8    | 2     | The pull feed. The cursor lives here           |
| 12  | `sync_state`        | 6    | 2     | One row per device per workspace               |
| 13  | `files`             | 13   | 3     | Attachment metadata (bytes live in Storage)    |
| 14  | `memory_items`      | 15   | 3     | Noto Memory — clipboard, captures, notes       |
| 15  | `subscriptions`     | 11   | 3     | Stripe's answer, written by webhook only       |
| 16  | `plan_limits`       | 9    | 3     | The Basic/Pro/Pro Max ladder, as data          |
| 17  | `usage_counters`    | 6    | 3     | AI requests and bytes used, per month          |
| 18  | `jobs`              | 11   | 3     | Export and deletion work                       |
| 19  | `share_links`       | 14   | 4     | Public and guest links                         |
|     | `entitlements`      | view | 3     | `plan_limits` ⋈ `subscriptions`, default basic |

**Phase 1 is 5 tables, 43 columns.** That is the whole of a working account
system. Phase 2 adds 7 more and sync works. Nothing needs building before it is
needed.

Alongside the tables: **8 enum types** (`device_platform`, `auth_event_kind`,
`member_role`, `document_status`, `memory_kind`, `sync_entity_kind`,
`sync_operation`, `plan_id`), **4 storage buckets** (§5.6), **~8 triggers** (change-log writers,
`updated_at`, version bump, `tsvector`, usage recount) and **~50 RLS policies** —
two to four per table, all following the pattern in §8.6.

Naming is `snake_case` in Postgres and `camelCase` in TypeScript; the mapping is
the one `packages/database/src/sqlite/rows.ts` already performs. Every content
table carries `created_at`, `updated_at` and `deleted_at` so the cloud shape
matches `Entity` in `packages/types/src/common.ts` — soft deletes are tombstones
the sync layer needs, not a UI concern.

### 5.1 Identity and access

#### `profiles` — the public half of `auth.users`

| Column                                     | Type               | Notes                                             |
| ------------------------------------------ | ------------------ | ------------------------------------------------- |
| `id`                                       | `uuid` PK          | = `auth.users.id`, FK `ON DELETE CASCADE`         |
| `email`                                    | `citext`           | Mirrored from GoTrue for display and search       |
| `display_name`                             | `text`             | Defaults to the local part of the email           |
| `avatar_url`                               | `text` null        | Storage path, resolved to a signed URL on read    |
| `locale`                                   | `text`             | `en` by default                                   |
| `marketing_opt_in`                         | `boolean`          | Default `false`. Separate from transactional mail |
| `onboarded_at`                             | `timestamptz` null |                                                   |
| `created_at` / `updated_at` / `deleted_at` | `timestamptz`      |                                                   |

Maps exactly onto `User` in `packages/types/src/user.ts`.

#### `devices` — every installation that has signed in

| Column                                     | Type                   | Notes                                                          |
| ------------------------------------------ | ---------------------- | -------------------------------------------------------------- |
| `id`                                       | `uuid` PK              | Generated on the device, stored locally, stable across sign-ins |
| `user_id`                                  | `uuid` FK              | → `profiles.id`                                                |
| `name`                                     | `text`                 | "Utkarsh's ThinkPad"                                           |
| `platform`                                 | `device_platform` enum | `windows·macos·linux·ios·android·web`                          |
| `os_name`                                  | `text`                 | "Windows 11 Pro"                                               |
| `app_version`                              | `text`                 | Which build of Noto is installed there                         |
| `push_token`                               | `text` null            | Later, for new-device alerts                                   |
| `last_seen_ip`                             | `inet` null            | Last address, for the location line                            |
| `location`                                 | `text` null            | Coarse — city and country, resolved server-side, never GPS     |
| `last_active_at`                           | `timestamptz`          |                                                                |
| `revoked_at`                               | `timestamptz` null     | Set by "sign out this device"; sync then refuses it            |
| `created_at` / `updated_at` / `deleted_at` | `timestamptz`          |                                                                |

Backs `Device` in `packages/types/src/device.ts` and the device list on the
account screen. `isCurrent` is computed on the client, never stored.

#### `auth_events` — the security log

| Column       | Type                   | Notes                                                                                                                                             |
| ------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | `bigint` PK identity   | Append-only                                                                                                                                       |
| `user_id`    | `uuid` null            | Null for a failed sign-in against an unknown address                                                                                              |
| `device_id`  | `uuid` null            |                                                                                                                                                   |
| `kind`       | `auth_event_kind` enum | `sign_in·sign_out·sign_up·password_reset·password_changed·mfa_enrolled·mfa_challenge_failed·device_revoked·email_changed·export_requested·account_deleted` |
| `outcome`    | `text`                 | `success` / `failure`                                                                                                                             |
| `ip`         | `inet` null            |                                                                                                                                                   |
| `user_agent` | `text` null            |                                                                                                                                                   |
| `detail`     | `jsonb`                | Reason code. **Never** a token, a password or a document title                                                                                    |
| `created_at` | `timestamptz`          |                                                                                                                                                   |

Read-only to the user, insert-only to everything else, 180-day retention.

#### `auth_attempts` — rate-limit counters

| Column         | Type                 | Notes                                                    |
| -------------- | -------------------- | -------------------------------------------------------- |
| `id`           | `bigint` PK identity |                                                          |
| `key`          | `text`               | `email:<sha256>` or `ip:<addr>` — never a plain address   |
| `kind`         | `text`               | `sign_in` / `reset` / `mfa` / `sign_up`                  |
| `attempted_at` | `timestamptz`        | Indexed; rows older than an hour are swept nightly       |

### 5.2 Content — the mirror of the local schema

These tables are the cloud twin of `packages/database/src/sqlite/schema.ts`. Same
columns, same names, plus the four the cloud needs: `owner_id`, `server_seq`,
`version`, `content_hash`.

#### `workspaces`

| Column                                     | Type          | Notes                                                     |
| ------------------------------------------ | ------------- | --------------------------------------------------------- |
| `id`                                       | `uuid` PK     | Client-generated                                          |
| `name`                                     | `text`        |                                                           |
| `owner_id`                                 | `uuid` FK     | → `profiles.id`                                           |
| `icon`                                     | `text` null   |                                                           |
| `is_shared`                                | `boolean`     | Pro Max only; enforced by a trigger against entitlements  |
| `server_seq`                               | `bigint`      | See §6.2                                                  |
| `created_at` / `updated_at` / `deleted_at` | `timestamptz` |                                                           |

`is_local` does not cross the wire: a local workspace is by definition one the
server has never seen.

#### `workspace_members`

| Column                       | Type                    | Notes                          |
| ---------------------------- | ----------------------- | ------------------------------ |
| `workspace_id`               | `uuid` FK               | PK part 1                      |
| `user_id`                    | `uuid` FK               | PK part 2                      |
| `role`                       | `member_role` enum      | `owner·editor·commenter·viewer` |
| `invited_by`                 | `uuid` null             |                                |
| `invited_at` / `accepted_at` | `timestamptz` null      |                                |

The join every RLS policy in this group goes through.

#### `folders`

| Column                                     | Type          | Notes                              |
| ------------------------------------------ | ------------- | ---------------------------------- |
| `id`                                       | `uuid` PK     | Client-generated                   |
| `workspace_id`                             | `uuid` FK     |                                    |
| `parent_id`                                | `uuid` null FK | `null` = workspace root            |
| `name`                                     | `text`        |                                    |
| `position`                                 | `integer`     | Manual ordering among siblings     |
| `color`                                    | `text` null   |                                    |
| `icon`                                     | `text` null   |                                    |
| `server_seq`                               | `bigint`      |                                    |
| `created_at` / `updated_at` / `deleted_at` | `timestamptz` |                                    |

**11 columns** — identical to the local table plus `server_seq`.

#### `documents`

| Column                                     | Type                    | Notes                                                       |
| ------------------------------------------ | ----------------------- | ----------------------------------------------------------- |
| `id`                                       | `uuid` PK               | Client-generated                                            |
| `workspace_id`                             | `uuid` FK               |                                                             |
| `folder_id`                                | `uuid` null FK          |                                                             |
| `title`                                    | `text`                  |                                                             |
| `content`                                  | `jsonb`                 | Tiptap/ProseMirror JSON — canonical, exactly as locally      |
| `status`                                   | `document_status` enum  | `draft·active·archived`                                     |
| `excerpt`                                  | `text`                  | Plain-text projection, for previews                         |
| `word_count`                               | `integer`               |                                                             |
| `is_favorite`                              | `boolean`               |                                                             |
| `tags`                                     | `text[]`                | An array, not a join table — parity with the local JSON column |
| `version`                                  | `integer`               | Bumped by trigger on every write. Conflict detection (§6.3) |
| `content_hash`                             | `text`                  | SHA-256 of `content`; lets a pull skip an identical body     |
| `last_edited_by`                           | `uuid` null             |                                                             |
| `search_tsv`                               | `tsvector`              | Generated from `title` and `excerpt`, GIN-indexed            |
| `server_seq`                               | `bigint`                |                                                             |
| `created_at` / `updated_at` / `deleted_at` | `timestamptz`           |                                                             |

Indexes: `(workspace_id, deleted_at, updated_at DESC)`, `(folder_id, deleted_at)`,
`(workspace_id, server_seq)`, GIN on `search_tsv`, GIN on `tags`.

#### `document_versions` — hosted history

| Column         | Type          | Notes                                                              |
| -------------- | ------------- | ------------------------------------------------------------------ |
| `id`           | `uuid` PK     |                                                                    |
| `document_id`  | `uuid` FK     | `ON DELETE CASCADE`                                                |
| `workspace_id` | `uuid` FK     | Denormalised so RLS needs no extra join                            |
| `version`      | `integer`     | Matches `documents.version` at capture time                        |
| `content`      | `jsonb`       | Full snapshot. Diffs are a later optimisation, not a first design    |
| `word_count`   | `integer`     |                                                                    |
| `author_id`    | `uuid` null   | Null means "Autosave"                                              |
| `summary`      | `text` null   | One line, when Noto can tell                                       |
| `created_at`   | `timestamptz` |                                                                    |

Retention _is_ the paid feature: 90 days on Pro, unlimited on Pro Max, enforced by
a nightly `pg_cron` sweep that reads `entitlements`.

#### `files` — attachment metadata

| Column                                     | Type            | Notes                                     |
| ------------------------------------------ | --------------- | ----------------------------------------- |
| `id`                                       | `uuid` PK       |                                           |
| `workspace_id`                             | `uuid` FK       |                                           |
| `document_id`                              | `uuid` null FK  |                                           |
| `name`                                     | `text`          |                                           |
| `mime_type`                                | `text`          | Sniffed server-side, not trusted from the client |
| `size`                                     | `bigint`        | Bytes; counted against the storage quota  |
| `storage_path`                             | `text`          | Bucket path. **Never** a URL — those are signed on demand |
| `checksum`                                 | `text` null     | SHA-256, for de-duplication               |
| `uploaded_at`                              | `timestamptz` null | Null until the upload completes        |
| `server_seq`                               | `bigint`        |                                           |
| `created_at` / `updated_at` / `deleted_at` | `timestamptz`   |                                           |

**13 columns.** Matches `NotoFile`; `local_path` stays local, and `remote_url`
becomes `storage_path` because a URL is signed on demand and must never be
persisted.

#### `memory_items`

| Column                                     | Type              | Notes                                        |
| ------------------------------------------ | ----------------- | -------------------------------------------- |
| `id`                                       | `uuid` PK         |                                              |
| `workspace_id`                             | `uuid` FK         |                                              |
| `kind`                                     | `memory_kind` enum | `note·clipboard·screenshot·image·link·file` |
| `title`                                    | `text`            | Derived from the content when a capture had none |
| `content`                                  | `text`            | Body, or the transcript of a captured asset  |
| `source`                                   | `text` null       | Application, hostname or device it came from |
| `storage_path`                             | `text` null       | For `image`, `screenshot` and `file` kinds    |
| `tags`                                     | `text[]`          |                                              |
| `is_pinned`                                | `boolean`         |                                              |
| `size_bytes`                               | `bigint` null     | `null` for text                              |
| `search_tsv`                               | `tsvector`        | GIN-indexed                                  |
| `server_seq`                               | `bigint`          |                                              |
| `created_at` / `updated_at` / `deleted_at` | `timestamptz`     |                                              |

**15 columns.** Mirrors `MemoryItem`. Synced on Pro and above; local on Basic.

#### `share_links` — Pro Max

| Column                                     | Type               | Notes                                          |
| ------------------------------------------ | ------------------ | ---------------------------------------------- |
| `id`                                       | `uuid` PK          |                                                |
| `workspace_id`                             | `uuid` FK          |                                                |
| `document_id`                              | `uuid` FK          |                                                |
| `token_hash`                               | `text`             | SHA-256 of the link token. **Never the token** |
| `permission`                               | `text`             | `view` / `comment`                             |
| `password_hash`                            | `text` null        | bcrypt, when the link is password-protected    |
| `expires_at`                               | `timestamptz` null | `null` = no expiry                             |
| `max_views`                                | `integer` null     | `null` = unlimited                             |
| `view_count`                               | `integer`          |                                                |
| `created_by`                               | `uuid` FK          |                                                |
| `revoked_at`                               | `timestamptz` null | Set by "revoke link"; checked before every open |
| `created_at` / `updated_at` / `deleted_at` | `timestamptz`      |                                                |

**14 columns.** The token is shown once, at creation, and only its hash is kept —
so a database leak does not hand anybody a working link.

### 5.3 Sync

#### `change_log` — the pull feed

| Column            | Type                      | Notes                                       |
| ----------------- | ------------------------- | ------------------------------------------- |
| `seq`             | `bigint` PK identity      | Monotonic per workspace. **The cursor**     |
| `workspace_id`    | `uuid` FK                 |                                             |
| `entity_kind`     | `sync_entity_kind` enum   | `document·folder·file·workspace·memory_item` |
| `entity_id`       | `uuid`                    |                                             |
| `operation`       | `sync_operation` enum     | `create·update·delete`                      |
| `version`         | `integer`                 |                                             |
| `actor_device_id` | `uuid` null               | So a device can skip its own echo           |
| `created_at`      | `timestamptz`             |                                             |

Written by an `AFTER INSERT OR UPDATE` trigger on every content table; the client
never writes here. Unique on `(workspace_id, seq)`. Rows are compacted after 30
days, at which point a client that far behind is told to do a full resync.

#### `sync_state` — one row per (device, workspace)

| Column                 | Type               | Notes                                            |
| ---------------------- | ------------------ | ------------------------------------------------ |
| `device_id`            | `uuid` FK          | PK part 1                                        |
| `workspace_id`         | `uuid` FK          | PK part 2                                        |
| `last_pulled_seq`      | `bigint`           | The cursor into `change_log`                      |
| `last_pushed_at`       | `timestamptz` null |                                                  |
| `last_pulled_at`       | `timestamptz` null |                                                  |
| `full_resync_required` | `boolean`          | Set when the cursor falls behind compaction (30 days) |

**6 columns.**

### 5.4 Billing and limits

#### `subscriptions`

| Column                      | Type             | Notes                                                |
| --------------------------- | ---------------- | ---------------------------------------------------- |
| `id`                        | `uuid` PK        |                                                      |
| `user_id`                   | `uuid` FK unique |                                                      |
| `plan_id`                   | `plan_id` enum   | `basic·pro·pro_max` — matches `PlanId` in the UI      |
| `status`                    | `text`           | Stripe's: `active·trialing·past_due·canceled·unpaid`  |
| `billing_cycle`             | `text`           | `monthly` / `yearly`, as in `BillingCycle`            |
| `stripe_customer_id`        | `text` null      |                                                      |
| `stripe_subscription_id`    | `text` null      |                                                      |
| `current_period_end`        | `timestamptz` null |                                                    |
| `cancel_at_period_end`      | `boolean`        |                                                      |
| `created_at` / `updated_at` | `timestamptz`    |                                                      |

**Writable only by the service role**, from the Stripe webhook. No client path
sets a plan — that is the whole point of the table.

#### `plan_limits` — the ladder as data

| Column                  | Type             | basic | pro   | pro_max   |
| ----------------------- | ---------------- | ----- | ----- | --------- |
| `plan_id`               | `plan_id` enum PK | basic | pro   | pro_max   |
| `storage_bytes`         | `bigint`         | 0     | 50 GB | 2 TB      |
| `version_history_days`  | `integer` null   | 0     | 90    | `NULL` ∞  |
| `ai_requests_per_month` | `integer`        | 0     | 1 000 | `NULL` ∞  |
| `synced_devices`        | `integer` null   | 0     | `NULL` | `NULL`   |
| `shared_workspaces`     | `boolean`        | false | false | true      |
| `share_links`           | `boolean`        | false | false | true      |
| `ocr`                   | `boolean`        | false | true  | true      |
| `ai_model_tier`         | `text`           | —     | standard | largest |

**9 columns, 3 rows.** Seeded to match `PLAN_FEATURES` in
`packages/ui/src/mock/plans.ts` — that mock becomes a fetch of this table.

#### `usage_counters`

| Column             | Type          | Notes                                     |
| ------------------ | ------------- | ----------------------------------------- |
| `user_id`          | `uuid` FK     | PK part 1                                 |
| `period_start`     | `date`        | PK part 2 — the billing month             |
| `ai_requests`      | `integer`     | Checked by `ai-proxy` before every call    |
| `storage_bytes`    | `bigint`      | Kept by a trigger on `files`, not counted on demand |
| `documents_synced` | `integer`     |                                           |
| `updated_at`       | `timestamptz` |                                           |

**6 columns.** Incremented by Edge Functions and a storage trigger; reset by a
monthly `pg_cron` job.

#### `entitlements` — a view, not a table

`plan_limits` joined to the user's `subscriptions` row, defaulting to `basic`
when there is no row or the status is not `active`/`trialing`. Every quota check —
in RLS, in a trigger, in a function — reads this view. One definition of "what
this user is allowed", queried from everywhere.

### 5.5 Preferences and jobs

#### `user_settings`

| Column         | Type          | Notes                                        |
| -------------- | ------------- | -------------------------------------------- |
| `user_id`      | `uuid` PK     |                                              |
| `appearance`   | `jsonb`       | `AppearanceSettings` — theme, accent, motion  |
| `editor`       | `jsonb`       | `EditorSettings` — font, width, wrap, zoom    |
| `updates`      | `jsonb`       | `UpdateSettings`                              |
| `sync_enabled` | `boolean`     | Opt-in; false keeps Noto entirely local      |
| `updated_at`   | `timestamptz` | Last write wins across devices               |

**6 columns.** The whole `Settings` tree as JSONB rather than thirty columns: it
is read and written as one object, versioned by the app, and its shape is owned
by `packages/types/src/settings.ts`.

#### `jobs`

| Column                      | Type               | Notes                                          |
| --------------------------- | ------------------ | ---------------------------------------------- |
| `id`                        | `uuid` PK          |                                                |
| `user_id`                   | `uuid` FK          |                                                |
| `kind`                      | `text`             | `export·account_delete·reindex·storage_recount` |
| `status`                    | `text`             | `pending·running·done·failed`                   |
| `payload`                   | `jsonb`            | What to do                                     |
| `result`                    | `jsonb` null       | Where the export landed, what was purged       |
| `error`                     | `text` null        |                                                |
| `attempts`                  | `integer`          | Retried with backoff, capped                   |
| `scheduled_for`             | `timestamptz`      | A delete is scheduled 30 days out — the grace period |
| `created_at` / `updated_at` | `timestamptz`      |                                                |

**11 columns.** Backs the GDPR export and the 30-day deletion grace period.

### 5.6 Storage buckets

| Bucket        | Public | Path                                     | Holds                        |
| ------------- | ------ | ---------------------------------------- | ---------------------------- |
| `attachments` | no     | `{workspace_id}/{document_id}/{file_id}` | Document attachments         |
| `memory`      | no     | `{workspace_id}/{memory_item_id}`        | Screenshots, captures        |
| `avatars`     | no     | `{user_id}/avatar`                       | Profile pictures             |
| `exports`     | no     | `{user_id}/{job_id}.zip`                 | GDPR exports, 7-day lifetime |

Nothing is public. Reads go through a signed URL with a five-minute lifetime;
uploads through a signed upload URL issued only after the quota check passes.

---

## 6. Flow

### 6.1 Sign-in, on a device that already has local documents

```text
 1  User signs in (LoginScreen → @noto/sync/supabase)
 2  GoTrue returns access JWT (1 h) + refresh token (rotating)
 3  Refresh token → OS keychain      ← never localStorage on desktop/mobile
 4  Client upserts `devices` (id from local storage, or newly generated)
 5  Client fetches `profiles`, `entitlements`, `user_settings`
 6  ── the local workspace is still local, and still works ──
 7  If the plan syncs and the user says yes:
       the local workspace is claimed → `owner_id` set, `is_local` cleared,
       every local row enqueued as `create`
 8  SyncEngine.start()
```

Step 7 is a deliberate, explicit choice in the interface. Signing in must never
silently upload someone's documents.

### 6.2 A steady-state sync pass

```text
PUSH                                  PULL
────                                  ────
local write                           POST /rpc/sync_pull
  → @noto/database (done, UI free)      { workspaceId, sinceSeq, deviceId }
  → SyncEngine.enqueue()                      │
        │ coalesced per entity                ▼
        ▼                              rows where server_seq > cursor,
POST /rpc/sync_push                    excluding actor_device_id = me
  { deviceId, changes[] }                     │
        │                                     ▼
        ▼                              apply to the local store
  per change: version check            (server wins unless a local
   ├ ok       → write, bump seq         change for the same entity is
   └ stale    → return conflict         still queued → §6.3)
        │                                     │
        ▼                                     ▼
  { applied[], conflicts[], seq }      advance last_pulled_seq
```

Cadence: on start, on reconnect, every 30 seconds while dirty, and 2 seconds
after the last local edit (debounced). Failures back off exponentially, 1 s →
5 min, with jitter. Everything stays queued until acknowledged — and the queue
survives a restart, which is why `InMemoryQueue` gains a persisted sibling.

### 6.3 Conflicts

Server-side optimistic concurrency: a push carries `baseVersion`, the update runs
`WHERE version = base_version`, and zero rows changed means a conflict. The client
then resolves by entity kind:

- **Metadata** (title, folder, tags, favourite, position) — last write wins on
  `updated_at`, ties broken by device id. Nobody has ever wanted a merge dialog
  for a folder rename.
- **Document body** — if both bodies changed, the local one stays live and the
  remote one is written into history as a version labelled "Edited on
  &lt;device&gt;". Nothing is destroyed and nobody is interrogated.
- **Deletes** — a delete beats an edit; the tombstone wins, and the last version
  stays in history for the retention window.
- **Phase 4** replaces the body rule with a Yjs CRDT for real-time co-editing on
  Pro Max. `content_hash` and `version` are already the hooks for it.

### 6.4 Uploading a file

```text
client → Edge Function `storage-grant`  { workspaceId, size, mimeType }
           │  checks entitlements.storage_bytes against usage_counters
           ▼
       signed upload URL (60 s)         409 over_quota → the UI offers the upgrade
           │
client → Supabase Storage (direct, chunked; no function ever relays bytes)
           │
           ▼
      insert `files` row → trigger recounts usage → change_log → other devices
```

### 6.5 Upgrading a plan

```text
PlansScreen → Edge Function `billing-checkout` → Stripe Checkout (hosted)
                                                        │
                                            the user pays on Stripe
                                                        │
Stripe ──webhook──▶ Edge Function `billing-webhook` (signature verified)
                                 │  service role
                                 ▼
                          upsert `subscriptions`
                                 │
                  client re-reads `entitlements` on next focus
```

The client is never trusted about the plan, and a lapsed subscription never
deletes anything — sync goes read-only and history stops extending. Someone's
documents are not the leverage.

---

## 7. DTOs

**41 DTOs in 8 groups.** They live in `packages/types/src/api/`, are exported
under `@noto/types/api`, and are imported by the clients _and_ the Edge Functions.
Every one is validated at the boundary with **Zod** — the schema is the
definition and the type is inferred from it, so the two cannot drift.

Convention: a DTO is a wire shape. It is `camelCase`, its timestamps are
`IsoDateTime` strings, and it never contains a password hash, a token, a
`stripe_*` id, or another user's email.

### Group A — Auth requests (8)

| #   | DTO                     | Fields                                                                                              |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | `SignUpRequest`         | `email`, `password` (≥12, §8.2), `displayName?`, `turnstileToken`, `locale?`, `marketingOptIn`        |
| 2   | `SignInRequest`         | `email`, `password`, `turnstileToken?`, `device: DeviceRegistrationDto`                              |
| 3   | `OAuthStartRequest`     | `provider` (`google·github·apple`), `redirectTo`, `codeChallenge` (PKCE S256)                        |
| 4   | `MagicLinkRequest`      | `email`, `turnstileToken`                                                                            |
| 5   | `RefreshRequest`        | `refreshToken`                                                                                       |
| 6   | `PasswordResetRequest`  | `email`, `turnstileToken`                                                                            |
| 7   | `PasswordUpdateRequest` | `currentPassword?`, `newPassword`, `resetToken?`, `signOutOtherDevices`                              |
| 8   | `MfaVerifyRequest`      | `factorId`, `code` (6 digits) or `recoveryCode`                                                      |

### Group B — Auth responses (4)

| #   | DTO              | Fields                                                                                                                        |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 9   | `AuthSessionDto` | `accessToken`, `expiresAt`, `refreshToken`, `user: UserDto`, `mfaRequired`                                                     |
| 10  | `UserDto`        | `id`, `email`, `displayName`, `avatarUrl`, `locale`, `emailVerified`, `mfaEnabled`, `createdAt`, `updatedAt`                   |
| 11  | `MfaEnrollDto`   | `factorId`, `qrCodeSvg`, `secret`, `recoveryCodes: string[]` (shown once, never again)                                          |
| 12  | `AuthErrorDto`   | `code` (`invalid_credentials·rate_limited·mfa_required·email_unverified·weak_password·breached_password`), `message`, `retryAfterSeconds?` |

Note there is no distinct "unknown email" code. See §8.3.

### Group C — Account (6)

| #   | DTO                      | Fields                                                                                                     |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 13  | `DeviceRegistrationDto`  | `id`, `name`, `platform`, `osName`, `appVersion`                                                            |
| 14  | `DeviceDto`              | `id`, `name`, `platform`, `osName`, `appVersion`, `location`, `lastActiveAt`, `isCurrent`, `revokedAt`       |
| 15  | `SessionDto`             | `id`, `kind` (`desktop·web·mobile`), `client`, `location`, `startedAt`, `lastActiveAt`, `isCurrent`          |
| 16  | `SettingsDto`            | `appearance`, `editor`, `updates`, `syncEnabled`, `updatedAt` — the `Settings` tree, versioned               |
| 17  | `AuthEventDto`           | `id`, `kind`, `outcome`, `deviceName`, `location`, `createdAt`                                              |
| 18  | `AccountDeletionRequest` | `password` or `mfaCode`, `reason?`, `confirmEmail`                                                          |

13, 14 and 15 already have local counterparts in `packages/types/src/device.ts`.

### Group D — Content (7)

| #   | DTO                   | Fields                                                                                                                                                              |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19  | `WorkspaceDto`        | `id`, `name`, `ownerId`, `icon`, `isShared`, `role`, `serverSeq`, timestamps                                                                                          |
| 20  | `WorkspaceMemberDto`  | `workspaceId`, `userId`, `displayName`, `avatarUrl`, `role`, `invitedAt`, `acceptedAt`                                                                                |
| 21  | `FolderDto`           | `id`, `workspaceId`, `parentId`, `name`, `position`, `color`, `icon`, `serverSeq`, timestamps                                                                         |
| 22  | `DocumentDto`         | `id`, `workspaceId`, `folderId`, `title`, `content`, `status`, `excerpt`, `wordCount`, `isFavorite`, `tags`, `version`, `contentHash`, `lastEditedBy`, `serverSeq`, timestamps |
| 23  | `DocumentVersionDto`  | `id`, `documentId`, `version`, `author`, `wordCount`, `summary`, `isCurrent`, `createdAt` — matches `DocumentVersion`                                                  |
| 24  | `FileDto`             | `id`, `workspaceId`, `documentId`, `name`, `mimeType`, `size`, `checksum`, `downloadUrl` (signed, transient), timestamps                                              |
| 25  | `MemoryItemDto`       | `id`, `workspaceId`, `kind`, `title`, `content`, `source`, `url` (signed), `tags`, `isPinned`, `sizeBytes`, timestamps                                                |

22 and 25 are `NotoDocument` and `MemoryItem` plus the cloud columns. The overlap
is intentional: the sync layer casts, it does not translate.

### Group E — Sync (6)

| #   | DTO                | Fields                                                                                                                          |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 26  | `SyncChangeDto`    | `entityKind`, `entityId`, `operation`, `baseVersion`, `payload` (the entity DTO; absent on delete), `clientUpdatedAt`             |
| 27  | `SyncPushRequest`  | `workspaceId`, `deviceId`, `changes: SyncChangeDto[]` (≤200)                                                                     |
| 28  | `SyncPushResponse` | `applied: { entityId, version, serverSeq }[]`, `conflicts: SyncConflictDto[]`, `rejected: { entityId, code }[]`, `serverSeq`      |
| 29  | `SyncConflictDto`  | `entityKind`, `entityId`, `serverVersion`, `serverPayload`, `reason` (`stale_version·deleted_remotely·quota_exceeded·forbidden`)  |
| 30  | `SyncPullRequest`  | `workspaceId`, `sinceSeq`, `limit` (≤500), `deviceId`                                                                            |
| 31  | `SyncPullResponse` | `changes: { entityKind, entityId, operation, payload }[]`, `nextSeq`, `hasMore`, `fullResyncRequired`                            |

### Group F — Billing (5)

| #   | DTO                                   | Fields                                                                                                       |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 32  | `PlanDto`                             | `id`, `name`, `tagline`, `monthlyPrice`, `yearlyPrice`, `currency`, `isRecommended`, `highlights[]`            |
| 33  | `PlanLimitsDto`                       | `storageBytes`, `versionHistoryDays`, `aiRequestsPerMonth`, `syncedDevices`, `sharedWorkspaces`, `shareLinks`, `ocr`, `aiModelTier` |
| 34  | `SubscriptionDto`                     | `planId`, `status`, `billingCycle`, `currentPeriodEnd`, `cancelAtPeriodEnd` — **no Stripe ids**                |
| 35  | `EntitlementsDto`                     | `planId`, `limits: PlanLimitsDto`, `usage: UsageDto`, `refreshedAt`                                            |
| 36  | `CheckoutRequest` / `CheckoutResponse` | in: `planId`, `cycle`, `successUrl`, `cancelUrl` · out: `checkoutUrl`                                         |

### Group G — AI and search (3)

| #   | DTO                               | Fields                                                                                                    |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 37  | `AiRequest`                       | `operation` (`rewrite·summarise·continue·ask·title`), `input` (≤32k chars), `documentId?`, `instruction?`, `stream` |
| 38  | `AiResponse`                      | `output`, `model`, `tokensIn`, `tokensOut`, `requestsRemaining`, `truncated`                                 |
| 39  | `SearchRequest` / `SearchResponse` | in: `workspaceId`, `query`, `kinds[]`, `limit`, `cursor` · out: `hits: { entityKind, entityId, title, snippet, rank }[]`, `nextCursor` |

### Group H — Common (2)

| #   | DTO           | Fields                                                                                             |
| --- | ------------- | ---------------------------------------------------------------------------------------------------- |
| 40  | `ApiErrorDto` | `code` (the `NotoErrorCode` union, extended with `rate_limited` / `over_quota`), `message`, `requestId`, `retryAfterSeconds?`, `fields?` |
| 41  | `UsageDto`    | `storageBytes`, `documentCount`, `aiRequests`, `periodStart`, `periodEnd`                            |

`ApiErrorDto.code` deliberately reuses `NotoErrorCode` from
`packages/types/src/common.ts`, so a server failure lands in the same
`Result<T, NotoError>` the rest of Noto already handles.

---

## 8. Login and security

### 8.1 Methods

| Method                        | Platforms   | Notes                                                     |
| ----------------------------- | ----------- | --------------------------------------------------------- |
| Email + password              | all         | The baseline. Verification required before sync is enabled |
| Google / GitHub / Apple OAuth | all         | **PKCE**, always. Apple is required if iOS ever ships       |
| Magic link                    | web, mobile | Single-use, 15 minutes, invalidated on use                 |
| TOTP MFA                      | all         | Opt-in on Basic, offered during sign-up on the paid plans  |

`LoginScreen.tsx` already renders Google, GitHub and Apple buttons and says
plainly that no service is connected yet. Wiring them is the first task.

### 8.2 Passwords

- Minimum 12 characters, no composition rules, no forced rotation — NIST 800-63B,
  not the 2009 corporate template.
- Stored by GoTrue as **bcrypt** (cost ≥ 12). We never see or store the plaintext,
  and it is never written to a log.
- Every new or changed password is checked against **Have I Been Pwned** through
  the k-anonymity range API — the first five hex characters of the SHA-1 leave the
  device, never the password. A hit is refused with `breached_password` and an
  explanation, not a scolding.
- The strength meter on the sign-up form is `zxcvbn`, and it is advice, not a gate.

### 8.3 Enumeration and abuse

- Sign-in, reset and magic-link responses are **identical** for a known and an
  unknown address, in body and in timing (a constant floor of ~250 ms).
- Rate limits, backed by `auth_attempts`: 5 sign-in failures per email per 15 min,
  20 per IP per 15 min, 3 resets per email per hour, 5 sign-ups per IP per hour.
  Exceeding one returns `rate_limited` with `retryAfterSeconds`.
- Turnstile on sign-up, reset and magic link — invisible unless the visitor looks
  automated.
- Lockout is a delay, never a permanent block: an attacker must not be able to
  lock someone out of their own account merely by guessing at it.

### 8.4 Tokens, and where they live

| Token         | Lifetime          | Web                                     | Desktop                                          | Mobile              |
| ------------- | ----------------- | --------------------------------------- | ------------------------------------------------ | ------------------- |
| Access JWT    | 1 hour            | memory only                             | memory, main process                             | memory              |
| Refresh token | 30 days, rotating | httpOnly + Secure + SameSite=Lax cookie | **`safeStorage`** (DPAPI / Keychain / libsecret) | `expo-secure-store` |

Refresh tokens rotate on every use, and reuse of a consumed one revokes the whole
family — the standard theft signal. No token is ever written to `localStorage` on
desktop or mobile, ever passed in a URL, or ever logged.

The renderer process does not hold the refresh token at all: it asks the main
process over the existing IPC bridge, which is why
[`apps/desktop/src/main/preload.ts`](../apps/desktop/src/main/preload.ts) gains an
auth channel rather than the renderer gaining a network client.

### 8.5 Desktop and mobile OAuth

The browser-redirect flow does not exist in a desktop app, and embedding a webview
around Google's login screen is both against their policy and a phishing lesson we
should not be teaching. So:

```text
Noto opens the system browser  →  provider  →  redirect to noto://auth/callback
        │  PKCE verifier stays in the main process                    │
        └──────────────── code + state ───────────────────────────────┘
                    exchanged by the main process for tokens
```

`state` is a 32-byte random value checked on return; the code is single-use and
expires in 60 seconds.

**Task:** mobile already declares `scheme: "noto"` in
[`apps/mobile/app.json`](../apps/mobile/app.json); desktop registers no protocol
yet — it needs `app.setAsDefaultProtocolClient('noto')`, `second-instance`
handling on Windows and `open-url` on macOS in
[`apps/desktop/src/main/main.ts`](../apps/desktop/src/main/main.ts).

### 8.6 Authorization — RLS on every table

Every table gets `ENABLE ROW LEVEL SECURITY` with no permissive default. The
pattern, for the content group:

```sql
create policy "members read" on documents
  for select using (
    exists (
      select 1 from workspace_members m
      where m.workspace_id = documents.workspace_id
        and m.user_id = auth.uid()
    )
  );

create policy "editors write" on documents
  for update using (
    exists (
      select 1 from workspace_members m
      where m.workspace_id = documents.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'editor')
    )
  );
```

`subscriptions`, `plan_limits`, `change_log` and `auth_events` are **select-only**
to the user and writable solely by the service role. That key exists only in Edge
Function secrets — never in a client bundle, never in the repository, and never in
a `VITE_`-prefixed variable, since those ship to the browser by definition.

### 8.7 Data protection

- **In transit:** TLS 1.3, HSTS, certificate pinning on mobile for the API host.
- **At rest:** Postgres and Storage encrypted by the provider; nightly PITR
  backups with a 7-day window.
- **In the client:** the local SQLite file is _not_ encrypted today. Optional
  SQLCipher with a key in the OS keychain is a phase-4 item, and it belongs to
  [`docs/architecture/storage.md`](../docs/architecture/storage.md) rather than
  here.
- **End-to-end encryption** is deliberately absent from this plan. It would break
  server-side search, hosted history and AI — the three things the paid plans
  sell. If it is ever offered it has to be an explicit, per-workspace mode with
  those features visibly switched off, not a checkbox that quietly degrades the
  product.
- **Deletion:** an account delete opens a 30-day grace period, after which a
  `jobs` row purges rows and blobs. Export ships a ZIP of Markdown plus the raw
  JSON.
- **Logs:** no document content, no titles, no tokens, no full IP addresses.
  `detail` in `auth_events` holds reason codes.

### 8.8 Hardening checklist

CORS restricted to the known app origins and the `noto://` scheme. CSP on the web
app with no `unsafe-inline`. Electron keeps `contextIsolation: true`,
`nodeIntegration: false` and a `will-navigate` guard. Signed URLs stay short and
scoped to one object. Uploads are capped by size, sniffed for their real MIME
type, and served `Content-Disposition: attachment` with
`X-Content-Type-Options: nosniff`. A `SECURITY.md` and a disclosure address exist
before the first public account. Secrets live in GitHub Actions and Supabase
secrets only — see [`docs/deployment/secrets.md`](../docs/deployment/secrets.md).

---

## 9. Edge Functions

Only what RLS cannot do. Nine of them.

| Function           | Trigger        | Does                                                                                         |
| ------------------ | -------------- | ---------------------------------------------------------------------------------------------- |
| `auth-hook`        | GoTrue webhook | Creates `profiles`, seeds `user_settings`, writes `auth_events`                                |
| `device-register`  | client         | Upserts a device, enforces the plan's device count                                             |
| `storage-grant`    | client         | Quota check, then a signed upload URL                                                          |
| `billing-checkout` | client         | Creates a Stripe Checkout session                                                              |
| `billing-portal`   | client         | Creates a Stripe Billing Portal session                                                        |
| `billing-webhook`  | Stripe         | Signature-verified; the only writer of `subscriptions`                                         |
| `ai-proxy`         | client         | Quota check, prompt assembly, streaming relay. **The model API key never leaves the server**    |
| `account-delete`   | client         | Re-authenticates, then schedules the deletion job                                              |
| `export-account`   | client         | Builds the ZIP into `exports`, emails a signed link                                            |

Scheduled work runs on `pg_cron`: the version-history sweep, the monthly usage
reset, `change_log` compaction, `auth_attempts` cleanup, expired-export cleanup.

---

## 10. The API surface — what plays the part of a controller

There are no controllers in this backend, and that is the main saving. In a
Nest or Express service each table would need a controller, a service, a
repository and a DTO pair — 19 tables would mean something like 76 files before
a single feature existed. Here the work splits three ways:

| Kind                    | Count  | Written by hand?                        |
| ----------------------- | ------ | --------------------------------------- |
| REST endpoints (CRUD)   | ~76    | **No** — PostgREST generates them        |
| Postgres RPC functions  | **5**  | Yes — SQL                                |
| Edge Functions          | **9**  | Yes — TypeScript                         |
| **Total handlers**      | **14** |                                          |

### 10.1 Generated, not written

PostgREST exposes `GET/POST/PATCH/DELETE` for every table automatically, and RLS
decides who sees what. So the CRUD that would have been 19 controllers is zero
files. Authorization is not skipped — it moved into the database, where §8.6
puts it, and where it cannot be forgotten on one endpoint out of seventy-six.

The client reaches these through `@supabase/supabase-js`, which is already a
dependency of `packages/sync`.

### 10.2 The 5 RPC functions

Written in SQL because they are transactional and must be one round trip (§3.4):

| Function                 | Takes                | Returns              | Why not plain REST                            |
| ------------------------ | -------------------- | -------------------- | ---------------------------------------------- |
| `sync_push`              | `SyncPushRequest`    | `SyncPushResponse`   | 200 changes must apply atomically, with per-row version checks |
| `sync_pull`              | `SyncPullRequest`    | `SyncPullResponse`   | One cursor read across five tables             |
| `claim_local_workspace`  | `workspaceId`        | `WorkspaceDto`       | §6.1 step 7 — sets owner and enqueues everything in one transaction |
| `search_workspace`       | `SearchRequest`      | `SearchResponse`     | `tsvector` ranking across documents and memory |
| `revoke_device`          | `deviceId`           | `void`               | Revokes the device and its sessions together   |

### 10.3 The 9 Edge Functions

Listed in full in §9. They exist only where something must be secret (the Stripe
key, the model key), verified (a webhook signature), or checked before it is
allowed (a storage quota).

### 10.4 What gets written on the client

| Package           | Adds                                                              | Count               |
| ----------------- | ----------------------------------------------------------------- | ------------------- |
| `@noto/types`     | `api/` — the DTOs with their Zod schemas                          | **41 DTOs**         |
| `@noto/sync`      | `SupabaseSyncEngine`, persisted queue, connectivity detector      | ~6 files            |
| `@noto/sync`      | Platform connectivity adapters (web, desktop, mobile)             | 3 files             |
| `@noto/core`      | Auth store, entitlements store                                    | 2 stores            |
| `apps/desktop`    | Auth + sync IPC channels in `main/`, keychain via `safeStorage`   | ~3 files            |
| `apps/mobile`     | `expo-secure-store` and NetInfo bridge                            | ~2 files            |
| `packages/ui`     | Wire `LoginScreen`, `AccountScreen`, `PlansScreen` to real data   | existing files      |

**No repositories are written.** `packages/database` already has them, and they
stay pointed at local storage — the cloud never gets its own repository layer,
because the UI never reads from the cloud (§0).

### 10.5 The whole build, in one count

| Piece                      | Count             |
| -------------------------- | ----------------- |
| Tables                     | 19                |
| Columns                    | 189               |
| Views                      | 1                 |
| Enum types                 | 8                 |
| Storage buckets            | 4                 |
| Triggers                   | ~8                |
| RLS policies               | ~50               |
| RPC functions              | 5                 |
| Edge Functions             | 9                 |
| DTOs                       | 41                |
| Hand-written HTTP handlers | **14**            |
| Controllers                | **0**             |

For phase 1 alone — a working account, on all three platforms — it is 5 tables,
43 columns, 1 RPC function, 1 Edge Function and 18 DTOs.

---

## 11. Phasing

| Phase                  | Ships                                                                                                                                                  | Costs                              | Unblocks           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------ |
| **1** Identity         | Supabase project, `profiles` / `devices` / `auth_events`, RLS, GoTrue wired to `LoginScreen`, PKCE deep links, the account screen reading real devices  | **$0**                             | A real account     |
| **2** Sync             | Content tables, `change_log`, `sync_push` / `sync_pull`, a persisted queue, the conflict rules, `SupabaseSyncEngine` implementing the existing contract | **$0**                             | Pro's core promise |
| **3** Files, plans, AI | Storage buckets, `storage-grant`, Stripe, `entitlements`, `ai-proxy`, `PlansScreen` reading live plans                                                  | Stripe's cut + AI tokens, per user | Revenue            |
| **4** Together         | Realtime, shared workspaces, share links, Yjs on document bodies, cloud full-text search                                                                | Free until the tier is outgrown    | Pro Max            |

Phase 1 is the only one with no way around it. Everything after it can ship
independently, because the local app never depended on any of it.

The phase boundary and the money boundary are the same line, deliberately.
Phases 1 and 2 deliver the thing users actually ask for — my notes, on my other
device — and cost nothing to run. Phase 3 is where an invoice first appears, and
by then there is something to charge for. Nothing before it needs a card, and
nothing before it can produce a surprise bill.

---

## 12. Open questions

1. **Region.** One EU region for GDPR simplicity, or US-first for latency? It
   decides the Supabase project and is expensive to reverse.
2. **`memory_items` on Basic.** The plan table says Memory is local on Basic — is
   uncapped local clipboard history a support problem waiting to happen?
3. **Version granularity.** Full JSONB snapshots are simple and will get large. At
   what document size does a diff format start paying for itself?
4. **AI provider.** `ai_model_tier` in `plan_limits` is deliberately a string so
   the choice is configuration rather than a migration — but the choice still has
   to be made before phase 3.
5. **Anonymous → account claim.** §6.1 step 7 assumes one local workspace. What
   happens when someone has three, across two devices, and signs into the same
   account from both?
