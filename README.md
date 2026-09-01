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
│   ├── website/    Public site: downloads, docs index, changelog (static)
│   ├── web/        React + Vite + Tailwind, IndexedDB via Dexie
│   ├── desktop/    React + Electron (Forge), SQLite in the main process
│   ├── mobile/     Expo shell: a WebView, the SQLite connection, print, share
│   └── mobile-webview/  The interface that shell runs — @noto/ui, built by Vite
│
├── packages/
│   ├── core/       Document/folder/workspace logic, commands, Zustand stores
│   ├── editor/     Tiptap + ProseMirror foundation
│   ├── database/   Storage contract + Dexie, SQLite and in-memory adapters
│   ├── sync/       Sync contract, change queue, Supabase client
│   ├── types/      Shared domain types
│   ├── ui/         Design system and the shared application shell
│   └── config/     Design tokens, constants, defaults, release metadata
│
├── tooling/        Shared eslint / prettier / typescript configs
├── scripts/        Release automation (version, artifacts, notes)
├── docs/           Architecture, development, releases, deployment
└── .github/        Workflows, issue and pull request templates
```

The website is a separate application from the web app on purpose: it is a public
marketing and download site and has no business shipping the editor, the store or the
storage layer to a visitor who only wants a download link. It shares the design tokens.

### How the platforms share code

```text
                     @noto/ui  (shell + design system)
                            │
        ┌───────────────────┼───────────────────┐
      WEB                 DESKTOP             MOBILE
   NotoDataContext     NotoDataContext     NotoDataContext
        │                   │                   │
      Dexie           SQLite over IPC    SQLite over a
        │             (main process)     WebView bridge
        └───────────────────┴───────────────────┘
                            │
                     @noto/database
                   (one storage contract)
```

All three platforms render the **same** shell (`NotoApp`) and differ only in the data
source they provide through `NotoDataContext`. `packages/database` defines one storage
contract with three implementations, so the SQL and the query semantics are written once.

The desktop adds one thing the shell alone cannot provide: the **Quick Note dock**, a
second always-on-top window holding a tab on the edge of the display. It renders the same
`@noto/ui` handle and panel from the same bundle, loaded at `#/dock`, and it stays there
after the application window is minimised or closed — closing that window hides it to the
tray rather than quitting. Quick Note and Quick Paste are registered as global
accelerators and arrive back in the shell as command ids, so a key pressed in another
application runs the same code the command palette runs. See
[docs/architecture/overview.md](docs/architecture/overview.md#the-desktop-shell).

Android reaches that shell through a WebView. Tiptap and ProseMirror need a DOM, so a
native React Native editor would have had to be a second, smaller Noto kept in step by
hand — and the leading React Native rich-text editors are themselves Tiptap in a WebView.
Instead the Expo application packages the `@noto/ui` build into the APK and supplies its
data across a `postMessage` bridge to the native SQLite connection, which is the same
arrangement Electron uses over IPC. Tabs, find and replace, history, formatting and every
screen are therefore not ported to Android; they are the same code running there.

Shared packages are **internal packages**: they export TypeScript source and are compiled
by the consuming bundler (Vite or Metro). There is no build step for `packages/*`.

---

## Commands

Run from the repository root:

| Command                                  | What it does                                  |
| ---------------------------------------- | --------------------------------------------- |
| `pnpm dev:web`                           | Web dev server on <http://localhost:5173>     |
| `pnpm dev:website`                       | Website dev server on <http://localhost:5174> |
| `pnpm dev:desktop`                       | Electron app with hot reload                  |
| `pnpm dev:mobile`                        | Expo dev server                               |
| `pnpm dev --filter=@noto/mobile-webview` | The Android interface, in a browser           |
| `pnpm build`                             | Production build (web + website)              |
| `pnpm lint`                              | ESLint across every package                   |
| `pnpm typecheck`                         | `tsc --noEmit` across every package           |
| `pnpm test`                              | Vitest unit tests                             |
| `pnpm test:e2e`                          | Playwright end-to-end tests (web)             |
| `pnpm format`                            | Prettier write                                |
| `pnpm release:desktop`                   | Windows: environment-aware release build      |
| `pnpm package:desktop`                   | macOS/Linux: package for this platform        |
| `pnpm release:prepare 1.0.0`             | Set the version and stub the release notes    |

Playwright needs its browser once: `pnpm --filter @noto/web exec playwright install chromium`.

---

## Build and release

### Prerequisites

| Tool       | Version  | Why                                                                                             |
| ---------- | -------- | ----------------------------------------------------------------------------------------------- |
| Node       | **22.x** | Packaging only. Forge 7.11 pins a packager that fails silently on Node 24 — see the note below. |
| pnpm       | 11.x     | `corepack enable`                                                                               |
| fnm        | any      | Lets the release script reach Node 22 without changing your default Node                        |
| PowerShell | 5.1+     | Elevated preferred, not required                                                                |

Install fnm and Node 22 once:

```powershell
winget install --id Schniz.fnm -e
fnm install 22
```

You do not need to switch to Node 22 yourself. The release script finds it through fnm
and uses it for the build only.

### Building a release locally (Windows)

```powershell
pnpm release:desktop
```

`pnpm release:desktop` is a thin wrapper around `.\noto-release.ps1`. PowerShell does not
run scripts from the current directory without the `.\` prefix — the wrapper exists so
that is one less thing to remember.

With no `-Environment`, an interactive session shows a numbered menu built by globbing
`apps\desktop\environments`. Each option is printed with its update feed URL, because
that — not the label — is what actually differs between two packages of the same version.
A **non-interactive** session with no `-Environment` fails rather than guessing: a package
aimed at the wrong update feed is not something you can tell from its file name.

| Invocation                                                       | What it does                                    |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| `pnpm release:desktop`                                           | Prompts for the environment, builds everything  |
| `pnpm release:desktop -- -Environment Staging -SkipWeb`          | Staging package, skips the web bundles          |
| `pnpm release:desktop -- -Environment Production -Version 1.0.0` | Stamps 1.0.0 everywhere, then builds Production |
| `pnpm release:desktop -- -Environment Staging -Channel nightly`  | Overrides the overlay's default channel         |
| `pnpm release:desktop -- -Arch arm64`                            | ARM64 slice (installer only, no update feed)    |

`-SkipVerify` skips lint/typecheck/tests. `-Configuration Debug` is allowed for every
environment except Production. Building Production always prints the configuration about
to be baked in and requires you to type `yes`; `-AssumeYes` supplies that for an
automated run.

Run it elevated where you can — administrator is not required, but it lets the script add
a Defender exclusion for the output folder, which is what stops Squirrel's `rcedit` step
failing intermittently while Defender scans the freshly written binaries.

### Environment overlays

The environment set is whatever is in `apps\desktop\environments`. Nothing enumerates it
in code, so adding a file adds an environment — to the menu, to the `bake-environment.mjs`
validation and to the CI input check at once.

| File                    | Update feed             | Default channel | For                                |
| ----------------------- | ----------------------- | --------------- | ---------------------------------- |
| `noto.Production.json`  | `update.electronjs.org` | `stable`        | Public releases                    |
| `noto.Staging.json`     | none yet                | `beta`          | Pre-release verification           |
| `noto.Development.json` | none                    | `nightly`       | Local builds against a dev web app |

Each file carries `environment`, `description`, `buildEnv`, `defaultChannel`,
`updateFeedUrl` and `webAppUrl`. All six are required, and a missing one aborts the build
by name.

`updateFeedUrl` may be empty. `stable` does not need one — it resolves through
`update.electronjs.org` — but `beta` and `nightly` do, and a build on those channels
without one warns loudly that the package will never update itself.

The chosen values are written into `apps\desktop\src\generated\environment.ts` by
[`scripts/bake-environment.mjs`](scripts/bake-environment.mjs), which both the local
script and CI call. That file is **committed**, carrying the Development defaults, so a
fresh clone typechecks; a release rewrites it and restores it when the build ends.

It is a generated module rather than an environment variable because `process.env`
describes the machine that ran the build, not the artifact it produced — a packaged app
started from the Start menu inherits none of it.

### What a release folder holds

Artifacts are keyed by environment **and** channel as well as version, because the same
version built for two environments is two different packages:

```text
build\<Environment>\<Channel>\<Version>\
├── Noto-<version>-win-x64.exe     the installer
├── Noto-<version>-win-x64.zip     the same installer, zipped
├── noto-<version>-full.nupkg      Squirrel update payload
├── RELEASES                       Squirrel update manifest
├── download.html                  from scripts/templates/download.html
├── _headers                       static headers for the download host
└── SHA256SUMS.txt
```

The same contents are mirrored to `build\<Environment>\<Channel>\Latest\`, wiped first, so
an upload step never has to know the version number.

### What the build refuses to publish

Each of these aborts the run and prints what was expected, what was found, and what to do
about it:

- **A package that was never built.** `@electron/packager` can exit 0 having produced
  nothing, so the script looks for the application binary itself rather than trusting the
  exit code. This is the failure that ships an installer which installs cleanly and then
  does not launch.
- **An installer under the wrong name.** Looked up as `Noto-<version>-win-<arch>.exe`
  exactly, never as `*.exe` — a wildcard returns entries in directory order and would
  happily publish an earlier build under this version's release notes.
- **A missing or disagreeing `RELEASES`.** Its SHA1 is recomputed the way Squirrel does it
  and compared against the `.nupkg` beside it, along with the size and the version.
  Nothing else in the pipeline reads that file, so a mismatch would otherwise surface
  months later as "nobody is upgrading", with no error anywhere.
- **Stale artifacts.** Everything collected must be newer than the timestamp taken before
  the build started.
- **An incomplete folder.** The `[OK]`/`[MISSING]` checklist is a gate, not a report.

### Hand-off

The release folder is **not** committed. A 133 MB installer exceeds GitHub's 100 MB file
limit, which is why `build/` is ignored. Publishing goes through the tag-driven pipeline
instead:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

`release.yml` then builds macOS and Linux on their own runners — neither can be produced
from Windows — bakes the **Production** overlay with the channel derived from the tag
itself (`v1.1.0-beta.1` is a beta), and publishes every platform to the GitHub Release.

`desktop.yml` also runs on pushes that touch `apps/desktop/**`, building a single Windows
slice as a smoke test of the packaging path. Its `environment` input must name a file in
`apps\desktop\environments`; a value that has drifted from the overlays fails at the start
of the run.

### Releasing

Noto releases from one tag:

```bash
git checkout main && git pull
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions then verifies, packages Windows, macOS and Linux, and publishes a GitHub
Release with checksums and generated notes. Windows and macOS installations update
themselves from that release.

The website and web application deploy separately: both are Cloudflare Workers projects
connected to this repository, so Cloudflare builds and deploys them on every push to
`main`. No Cloudflare credentials live in GitHub.

| Document                                                                                 | Covers                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| [docs/releases/](docs/releases/README.md)                                                | Versioning, tagging, what the pipeline does |
| [docs/releases/update-channels.md](docs/releases/update-channels.md)                     | Auto-update, stable / beta / nightly        |
| [docs/development/continuous-integration.md](docs/development/continuous-integration.md) | What runs when                              |
| [docs/development/branching.md](docs/development/branching.md)                           | Branch model and protection                 |
| [docs/deployment/website.md](docs/deployment/website.md)                                 | Cloudflare Workers, staging and production  |
| [docs/deployment/code-signing.md](docs/deployment/code-signing.md)                       | Windows and Apple signing                   |
| [docs/deployment/secrets.md](docs/deployment/secrets.md)                                 | Every secret and what it unlocks            |

The plan this implements is [`R&D/Build&Release.md`](R&D/Build&Release.md). That document
specifies Angular and Capacitor; this repository uses React + Vite, Electron Forge and
Expo instead. The release architecture is implemented as written — only the UI framework
differs.

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

**In CI this is worked around by pinning the desktop packaging job to Node 22**
(`.github/workflows/desktop.yml`). Locally, `pnpm package:desktop` needs Node 22 for the
same reason. Remove the pin once Forge bumps its packager dependency.

---

## Current state

The foundation is in place and verified end to end:

- Web, desktop and mobile applications all start and render the same shell, editor
  and design system; mobile runs it in a WebView over a native SQLite connection.
- Documents persist locally — IndexedDB on web, SQLite on desktop and mobile.
- 118 unit tests, 39 Playwright end-to-end tests, lint and typecheck all pass.
- The public website builds, with a download page that resolves the latest release from
  GitHub at runtime.
- The build and release pipeline is in place: CI on every pull request, Cloudflare Workers
  deployments from `dev` and `main`, tag-driven desktop packaging, and GitHub Releases
  with checksums and generated notes.

No version has been released yet, so the download page correctly says so rather than
linking at installers that do not exist.

Following the development rule in the specification, features are built only after the
foundation is stable. Yjs, collaboration and cloud sync are deliberately **not** wired in
yet; `packages/sync` ships the contract and a local-only engine so enabling the cloud
later is an engine swap rather than a rewrite.
