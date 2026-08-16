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

On Windows, use the release script — it handles the Node version, the leftover
processes and the Defender lock that otherwise make this fail intermittently:

```powershell
.\noto-release.ps1                 # current version, x64
.\noto-release.ps1 -Version 1.0.0  # stamp a version first
.\noto-release.ps1 -Arch arm64
```

Run it from an elevated PowerShell where you can. Administrator is not required,
but it lets the script add a Defender exclusion for the output folder, which is
what stops Squirrel's `rcedit` step failing with "Unable to commit changes"
while Defender is still scanning the freshly written binaries.

The finished artifacts land in **`build/`**:

```text
build/
├── Noto-<version>-win-x64.exe     the installer
├── noto-<version>-full.nupkg      Squirrel update payload
├── RELEASES                       Squirrel update manifest
└── SHA256SUMS.txt
```

The unpacked application is left at `apps/desktop/out/Noto-win32-x64/noto.exe`
if you want to run it without installing.

On macOS and Linux, invoke Forge directly:

```bash
pnpm package:desktop
```

Either way you get packages for the platform you are on. Cross-platform
packaging is the release pipeline's job — Windows installers need Windows, and
macOS signing needs macOS.

Local packages are unsigned. That is deliberate: development should never need
production certificates. See [code signing](../deployment/code-signing.md).

### Node 22

Packaging needs Node 22. Electron Forge 7.11 pins `@electron/packager` 18.4.4,
which exits silently with status 0 on Node 24 while extracting the Electron
archive — no `out/` directory and no error. `noto-release.ps1` finds an
fnm-installed Node 22 automatically; if you have none:

```powershell
winget install --id Schniz.fnm -e
fnm install 22
```

This does not disturb the Node on your PATH. CI pins the same version in
`.github/workflows/desktop.yml`.

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
GitHub Actions, tag-driven releases, GitHub Releases, Cloudflare Workers,
Electron's update service — is implemented as written; only the UI framework
differs.
