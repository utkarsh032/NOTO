# Getting started

## Prerequisites

| Tool           | Version            | Needed for                         |
| -------------- | ------------------ | ---------------------------------- |
| Node.js        | 20.19+ (24 LTS ok) | Everything                         |
| pnpm           | 11+                | Everything (`npm install -g pnpm`) |
| Git            | any recent         | Everything                         |
| Android Studio | latest             | Local Android builds only          |
| Xcode          | latest             | Local iOS builds only (macOS)      |

Project libraries are never installed globally — they are pinned by this
repository and its lockfile.

```bash
git clone https://github.com/utkarsh032/NOTO.git
cd NOTO
pnpm install
```

## Running an application

```bash
pnpm dev:web        # http://localhost:5173
pnpm dev:website    # http://localhost:5174
pnpm dev:desktop    # Electron window
pnpm dev:mobile     # Expo
```

The web application and the website run on different ports on purpose: the
website's download links point at the web application, and checking they work
means running both.

## Before you push

CI runs these four, in this order. Running them locally first is quicker than
waiting for a red build:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm format` fixes formatting; CI checks it with `pnpm format:check`.

## Packaging the desktop application locally

```bash
pnpm package:desktop
```

This produces packages for the platform you are on, in
`apps/desktop/out/make/`. Cross-platform packaging is the release pipeline's
job — Windows installers need Windows, and macOS signing needs macOS.

Local packages are unsigned. That is deliberate: development should never need
production certificates. See [code signing](../deployment/code-signing.md).

## Repository layout

```text
Noto/
├── apps/
│   ├── website/    The public site: downloads, docs index, changelog
│   ├── web/        The web application
│   ├── desktop/    Electron
│   └── mobile/     Expo / React Native
│
├── packages/       Shared: core, editor, database, sync, ui, types, config
├── tooling/        Shared eslint / prettier / typescript configs
├── scripts/        Release automation (version, artifacts, notes)
├── docs/           This documentation
└── .github/        Workflows, issue and pull request templates
```

## A note on the plan document

[`R&D/Build&Release.md`](../../R&D/Build&Release.md) specifies Angular and
Capacitor. The repository is built with **React + Vite**, **Electron Forge** and
**Expo / React Native** instead. The release architecture in that document —
GitHub Actions, tag-driven releases, GitHub Releases, Cloudflare Pages,
Electron's update service — is implemented as written; only the UI framework
differs.
