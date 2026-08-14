# Noto

A local-first notes and document workspace for **Web**, **Desktop** and **Mobile**.

Noto keeps local storage as the primary working layer. The applications are fully usable
offline and without an account; cloud services are added progressively on top.

The setup implemented here follows [`R&D/Setup_and_Installation.md`](R&D/Setup_and_Installation.md).

---

## Requirements

| Tool           | Version            | Notes                                |
| -------------- | ------------------ | ------------------------------------ |
| Node.js        | 20.19+ (24 LTS ok) | Provides npm                         |
| pnpm           | 11+                | `npm install -g pnpm`                |
| Git            | any recent         |                                      |
| Android Studio | latest             | Only needed for local Android builds |

```bash
pnpm install
```

Project libraries (React, Vite, Electron, Tiptap, Tailwind, TypeScript, Turborepo, Expo)
are **never** installed globally — they are pinned by this repository and its lockfile.

---

## Repository layout

```text
Noto/
├── apps/
│   ├── web/        React + Vite + Tailwind, IndexedDB via Dexie
│   ├── desktop/    React + Electron (Forge), SQLite in the main process
│   └── mobile/     React Native + Expo Router, SQLite via expo-sqlite
│
├── packages/
│   ├── core/       Document/folder/workspace logic, commands, Zustand stores
│   ├── editor/     Tiptap + ProseMirror foundation
│   ├── database/   Storage contract + Dexie, SQLite and in-memory adapters
│   ├── sync/       Sync contract, change queue, Supabase client
│   ├── types/      Shared domain types
│   ├── ui/         Design system and the shared application shell
│   └── config/     Design tokens, constants, defaults
│
└── tooling/        Shared eslint / prettier / typescript configs
```

### How the platforms share code

```text
                     @noto/ui  (shell + design system)
                            │
        ┌───────────────────┴───────────────────┐
      WEB                 DESKTOP              MOBILE
   NotoDataContext     NotoDataContext      useNotoStore
        │                   │                   │
      Dexie              SQLite              SQLite
        └───────────────────┴───────────────────┘
                            │
                     @noto/database
                   (one storage contract)
```

Web and desktop render the **same** shell (`NotoApp`) and differ only in the data source
they provide through `NotoDataContext`. `packages/database` defines one storage contract
with three implementations, so the SQL and the query semantics are written once.

Shared packages are **internal packages**: they export TypeScript source and are compiled
by the consuming bundler (Vite or Metro). There is no build step for `packages/*`.

---

## Commands

Run from the repository root:

| Command            | What it does                              |
| ------------------ | ----------------------------------------- |
| `pnpm dev:web`     | Web dev server on <http://localhost:5173> |
| `pnpm dev:desktop` | Electron app with hot reload              |
| `pnpm dev:mobile`  | Expo dev server                           |
| `pnpm build`       | Production build (web)                    |
| `pnpm lint`        | ESLint across every package               |
| `pnpm typecheck`   | `tsc --noEmit` across every package       |
| `pnpm test`        | Vitest unit tests                         |
| `pnpm test:e2e`    | Playwright end-to-end tests (web)         |
| `pnpm format`      | Prettier write                            |

Playwright needs its browser once: `pnpm --filter @noto/web exec playwright install chromium`.

---

## Toolchain version notes

A few versions are pinned deliberately rather than tracking latest. Each is a real
constraint, not a preference:

- **TypeScript 6.0.3** (pinned in `pnpm-workspace.yaml` overrides) — Expo SDK 57 targets
  TypeScript 6, and it is also the newest major `typescript-eslint` supports (its peer
  range is `<6.1`). TypeScript 7 breaks both.
- **ESLint 9.39.5** — `eslint-plugin-react` does not yet support ESLint 10.
- **React Native 0.86.2** — the version Expo SDK 57 is built against. RN 0.87 breaks Metro
  (`@expo/metro-config` looks for `react-native/rn-get-polyfills`, removed in 0.87) and its
  Flow-generated types are incompatible with Expo's `react-native-web` type augmentation.
- **`nodeLinker: hoisted`** — Electron Forge, React Native and Metro all resolve modules by
  walking `node_modules` directories and do not reliably understand pnpm's default
  symlinked layout.

Revisit the TypeScript and ESLint pins once the lint plugins catch up.

---

## Known issue: desktop packaging

`pnpm --filter @noto/desktop package` (and `make`) currently does not produce an
application bundle. Electron Forge 7.11.2 pins `@electron/packager` 18.4.4, which exits
silently with status 0 while extracting the Electron archive on Node 24.17 — no `out/`
directory is created and no error is reported. Calling `@electron/packager` directly
reproduces it, so this is upstream rather than a configuration problem. Overriding to
`@electron/packager` 20.x is not a fix: its API is incompatible with Forge 7.11
(`TypeError: done is not a function`).

Because of this, `@noto/desktop` intentionally has **no `build` script**, so `pnpm build`
does not report success for output that was never produced. Developing and running the
desktop app (`pnpm dev:desktop`) is unaffected.

Likely resolutions: run packaging on Node 22, or wait for Forge to bump its packager
dependency.

---

## Current state

The foundation is in place and verified end to end:

- Web, desktop and mobile applications all start and share the same core, editor,
  storage and design-token packages.
- Documents persist locally — IndexedDB on web, SQLite on desktop and mobile.
- 50 unit tests, 3 Playwright end-to-end tests, lint and typecheck all pass.

Following the development rule in the specification, features are built only after the
foundation is stable. Yjs, collaboration and cloud sync are deliberately **not** wired in
yet; `packages/sync` ships the contract and a local-only engine so enabling the cloud
later is an engine swap rather than a rewrite.
