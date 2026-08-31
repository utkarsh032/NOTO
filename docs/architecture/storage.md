# Storage

Every platform stores documents locally, and every platform does it differently.
`@noto/database` exists so the applications do not have to care which.

```text
                    @noto/database
                          │
              the storage contract (types.ts)
                          │
      ┌───────────────┬───┴───────────┬────────────────┐
      ▼               ▼               ▼                ▼
   memory          web/            sqlite/          (future)
  in-process      Dexie            driver +
   (tests)      IndexedDB          schema
      │               │               │
      ▼               ▼               ▼
   vitest         browser      desktop main process
                              and mobile (expo-sqlite)
                              — both reached across
                                a process boundary
```

| Adapter | Entry point             | Used by                       |
| ------- | ----------------------- | ----------------------------- |
| Memory  | `@noto/database`        | Unit tests                    |
| Dexie   | `@noto/database/web`    | `apps/web`                    |
| SQLite  | `@noto/database/sqlite` | `apps/desktop`, `apps/mobile` |

The in-memory adapter is not a stub. It implements the same contract and is what
`packages/database/src/memory.test.ts` exercises, so the contract is tested
without a browser or a filesystem.

## Desktop: SQLite across the process boundary

The Electron renderer runs untrusted document content, so it is sandboxed with
context isolation on and no Node integration. It therefore cannot open a
database file itself.

```text
Renderer                    Preload                Main process
────────                    ───────                ────────────
@noto/database  ──SQL──▶  contextBridge  ──IPC──▶  better-sqlite3
  (ipc driver)             (one channel)            userData/noto.db
```

The renderer talks to a SQL driver that forwards statements over a single IPC
channel. That is the only route from document content to storage, and it is why
`sandbox: true` can stay on.

## Mobile: SQLite across the WebView bridge

Android runs the shared interface inside a WebView, which has no durable storage
worth trusting a document to — a `file://` page gets an opaque origin, and
IndexedDB is unavailable to it. The database therefore stays where it already
was, on the native side, and the interface reaches it the same way Electron's
renderer does.

```text
WebView                                    Native (Expo)
───────                                    ─────────────
@noto/database  ──SQL──▶  postMessage  ──▶  expo-sqlite
 (bridge driver)         (one channel)       noto.db
                ◀──rows──  injectJavaScript
```

Only `execute` and `select` cross. Transactions are driven from the WebView with
plain `BEGIN`/`COMMIT` statements, which is safe because there is one connection
and messages arrive in order — exactly the reasoning behind the desktop driver.

This is also why the move to a WebView interface did not strand anyone: it is
the same database file, opened by the same `@noto/database` schema, so notes
written by the older native screens open unchanged.

## Web: IndexedDB

`apps/web` uses Dexie over IndexedDB. This keeps working offline once the
application has loaded, but it lives in browser-managed storage: clearing site
data deletes it, and private browsing modes often restrict it. The website's FAQ
says so plainly, because a user who loses documents to a cleared cache was not
warned well enough.

## Schema version

`DATABASE_VERSION` in `@noto/config` is the schema version, shared by every
platform. Bump it when a migration is added, on every platform at once, so the
stores never drift apart.

## Where the data actually is

| Platform | Location                                        |
| -------- | ----------------------------------------------- |
| Windows  | `%APPDATA%\Noto\`                               |
| macOS    | `~/Library/Application Support/Noto/`           |
| Linux    | `~/.config/Noto/`                               |
| Web      | Browser IndexedDB, keyed to the site's origin   |
| Mobile   | The application's private storage on the device |

The desktop paths come from Electron's `app.getPath('userData')`.

## Backing up

There is no backup feature yet. On desktop, copying the user-data directory
while Noto is closed is a complete backup. That is a consequence of local-first
storage rather than a substitute for the feature.
