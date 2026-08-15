# Architecture overview

Noto is one product with four applications. The applications are thin; almost
everything that matters lives in the shared packages.

```text
                        @noto/ui  (design system + application shell)
                              │
      ┌───────────────┬───────┴───────┬────────────────┐
      ▼               ▼               ▼                ▼
   website           web           desktop          mobile
   (static)      React + Vite    React + Electron   React Native
      │               │               │                │
      │               ▼               ▼                ▼
      │           IndexedDB        SQLite            SQLite
      │            (Dexie)      (main process)    (expo-sqlite)
      ▼
  @noto/config  (tokens, constants, release metadata)
```

## The applications

| App            | Stack                      | Local storage          |
| -------------- | -------------------------- | ---------------------- |
| `apps/website` | React + Vite (static)      | none                   |
| `apps/web`     | React + Vite               | IndexedDB via Dexie    |
| `apps/desktop` | React + Electron Forge     | SQLite, main process   |
| `apps/mobile`  | React Native + Expo Router | SQLite via expo-sqlite |

The website is a separate application from the web app on purpose. It is a
public marketing and download site: it must load fast for someone who has never
heard of Noto, and it has no business shipping the editor, the store or the
storage layer to that visitor. It shares the design _tokens_, which is where the
visual consistency comes from.

## The packages

| Package          | Responsibility                                              |
| ---------------- | ----------------------------------------------------------- |
| `@noto/types`    | Shared domain types. Depends on nothing.                    |
| `@noto/config`   | Design tokens, application constants, release metadata      |
| `@noto/core`     | Document, folder and workspace logic; commands; stores      |
| `@noto/editor`   | Tiptap / ProseMirror editor foundation                      |
| `@noto/database` | Storage contract, plus Dexie, SQLite and in-memory adapters |
| `@noto/sync`     | Sync contract, change queue, Supabase client                |
| `@noto/ui`       | Design system and the shared application shell              |

Packages are consumed as TypeScript source through workspace links rather than
being built to `dist` first. That is why each Vite config excludes them from
dependency pre-bundling: a pre-bundled copy would freeze and stop hot-reloading
when a package changes.

## Release-facing configuration

`@noto/config` also owns everything the applications need to know about how Noto
is released — the repository, the release asset naming, the update channels and
the system requirements. That is what keeps the website's download page in step
with what the pipeline actually publishes: both derive their file names from
`assetFileName()`.

The one place that must be kept in step by hand is
`scripts/collect-desktop-artifacts.mjs`, which names the files during a release.
It is a Node script outside the TypeScript build, so it cannot import the
package; both sides carry a comment pointing at the other.

## Local-first

The copy on the device is the document. Everything else is built on top:

```text
Noto
 │
 ├── Local storage          always present, always authoritative
 │
 └── Optional cloud         off unless the user turns it on
        ├── Authentication
        ├── API
        ├── Database
        └── Object storage
```

No backend is required to write notes, edit documents, manage tabs, save
locally, or use either the desktop or the web application. A backend becomes
relevant only for cloud sync, accounts, cross-device synchronisation, backup and
collaboration — and even then it sits above local storage rather than beneath
it, so switching it off leaves a complete application rather than an empty one.

## Further reading

- [Storage](storage.md)
- [Cutting a release](../releases/README.md)
- [Continuous integration](../development/continuous-integration.md)
