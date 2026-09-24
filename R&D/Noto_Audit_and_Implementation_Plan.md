# Noto — Product Audit, Improvements & Step-wise Implementation Plan

_Web · Desktop · Mobile · Website · Backend · Release_

| Item | Value |
| --- | --- |
| Codebase version | 1.4.1 (branch `dev`, HEAD `6eef533`) |
| Audit date | 23 September 2026 |
| Inputs reviewed | Full monorepo (apps/*, packages/*, supabase/, scripts/, .github/) and all R&D documents: PRD, Backend_Plan, Backend_Node_Plan, Build&Release, Setup_and_Installation, Design System, Improvements.txt |
| Health at audit time | Typecheck, lint and all 199 unit tests pass (16 files). Playwright e2e: 59 web tests exist. |
| Backend direction | PostgreSQL + Node (Hono) per [`Backend_Node_Plan.md`](Backend_Node_Plan.md). No Supabase, no Docker. |

Status key: ✅ Done · 🟡 Partial · 🟠 Mock / UI only · ❌ Missing. Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low.

## Contents

- [1. Executive summary](#1-executive-summary)
- [2. What is built today](#2-what-is-built-today)
- [3. PRD feature coverage](#3-prd-feature-coverage)
- [4. Issues found and how to improve](#4-issues-found-and-how-to-improve)
- [5. Step-wise implementation plan](#5-step-wise-implementation-plan)
- [6. Release and infrastructure checklist](#6-release-and-infrastructure-checklist)
- [7. Open decisions](#7-open-decisions)
- [Implementation status](#implementation-status)

---

## Implementation status

_Last updated 24 September 2026. Branch `dev`, pushed. Each step was checked with lint, typecheck, unit tests and the web e2e suite before it was committed._

### Overall

| Phase | Theme | Status | Progress |
| --- | --- | --- | --- |
| 0 | Stabilise and harden | ✅ Done | 8 of 8 steps |
| 1 | Finish the local product | ✅ Done | 9 of 9 steps |
| 2 | Backend foundation (`apps/api`) | ❌ Not started | Needs D1 (host) and a Postgres instance |
| 3 | Cutover from Supabase | ❌ Not started | Depends on Phase 2 |
| 4 | Sync | ❌ Not started | Local outbox and version counters already exist (Phase 1.1) |
| 5 | Mobile parity | ❌ Not started | Depends on Phases 3–4 |
| 6 | Desktop power features | ❌ Not started | |
| 7 | Paid product | ❌ Not started | Needs D5 (payment provider) |
| 8 | AI | ❌ Not started | Needs D4 (AI provider) |
| 9 | Collaboration | ❌ Not started | |

In steps: **all 17 steps in Phases 0–1 are done**, which is **2 of the 10 phases**. Phases 2–5 are being worked on in separate sessions and git worktrees (`Noto-phase2` … `Noto-phase5`); they will record their own status here as they merge. Phases 2–9 are the larger share of the remaining work, and most of them need a decision or an account first (see §7).

Test counts at this point: 318 unit tests (up from 199), 78 web e2e tests (up from 59; 2 skip in a build without cloud config).

### Phase 0 — Stabilise and harden ✅

| Step | Status | Commit | What was done |
| --- | --- | --- | --- |
| 1. Device hijack (S1) | ✅ | `1b55886` | Device registration updates only rows the caller owns; an id owned by someone else is refused. Regression tests. |
| 2. RLS columns, rate limits (S5, S6) | ✅ | `ba478ab` | Migration protecting device/profile columns; rate limiter fails closed; per-IP sign-in limit; `CF-Connecting-IP`. |
| 3. Desktop hardening (S2–S4) | ✅ | `00282c3` | Every IPC handler checks its sender; SQL channel refuses `ATTACH`, `VACUUM INTO`, `load_extension` and unknown pragmas; no new windows or navigation; CSP `connect-src` from the build config. |
| 4. Web CSP, source maps, CORS (S7–S9) | ✅ | `f8d64d1`, `61a566a` | Build-time `_headers` with a hashed strict CSP on both sites; source maps not deployed; localhost CORS only on a local stack; exact OAuth redirect allow-list. |
| 5. Error boundaries | ✅ | `285eb7c` | Per-screen and top-level boundaries; stale-chunk message after a deploy; desktop dock guarded. |
| 6. NOT_CONNECTED controls | ✅ | `af3716d` | Dead buttons hidden or disabled; fixture "facts" removed from the Account screen. |
| 7. Repo hygiene | ✅ | `7cc0551` | `update-electron-app` removed; `wrangler.jsonc` formatting resolved. |
| 8. R&D documents, `database.md` | ✅ | `eeed60e` | PRD, Build&Release, Backend_Plan and Backend_Node_Plan aligned (Turborepo, React, Node + Postgres, no Docker); `docs/development/database.md` written. |

Not yet done from Phase 0's "done when": a manual check that a packaged desktop build reaches the backend.

### Phase 1 — Finish the local product ✅

| Step | Status | Commit | What was done |
| --- | --- | --- | --- |
| 1. Local schema v2 | ✅ | `27d5c4b` | `memory_items`, `document_versions`, tag index, persisted outbox, `local_state`, `version` and `content_hash`; one contract test suite over in-memory, SQLite and IndexedDB, plus upgrade tests. |
| 2. Noto Memory | ✅ | `602934b` | Real storage; Quick Note keeps notes in Memory; Smart Sidebar captures the clipboard or a link; `mock/memory.ts` deleted. |
| 3. Version history | ✅ | `6f2ec28` | Versions kept on rest (10 min), on Save and before restore; preview, compare (line diff), restore; `mock/versions.ts` deleted. |
| 4. Recovery and drafts in the database | ✅ | `7718ab9` | Recovery snapshots in `local_state` (legacy localStorage snapshots migrated); Quick Note draft mirrored durably. |
| 5. Folders and tags | ✅ | `d9c6911` | Folder tree with drag and drop, nesting, rename, remove; folder picker and tag editor in the Info tab. |
| 6. Tab controls | ✅ | `2585664` | Pin, duplicate, move, reopen closed, close others; right-click tab menu; commands with shortcuts. |
| 7. Search index, long lists | ✅ | `37c22e4` | Incremental full-text index (one JS index on every platform, not FTS5); long lists drawn progressively as they scroll. |
| 8. PDF/DOCX export, HTML import | ✅ | `1146c8a` | DOCX export (own WordprocessingML + ZIP writer); PDF written to a file on desktop, print dialog elsewhere; HTML import through the editor schema (scripts and unsafe links dropped); export now flushes pending edits first. |
| 9. Split oversized files | ✅ | `3a8dcc7` | SettingsScreen, ContextPanel, export, icons, core commands, local-file, EditorToolbar and NotoApp split into folders; no public API or behaviour change. |

Phase 1 "done when" check: the only fixtures left in `packages/ui/src/mock/` are `templates.ts`, `account.ts` and `plans.ts`. The last two belong to Phases 3 and 7. e2e covers Memory, versions, folders, tags, search, tabs, export and import.

### Bugs found and fixed along the way

- A keyboard shortcut pressed as the workspace appeared ran a stale handler. This was the long-standing flaky "opens a file from disk" e2e test (`5562963`).
- Keeping a Quick Note wiped text typed while the save was running (`602934b`).
- Templates, imports and duplicates could open as an empty document (`2585664`).
- SQLite saves used `INSERT OR REPLACE`, which with foreign keys on could cascade-delete a document's files (`27d5c4b`).
- Export read the stored copy, so the last second of typing was missing from exported files (`1146c8a`).

### Known issues

- Commit `5562963` also contains the deletion of `mock/versions.ts`, so that single commit does not build on its own; the next commit does.
- Desktop and mobile builds have not been checked by hand since these changes; only web was exercised end to end.

## 1. Executive summary

Noto has a strong, well-engineered **local editor product** on Web and Desktop: tabs, rich formatting, find/replace, page layout, print, autosave, crash recovery, open/save to disk, import/export, command palette and a Quick Note dock that survives the window. The code is clean, typed, linted and tested at the package level, and the release pipeline (versioning, tags, multi-platform desktop builds, Android builds, checksums, auto-update) is further along than most projects at this stage.

What is missing is almost everything **behind** the editor: the cloud backend is only phase-1 identity on Supabase (which is now being replaced), there is **no sync engine**, and several visible screens (Memory, Version history, Account devices/plan, Plans/billing, AI) still run on **mock data**. Mobile runs on Android only, without an account. There are also a handful of **security issues** that should be fixed before any more users sign in.

### 1.1 Completeness at a glance

| Area | Status | One-line verdict |
| --- | --- | --- |
| Web app (editor & workspace) | ✅ Done | Feature-complete for the Basic tier; needs error boundary, CSP, list virtualisation. |
| Shared UI / core / editor packages | ✅ Done | Solid; a few very large files; no component tests. |
| Desktop (Electron) | 🟡 Partial | Dock, tray, shortcuts, files, auto-update work. Missing deep links, app menu, clipboard capture; IPC & CSP need hardening. |
| Mobile (Expo + WebView) | 🟡 Partial | Android works offline. No account, no sync, no share-in; iOS not functional. |
| Marketing website | ✅ Done | Live download page; add CSP, sitemap, robots.txt. |
| Backend / identity | 🟡 Partial | Supabase phase-1 auth only. Node + Postgres rewrite (`apps/api`) not started. |
| Sync | ❌ Missing | Interfaces and an in-memory queue only. No transport, no persisted queue, no conflict handling. |
| Memory, Version history, Plans, AI | 🟠 Mock | Screens exist but read fixtures from `packages/ui/src/mock/`. |
| CI/CD & release | ✅ Done | Strong pipeline. Signing, Play Store, TestFlight and beta update feed not switched on. |
| Testing | 🟡 Partial | Packages covered; zero tests for desktop/mobile/website shells, backend functions, RLS. |

### 1.2 Top ten priorities

1. **Fix the device-hijack bug** in sign-in (service-role upsert keyed only on client-supplied device id).
2. **Harden the desktop app**: add `connect-src` to CSP, stop exposing arbitrary SQL over IPC, add navigation/window-open guards.
3. **Add a React ErrorBoundary** and a Content-Security-Policy to the web app and website.
4. **Replace mocks with real local data** for Memory, Version history and Tags/Folders — these are local-first features and need no backend.
5. **Start apps/api** (Hono + Postgres) and port identity (Node plan phases 0–1).
6. **Cut over from Supabase** in one planned release (Node plan phase 2).
7. **Build sync** (persisted queue, push/pull, change log, conflict rule) — the core Pro promise.
8. **Give mobile an account and sync**, then make iOS load the bundled UI.
9. **Switch on code signing** for Windows/macOS and publish to Google Play.
10. **Bring the R&D documents in line with reality** (Nx→Turbo, Angular→React, Supabase→Node, Docker notes).

## 2. What is built today

### 2.1 Architecture and stack (actual)

| Layer | Technology in the repo |
| --- | --- |
| Monorepo | pnpm 11 workspaces + Turborepo 2, TypeScript 6, ESLint 9, Prettier 3, Vitest 4, Playwright |
| Web app | React 19, Vite 8, Tailwind 4; deployed as a static-assets Cloudflare Worker (`noto-web`) |
| Shared UI | `packages/ui` — every screen lives here; custom hash router with 10 routes, lazy-loaded screens |
| Editor | TipTap 3 / ProseMirror with custom extensions (invisibles, keymap, search, safe URLs) |
| State | Zustand stores in `packages/core` (settings, tabs, ui) + small external stores |
| Local storage | Dexie/IndexedDB (web), SQLite via `node:sqlite` (desktop), expo-sqlite (mobile) behind one `NotoDatabase` interface |
| Desktop | Electron 43 + Electron Forge 7 (Squirrel, DMG/ZIP, AppImage/deb/rpm), built-in autoUpdater |
| Mobile | Expo 57 / React Native 0.86 shell rendering the shared UI (`apps/mobile-webview`) inside a WebView, SQL bridged to expo-sqlite |
| Website | React 19 + Vite, 10 pages, live GitHub Releases download page, Cloudflare Worker `noto` |
| Backend (today) | Supabase: 7 migrations (identity only), 3 Deno Edge Functions, GoTrue auth, Turnstile on sign-up |
| Backend (planned) | Node 20 + Hono + Kysely + PostgreSQL, argon2id, JWT + rotating refresh tokens, R2, Resend |

### 2.2 Web app and shared packages

**Implemented and working:**

- Workspace shell: header of tabs, collapsible sidebar with document list and recents, responsive mobile header and nav.
- Tabs restored across reloads with unsaved markers; open/save/Save As to disk (File System Access API), recent files.
- Editor: marks, headings, lists, nested checklists, tables with controls, images (URL/base64), alignment, safe links, find/replace, undo/redo, invisibles, zoom, word wrap, page layout with margins, outline, status bar counts.
- Print, autosave with configurable delay, crash-recovery snapshots.
- Import .txt/.md/.json/.html; export .md/.txt/.html/Noto JSON.
- Documents screen (list/grid, filters, trash & restore, tag facets), Home with 4 templates, Search with ranking and highlighting.
- Command palette (~74 commands), keyboard shortcuts dialog, Quick Note overlay/screen/dock with persisted drafts, Quick Paste, Floating Noto, Smart Sidebar overlays.
- Login/sign-up/reset with Turnstile, route guard, sign-out, update notification, 13-category Settings, light/dark/system theme.

**Stubbed or mocked (visible to users):**

| Feature | Status | Where |
| --- | --- | --- |
| Noto Memory (screen, recall, search hits) | 🟠 Mock | `ui/src/mock/memory.ts`, `memory/use-memory.ts` |
| Version history (list, preview, compare, restore) | 🟠 Mock | `mock/versions.ts`, `ContextPanel.tsx:584–632` (toasts only) |
| Account plan, security, devices, sessions | 🟠 Mock | `use-account.ts:35`, `mock/account.ts` |
| Plans / upgrade | 🟠 Mock | `PlansScreen.tsx:27` hard-codes `basic`; upgrade toasts NOT_CONNECTED |
| AI assistant panel | 🟠 UI only | `overlays/AIAssistantPanel.tsx` (“Preview” badge) |
| Folders UI | ❌ Missing | Data layer exists (`core/folders.ts`), Settings shows “Coming soon” |
| Tag editing | ❌ Missing | Tags shown read-only in `ContextPanel.tsx` |
| Clipboard watching, Memory capture | ❌ Missing | Settings “Coming soon” badges |
| Sync toggle | 🟠 UI only | Only changes labels; no engine behind it |
| PDF / DOCX export | ❌ Missing | `export.ts` marks `supported: false`; PDF only via Print |
| HTML import | 🟡 Partial | Strips to plain text (`export.ts:556`) |
| Smart Sidebar screen capture | 🟠 UI only | `SmartSidebar.tsx:57` toast |

### 2.3 Desktop (Electron)

- **Works:** single-instance lock, close-to-tray, tray menu, always-on-top Quick Note dock draggable to either edge, global shortcuts (Quick Note, Quick Paste, toggle dock), printing, dialog-granted file read/write (persisted grants, capped at 500), SQLite in WAL mode, Supabase sign-in, auto-update on the stable channel via update.electronjs.org.
- **Security baseline is good:** `contextIsolation`, `sandbox`, no `nodeIntegration`, `openExternal` limited to https.
- **Missing:** custom application menu, `noto://` deep links, OS file associations (double-click a .md to open in Noto), clipboard history, screenshot capture, PIP/Companion, native notifications, desktop sign-up (Turnstile cannot run on `file://`).
- **Beta/nightly channels** exist in the UI but have no feed URL, so they report “unsupported”.
- **Dead dependency:** `update-electron-app` is declared but never imported.

### 2.4 Mobile (Expo + WebView)

- **Works on Android:** the full shared UI bundled into the APK, native SQLite via a postMessage bridge, print (expo-print), export via the share sheet, back button, safe areas, splash, dark mode. Split APKs ~16 MB.
- **Missing:** account and sign-in (no `AccountContext` provided), sync, receiving shares from other apps, deep links (scheme `noto` declared but unhandled), widgets, push, biometrics, file import.
- **iOS is not functional:** the packaged UI path is an Android asset path and the copy plugin is Android-only; CI produces only an unsigned archive.
- WebView runs with `allowUniversalAccessFromFileURLs`; acceptable only while no remote content is ever loaded.

### 2.5 Website

- 10 pages (Home, Features, Download, Docs, Changelog, Release notes, FAQ, About, System requirements, 404) with platform-detecting downloads from the GitHub Releases API.
- Good headers (`nosniff`, frame DENY, referrer & permissions policy). **Missing:** CSP, `sitemap.xml`, `robots.txt`; unauthenticated GitHub API calls are rate-limited to 60/hour per visitor IP.

### 2.6 Backend, database and sync

- **Supabase schema:** `profiles`, `devices`, `auth_events`, `auth_attempts`, `user_settings` with RLS. No content tables (workspaces, documents, folders, files, memory, versions, change_log).
- **Service layer** (`packages/backend`) is vendor-neutral (ports & adapters) with rate limits, timing padding and audit logging — this survives the move to Node unchanged.
- **Edge functions:** `auth-signin`, `auth-signup`, `device-register` only (comments refer to nine). No password-reset, profile, settings, revoke-device, OAuth or MFA endpoints.
- **Sync:** `SyncEngine`/`SyncQueue` interfaces, an in-memory queue and a no-op `LocalOnlySyncEngine` that no app imports. Entities carry only `updatedAt`/`deletedAt` — no version counter.
- **Local schema:** workspaces, folders (tree), documents (TipTap JSON, tags as a JSON array), files. Memory items and versions are not persisted anywhere; recovery snapshots and quick-note drafts live in localStorage.
- **apps/api does not exist yet.** The Node plan also references `docker-compose.yml` and `docs/development/database.md`, neither of which is in the repo.

### 2.7 CI/CD and release

- `ci.yml`: format, lint, typecheck, unit tests, build, Playwright (label-gated on PRs).
- `desktop.yml`: 5-target matrix (Win x64/arm64, macOS arm64/x64, Linux x64) with retry wrappers; Node pinned to 22.
- `mobile.yml`: Android APK + AAB with keystore validation; iOS unsigned archive.
- `release.yml`: tag-driven release with metadata checks, SHA256SUMS, generated notes. `scripts/version.mjs` keeps every manifest in sync.
- **Not switched on:** code signing (`NOTO_RELEASE_SIGN` defaults false), Play Store upload, TestFlight/App Store, beta update feed, branch protection.

## 3. PRD feature coverage

Every feature in `R&D/PRD.md` §5–§7 against what the code does today.

### 3.1 Basic tier

| PRD feature | Status | Notes |
| --- | --- | --- |
| 5.1 Text editor | ✅ Done | TipTap 3, shared schema across platforms |
| 5.2 Rich formatting | ✅ Done | Marks, blocks, tables, checklists, alignment, images |
| 5.3 Files | ✅ Done | Open/save/Save As, recents, grants on desktop |
| 5.4 Tabs | ✅ Done | Restored on reload, unsaved markers |
| 5.5 Undo / Redo | ✅ Done |  |
| 5.6 Find / Replace | ✅ Done | Match case; no regex / whole-word yet |
| 5.7 Word wrap | ✅ Done |  |
| 5.8 Zoom | ✅ Done |  |
| 5.9 Show characters | ✅ Done | Invisibles extension |
| 5.10 Scrolling | ✅ Done |  |
| 5.11 Print | ✅ Done | Web, desktop, mobile (expo-print) |
| 5.12 Auto save | ✅ Done | Configurable delay + crash recovery |

### 3.2 Advanced tier

| PRD feature | Status | Notes |
| --- | --- | --- |
| 6.1 Floating Noto | 🟡 Partial | In-app overlay; desktop dock covers part of it |
| 6.2 Smart Sidebar | 🟡 Partial | Overlay UI; capture action is a toast |
| 6.3 Quick Note | ✅ Done | Overlay, screen, desktop dock + global shortcut |
| 6.4 Noto Memory | 🟠 Mock | Needs a `memory_items` local table |
| 6.5 Clipboard history | ❌ Missing | Desktop clipboard watcher not built |
| 6.6 Quick Paste | 🟡 Partial | UI with virtual list; source is mock memory |
| 6.7 Screenshot capture | ❌ Missing | Needs `desktopCapturer` |
| 6.8 Image capture | 🟡 Partial | Insert image by URL/base64; no capture |
| 6.9 Link capture | ❌ Missing |  |
| 6.10 Pin content | ❌ Missing |  |
| 6.11–6.15 Tab controls (pin, duplicate, move, restore closed) | ❌ Missing | No such commands in `core/commands.ts` |
| 6.16 Import / Export | 🟡 Partial | No PDF/DOCX export; HTML import is lossy |
| 6.17 PDF | 🟡 Partial | Via Print only |
| 6.18 Layout | ✅ Done | Page layout, margins, full-width mode |
| 6.19 Settings | 🟡 Partial | 13 categories; several “Coming soon” |

### 3.3 Pro tier

| PRD feature | Status | Notes |
| --- | --- | --- |
| 7.1 Device sync | ❌ Missing | Needs backend phase 3 + client engine |
| 7.2 Real-time sync | ❌ Missing | After basic sync; WebSocket/SSE channel |
| 7.3 Web + Desktop + Mobile | 🟡 Partial | Mobile Android-only, no account |
| 7.4 Noto Companion | ❌ Missing |  |
| 7.5 PIP mode | ❌ Missing |  |
| 7.6 Smart Paste | ❌ Missing |  |
| 7.7 AI Assistant | 🟠 UI only | No provider or proxy |
| 7.8 AI Search | ❌ Missing | Needs pgvector + embeddings |
| 7.9 AI Organization | ❌ Missing |  |
| 7.10 Memory search | ❌ Missing | Depends on real Memory |
| 7.11 Version history | 🟠 Mock | Local snapshots first, then hosted |
| 7.12 Advanced recovery | 🟡 Partial | Local recovery snapshots in localStorage |

### 3.4 Items from Improvements.txt

| Request | Status | Notes |
| --- | --- | --- |
| Sidebar collapse/expand handle in a better place | ✅ Done | Moved into the brand bar (commits 3a40b5e, 6eef533) |
| Animated theme toggle: light \| dark \| system | ✅ Done | `ThemeToggle.tsx` cycles all three |
| Main UI full width | ✅ Done | Page layout vs full-width text (commit 93bf4a7) |
| Quick Note shortcut + dock that stays on screen, draggable to either side | ✅ Done | Desktop dock (`apps/desktop/src/main/dock.ts`) |
| Remove Settings/Account from sidebar list | ✅ Done | Moved to the account menu in the sidebar footer |
| A wonderful login UI | ✅ Done | `LoginScreen.tsx`; desktop sign-up still redirects to web |
| Compare plans: Basic \| Pro \| Pro Max | 🟠 Mock | Screen exists; no real billing or entitlements |

## 4. Issues found and how to improve

Severity: **Critical** = fix before more users sign in; **High** = fix this cycle; **Medium** = plan in; **Low** = polish.

### 4.1 Security

| # | Issue | Severity | Fix |
| --- | --- | --- | --- |
| S1 | Sign-in upserts `devices` with the service-role client keyed on a client-supplied id; another user’s device row can be re-assigned and un-revoked (`backend/src/supabase/adapters.ts:261`, `auth-signin`). | 🔴 Critical | Upsert only where `user_id` matches; reject id collisions with a different owner. Carry the rule into the Node `devices` controller. |
| S2 | Desktop exposes `notoSql.execute/select` taking arbitrary SQL from any renderer, with no sender check (`preload.ts:23`, `ipc.ts:13`). | 🟠 High | Move repositories into the main process and expose typed calls, or at minimum validate `event.senderFrame` and allow-list statements. |
| S3 | Desktop CSP has no `connect-src` — packaged builds may block all https calls to the backend (`apps/desktop/index.html:8`). | 🟠 High | Add `connect-src 'self' https://<api-host>` and set CSP from the main process via headers. |
| S4 | No `setWindowOpenHandler` / `will-navigate` guards on desktop windows. | 🟠 High | Deny all new windows; route external links through `openExternal`. |
| S5 | Devices RLS lets an owner write `revoked_at`, `last_seen_ip`, `location` directly; profile owner can edit `deleted_at`. | 🟠 High | Restrict updatable columns (column grants or trigger). In Node, only controllers write these. |
| S6 | Rate limiter fails open on DB error; sign-in has no per-IP limit; sign-up IP limit skipped without `x-forwarded-for`. | 🟠 High | Fail closed; add per-IP sign-in bucket; take IP from the trusted proxy header (`CF-Connecting-IP`). |
| S7 | No CSP on web app or website. | 🟡 Medium | Add `_headers` / Worker headers with a strict CSP; restrict `img-src` or proxy remote images. |
| S8 | CORS allows any localhost port in production; `redirectUrl` accepts any https URL. | 🟡 Medium | Localhost only in development; allow-list redirect origins. |
| S9 | Source maps are deployed publicly with the web app. | 🔵 Low | Upload maps to error tracking; exclude from `dist` assets. |
| S10 | Audit adapter silently drops failed writes; password policy is length-only. | 🔵 Low | Log audit failures; add a common-password list check. |

### 4.2 Reliability and correctness

| Issue | Severity | Improvement |
| --- | --- | --- |
| No React ErrorBoundary — a failed lazy chunk or render error blanks the app. | 🟠 High | Top-level and per-screen boundaries with “Reload” and a recovery link. |
| Recovery snapshots and quick-note drafts live in localStorage (5 MB, easily cleared). | 🟡 Medium | Move into the local database (IndexedDB/SQLite) with the version-history table. |
| Sync queue is in memory only; entities have no version counter. | 🟠 High | Add `version`/`content_hash` columns and a persisted outbox (Node plan §5 “local schema v2”). |
| CI-built desktop packages likely ship without cloud config (Supabase vars not passed). | 🟡 Medium | Bake API URL into environment overlays; fail the Production build when missing. |
| `marketingOptIn` validated but never saved; `last_seen_ip`/`location` never written. | 🔵 Low | Persist or remove the fields. |

### 4.3 Performance

| Issue | Severity | Improvement |
| --- | --- | --- |
| Sidebar list, Documents, Search and Memory render full lists. | 🟡 Medium | Reuse `components/VirtualList.tsx` everywhere a list can exceed ~200 rows. |
| Search is an in-memory substring scan over all documents. | 🟡 Medium | Local full-text index (MiniSearch/FlexSearch on web, SQLite FTS5 on desktop/mobile), updated on save. |
| WorkspaceScreen chunk ~500 KB and main chunk ~414 KB raw; no budget in CI. | 🟡 Medium | Split TipTap extensions (tables, images) lazily; add `manualChunks`; add a bundle-size check to `ci.yml`. |
| Base64 images stored inside document JSON. | 🟡 Medium | Store images in the `files` table / R2 and reference by id. |

### 4.4 UX and design

- Replace every “Coming soon” / NOT_CONNECTED toast with either a real feature or a hidden control — dead buttons erode trust.
- Add a Folders tree to the sidebar and tag editing in the context panel (data layer already exists).
- Add a Trash retention setting and “empty trash”.
- Desktop: native application menu (File/Edit/View/Window/Help) with the existing command ids; OS file associations for .md/.txt; `noto://` deep links for sign-in callbacks.
- Mobile: native share-in (“Share to Noto”), a Quick Note home-screen widget/shortcut, and biometric lock.
- Accessibility: add axe checks to Playwright; keyboard-only e2e for the palette, tabs and dialogs; verify contrast in dark mode.
- Internationalisation: extract strings into a message catalogue before the copy grows further (at least prepare, even if English-only at launch).

### 4.5 Code quality and maintainability

- Split the largest files: `icons.tsx` (1,183 lines), `commands.ts` (923), `SettingsScreen.tsx` (917 — one file per category), `local-file.ts` (894), `NotoApp.tsx` (741), `EditorToolbar.tsx` (700), `export.ts` (682), `ContextPanel.tsx` (640).
- Rename `packages/ui/src/mock/templates.ts` (it is real data) and delete fixtures as each feature becomes real.
- Remove the unused `update-electron-app` dependency, `apps/web/vite-dev.log` and committed `test-results/`.
- Commit or revert the pending trailing-comma change in `apps/web/wrangler.jsonc`.

### 4.6 Testing gaps

| Area | Today | Add |
| --- | --- | --- |
| Packages (core, editor, ui, db, sync, backend) | ✅ Pass | Dexie and SQLite repository tests; component tests with Testing Library |
| Web e2e (Playwright) | 🟡 Partial | Search, Documents/trash, Settings, Quick Note, import/export, theme, mobile viewport, real sign-in against staging |
| Desktop shell | ❌ None | Unit tests for file grants and IPC validation; Playwright-Electron smoke test in `desktop.yml` |
| Mobile shell | ❌ None | Bridge unit tests; Maestro or Detox smoke test on an emulator |
| Backend / SQL | ❌ None | Controller integration tests against a real Postgres; authorization tests per table |
| Website | ❌ None | One Playwright smoke test (download page resolves a release) |

### 4.7 R&D document drift

| Document | What is out of date | Action |
| --- | --- | --- |
| PRD.md §12, §23, §25 | Says Nx, Supabase, Supabase Storage/Realtime | Update to Turborepo, Node + Postgres, R2, own realtime |
| Build&Release.md | Specifies Angular and Capacitor (a note acknowledges it) | Rewrite §12 and §18 for React/Vite and Expo |
| Backend_Plan.md | Supabase-based; superseded for the “how” | Mark as superseded at the top; keep for data model |
| Backend_Node_Plan.md | Phase 0 says “Docker Postgres”, deployment row says “Docker → Fly.io/Railway”; references missing `docker-compose.yml` and `docs/development/database.md` | Align with the no-Docker decision: native Postgres locally; choose a non-container Node host; write `database.md` |
| supabase/README.md, docs/architecture/overview.md | Describe Supabase as the cloud | Update after the cutover |

## 5. Step-wise implementation plan

Phases are ordered so each one ships on its own and nothing is thrown away. Phases 1 and 2 can run in parallel (local product vs. backend). Sizes are relative: **S** ≈ days, **M** ≈ 1–2 weeks, **L** ≈ 3–5 weeks for one developer.

| Phase | Theme | Depends on | Size |
| --- | --- | --- | --- |
| 0 | Stabilise and harden | — | S–M |
| 1 | Finish the local product (replace mocks) | 0 | L |
| 2 | Backend foundation: `apps/api` + identity | 0 | L |
| 3 | Cutover from Supabase | 2 | M |
| 4 | Sync | 1, 3 | L |
| 5 | Mobile parity (account, sync, iOS, native) | 3, 4 | L |
| 6 | Desktop power features | 1 | M–L |
| 7 | Paid product: files, search, billing, entitlements | 4 | L |
| 8 | AI | 7 | L |
| 9 | Collaboration: sharing, realtime, OAuth, MFA | 7 | L |
| ∞ | Continuous: testing, performance, release, docs | — | ongoing |

### Phase 0 — Stabilise and harden

> **Goal:** Close the security issues and make failures visible before adding features. · **Size:** S–M

1. Fix S1: guard the device upsert by `user_id` in `SupabaseDeviceAdapter.upsert`; add a regression test.
2. Fix S5 and S6: column-restrict devices/profiles updates; make the rate limiter fail closed; add per-IP sign-in limit.
3. Desktop: add `connect-src` to CSP (S3), window-open and navigation guards (S4), sender validation on SQL IPC (S2, interim).
4. Web + website: add CSP headers (S7); stop publishing source maps (S9); restrict CORS/redirects (S8).
5. Add a top-level and per-screen React ErrorBoundary.
6. Hide or clearly label every NOT_CONNECTED control so no button silently does nothing.
7. Repo hygiene: remove `update-electron-app`, stray logs and `test-results/`; resolve the `wrangler.jsonc` diff.
8. Update the R&D documents per §4.7, and write `docs/development/database.md` for native Postgres.

**Done when:** All Critical/High security items closed; CI green; a manual check that a packaged desktop build can reach the backend.

### Phase 1 — Finish the local product

> **Goal:** Every screen shows real, locally stored data; the Basic and Advanced tiers stand on their own offline. · **Size:** L

1. Local schema v2 (`packages/database`): add `memory_items`, `document_versions`, `version`/`content_hash` columns, a `tags` table (or index), and an `outbox` table for sync. Migrate Dexie and SQLite together with tests.
2. Noto Memory: real repository + `use-memory` hook; capture from Quick Note, Smart Sidebar and links; delete `mock/memory.ts`.
3. Version history: snapshot on save/idle into `document_versions`; preview, compare (text diff) and restore; delete `mock/versions.ts`.
4. Move crash recovery and quick-note drafts from localStorage into the database.
5. Folders tree in the sidebar (drag to move, nest), tag add/remove in the context panel.
6. Tab controls: pin, duplicate, move, reopen closed tab — as commands in `core/commands.ts`.
7. Local full-text search index; virtualise all long lists.
8. Export to PDF (print-to-PDF on desktop, browser print on web) and DOCX; richer HTML import that keeps formatting (sanitised through the TipTap schema).
9. Split the oversized files listed in §4.5 while touching them.

**Done when:** No imports from `packages/ui/src/mock/` remain except templates; e2e covers Memory, versions, folders, tags and search.

### Phase 2 — Backend foundation (Node plan phases 0–1)

> **Goal:** A running `apps/api` that owns identity end-to-end on plain PostgreSQL. · **Size:** L

1. Create `apps/api`: Hono app, env validation (Zod), `db/pool.ts` as the only `pg` import, Kysely, middleware chain, `/healthz`.
2. Migration runner with plain `.sql`; port the 7 Supabase migrations, replacing `auth.users`, `auth.uid()` and Supabase roles with `users` and a session-driven RLS helper (plan §3).
3. Identity tables `users`, `sessions`, `email_tokens`; argon2id hashing; 15-minute JWT access tokens; rotating refresh tokens with reuse detection.
4. Implement `PostgresAuthAdapter` and friends behind the existing ports — `AuthService`/`AccountService` stay unchanged.
5. `auth` (11 routes) and `account` (12 routes) controllers; Resend emails for verification, reset and new-device alerts; Turnstile moved to `shared/`.
6. Scheduled jobs with `node-cron`: sweep `auth_attempts`, expire tokens, trim `auth_events` to 180 days.
7. Integration tests against the native Postgres 18 instance, including authorization tests per table; add a Postgres service to CI.
8. Choose and provision a host (see §7, decision D1), a staging database and a staging API URL.

**Done when:** Sign-up, verify, sign-in, refresh, reset, device list/revoke and settings all work against staging with tests.

### Phase 3 — Cutover from Supabase (Node plan phase 2)

> **Goal:** One backend. Supabase removed. · **Size:** M

1. Replace `packages/sync/src/supabase/` with `packages/sync/src/api/`: `createApiClient()` — a `fetch` wrapper that attaches the access token and refreshes on 401.
2. Swap web and desktop `platform/cloud.ts`, `cloud-config.ts`, `use-*-account.ts`; config switches to `VITE_NOTO_API_URL` / `NOTO_API_URL`.
3. Desktop sign-up in-app (the API can accept an alternative bot check for authenticated desktop builds, or keep the web hand-off deliberately).
4. Replace mock account data: real devices, sessions and security log on the Account screen.
5. Plan a one-time user migration (export GoTrue users; require password reset if hashes cannot be carried over) and communicate it.
6. Release as its own version with no schema change in the same release; then delete `supabase/`, `@supabase/supabase-js` and the `db:*` scripts (Node plan appendix).

**Done when:** Production sign-in runs on `apps/api`; no Supabase import remains in the repository.

### Phase 4 — Sync (Node plan phase 3)

> **Goal:** My notes on my other device — the core Pro promise. · **Size:** L

1. Server: `workspaces`, `workspace_members`, `folders`, `documents`, `files` (metadata), `memory_items`, `change_log` with triggers, `sync_state`.
2. `sync` controller: `push`, `pull` (cursor on `change_log`), `claim` for adopting local workspaces on first sign-in.
3. Client engine in `@noto/sync`: persisted outbox, push/pull loop with backoff, online/offline detection per platform, status in the sidebar.
4. Conflict rule: last-writer-wins per entity using `version`; on a document body conflict keep both (save the loser as a version and notify).
5. Handle the multi-workspace/multi-device claim case (Backend_Plan open question 5).
6. Wire the Settings sync toggle to the real engine; show Synced / Syncing / Offline / Error per the Design System §25.
7. Tests: two simulated devices against a real API in CI; offline edits then reconnect.

**Done when:** Edit on web, see it on desktop within seconds; offline edits merge without data loss in the automated two-device test.

### Phase 5 — Mobile parity

> **Goal:** Mobile is a full Noto client on Android and iOS. · **Size:** L

1. Provide `AccountContext` in `apps/mobile-webview` via a bridge channel; store tokens in `expo-secure-store`, not WebView localStorage.
2. Run the sync engine on mobile against expo-sqlite.
3. iOS: bundle the web build into the iOS app (copy plugin for iOS, `file://` path per platform), sign, and ship to TestFlight.
4. Native share-in (“Share to Noto” → Memory), deep links for email verification/reset, Quick Note app shortcut/widget, biometric lock option.
5. Publish Android to Google Play (upload keystore, Play Console, internal → production track) and iOS to the App Store.
6. Add a Maestro/Detox smoke test in `mobile.yml`.

**Done when:** Signed builds in both stores; sign-in and sync work on a phone.

### Phase 6 — Desktop power features

> **Goal:** Deliver the desktop-first promise of PRD §2.1. · **Size:** M–L

1. Native application menu wired to command ids; OS file associations for .md/.txt; `noto://` protocol handler.
2. Clipboard history (opt-in watcher in main process, stored as Memory, with exclusions and a size cap).
3. Screenshot and region capture (`desktopCapturer`) into Memory / current document.
4. PIP / Companion window, native notifications.
5. Replace the SQL IPC with typed repository calls in the main process (final fix for S2).
6. Static update feed (R2) for beta and nightly channels.

**Done when:** All PRD §6 desktop items marked Done in §3.2.

### Phase 7 — Paid product (Node plan phase 4)

> **Goal:** Basic / Pro / Pro Max become real and billable. · **Size:** L

1. Files: R2 signed upload/download, move base64 images out of documents, per-plan storage quotas.
2. Server search: Postgres `tsvector` full-text for synced content.
3. Billing: Stripe (or Razorpay for India) checkout + webhooks, `subscriptions`, `plan_limits`, `usage_counters`, `entitlements` view.
4. Plans screen and Account read live entitlements; enforce limits in controllers.
5. Hosted version history with plan-based retention (90 days Pro, unlimited Pro Max).

**Done when:** A test user can upgrade, is charged, and gains Pro limits across all platforms.

### Phase 8 — AI

> **Goal:** Turn Memory into an intelligent personal information system (PRD Phase 7). · **Size:** L

1. Decide provider (decision D4); build the `ai` proxy controller with per-plan quotas and no keys on clients.
2. AI Assistant panel: summarise, rewrite, continue, ask-about-this-document.
3. Embeddings in pgvector for documents and Memory; semantic Memory search and AI Search.
4. Smart Paste and AI Organization (suggested tags/folders).

**Done when:** AI panel works for Pro users with quota enforcement and an opt-out in Privacy settings.

### Phase 9 — Collaboration (Node plan phase 5)

> **Goal:** Pro Max features. · **Size:** L

1. Share links (read-only / edit) and workspace members.
2. Realtime presence and live co-editing (Yjs on document bodies).
3. OAuth (Google, Apple, GitHub) with PKCE and deep-link callbacks; TOTP MFA.

**Done when:** Two accounts can co-edit a shared document in real time.

### Continuous track (every phase)

- **Testing:** raise coverage per §4.6; every bug fix gets a test; e2e runs on every PR once it is under ~5 minutes.
- **Performance:** bundle budget in CI, virtualised lists, Lighthouse check on the web app.
- **Observability:** error tracking (e.g. Sentry) for web, desktop and mobile; structured logs and uptime checks for `apps/api`.
- **Release:** buy code-signing certificates and set `NOTO_RELEASE_SIGN`; enable branch protection; move GitHub, Cloudflare and store accounts to an organisation; custom domain (`noto.app`).
- **Privacy & legal:** privacy policy, terms, data export and account deletion (required by app stores and GDPR).

## 6. Release and infrastructure checklist

| Item | Status | Needed |
| --- | --- | --- |
| Windows code signing | ❌ Missing | Certificate (OV/EV or Azure Trusted Signing) + `NOTO_RELEASE_SIGN=true` |
| macOS signing + notarisation | ❌ Missing | Apple Developer Program; without it Gatekeeper blocks and auto-update fails |
| Beta / nightly update feed | ❌ Missing | Static feed on R2, `NOTO_UPDATE_FEED_URL` |
| Linux updates | 🟡 Partial | AppImage manual; optional apt/rpm repository later |
| Google Play | ❌ Missing | Play Console account, upload keystore, listing, privacy policy |
| iOS TestFlight / App Store | ❌ Missing | Apple Developer Program + Phase 5 iOS work |
| Custom domain | ❌ Missing | Move web app and API off `*.workers.dev` |
| Branch protection | ❌ Missing | Require CI on `main` and `dev` |
| Organisation accounts | ❌ Missing | GitHub org, shared Cloudflare account — not personal accounts |
| Error tracking / analytics | ❌ Missing | Privacy-respecting, opt-in |
| Backups for Postgres | ❌ Missing | Host point-in-time recovery + a tested restore |

## 7. Open decisions

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Where does `apps/api` run, given “no Docker”? | A host that runs Node without containers (e.g. Render/Railway native Node builds, or a small VM with systemd). Keep `pool.ts` isolated so Workers + Hyperdrive stays possible. |
| D2 | Database region (GDPR vs latency). | Choose before provisioning production; hard to reverse. |
| D3 | Sync conflict model for document bodies. | Last-writer-wins + keep loser as a version now; Yjs only in Phase 9. |
| D4 | AI provider and model tiering. | Provider-independent proxy; decide before Phase 8. |
| D5 | Payment provider. | Stripe globally, or Razorpay if the first market is India. |
| D6 | iOS strategy. | Keep the WebView approach for parity; revisit native screens only for Quick Note/widgets. |
| D7 | Existing Supabase users at cutover. | Forced password reset is simplest and safest. |
| D8 | Memory on Basic: uncapped local clipboard history? | Cap by count and age with a setting. |



**Appendix — key files referenced**

- Security: `packages/backend/src/supabase/adapters.ts`, `supabase/functions/auth-signin/index.ts`, `apps/desktop/src/main/{preload,ipc}.ts`, `apps/desktop/index.html`, `supabase/functions/_shared/http.ts`.
- Mocks: `packages/ui/src/mock/*`, `packages/ui/src/app/editor/ContextPanel.tsx`, `packages/ui/src/app/screens/{PlansScreen,AccountScreen,SettingsScreen}.tsx`.
- Sync & data: `packages/sync/src/*`, `packages/database/src/{types.ts,sqlite/schema.ts,web/dexie-database.ts}`.
- Plans: `R&D/PRD.md`, `R&D/Backend_Node_Plan.md`, `R&D/Build&Release.md`.
