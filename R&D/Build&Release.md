# NOTO — Build & Release Plan

**Project:** NOTO
**Purpose:** Define the complete development, build, packaging, release, hosting, download, update, and distribution architecture for NOTO across Web, Windows, macOS, Linux, Android, and iOS.

---

# 1. Release Architecture

NOTO will use a GitHub-centered CI/CD architecture.

```text
                              NOTO
                               │
                               ▼
                        GitHub Repository
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
                 Branches              Releases
                    │                     │
                    ▼                     ▼
              GitHub Actions       GitHub Releases
                    │                     │
          ┌─────────┼─────────┐          │
          │         │         │          │
          ▼         ▼         ▼          ▼
       Website   Desktop    Mobile    Installers
          │         │         │
          ▼         ▼         ▼
      Cloudflare  Electron  Capacitor
        Pages        │         │
                     │         │
          ┌──────────┼───┐     ├── Android
          │          │   │     └── iOS
          ▼          ▼   ▼
       Windows    macOS Linux
        .exe       .dmg  AppImage
```

The core principle is:

> **One repository → automated builds → platform-specific packages → controlled releases → public downloads → automatic updates.**

---

# 2. Product Distribution Channels

NOTO will eventually be available through the following channels.

| Platform | Distribution                        |
| -------- | ----------------------------------- |
| Web      | Direct browser access               |
| Windows  | `.exe` installer                    |
| macOS    | `.dmg` / `.zip`                     |
| Linux    | `.AppImage` / `.deb`                |
| Android  | Google Play Store / APK for testing |
| iOS      | Apple App Store / TestFlight        |
| Source   | GitHub repository                   |
| Releases | GitHub Releases                     |

The public website will act as the central entry point.

```text
                    NOTO Website
                         │
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
      Use Web         Download          Mobile
       │                 │                 │
       ▼                 ▼                 ▼
   Web App        Windows/macOS/Linux   Stores
```

---

# 3. Website

The NOTO website will be a dedicated application/site.

Recommended structure:

```text
apps/
├── website/
├── web/
├── desktop/
└── mobile/
```

### Website responsibilities

The website should contain:

```text
Home
Download
Features
Documentation
System Requirements
Changelog
Release Notes
FAQ
About
```

The website should NOT contain the desktop application itself.

Its job is to:

* explain NOTO
* provide platform information
* provide download links
* display the latest version
* display release notes
* display system requirements
* link to documentation
* direct users to the Web application
* direct mobile users to the stores

---

# 4. Web Application

The Web application will remain directly usable from a browser.

Example:

```text
https://noto.example.com
```

The user does not need to install anything.

Flow:

```text
Browser
   ↓
NOTO Web
   ↓
Angular Application
   ↓
Local Storage
```

The Web application should also support PWA capabilities where practical.

---

# 5. Repository Structure

The GitHub repository should follow the monorepo architecture.

```text
noto/
│
├── apps/
│   ├── website/
│   ├── web/
│   ├── desktop/
│   └── mobile/
│
├── packages/
│   ├── core/
│   ├── editor/
│   ├── storage/
│   ├── ui/
│   ├── types/
│   ├── utils/
│   └── config/
│
├── tooling/
│   ├── eslint/
│   ├── prettier/
│   └── tsconfig/
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── web.yml
│   │   ├── desktop.yml
│   │   ├── mobile.yml
│   │   └── release.yml
│   │
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
│
├── docs/
│   ├── architecture/
│   ├── development/
│   ├── releases/
│   └── deployment/
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── .gitignore
├── .npmrc
└── README.md
```

---

# 6. Branch Strategy

Use a simple branch model rather than creating too many branches.

```text
main
 │
 ├── production releases
 │
 └── stable code

develop
 │
 ├── integration
 │
 └── next release

feature/*
 │
 └── individual development

release/*
 │
 └── release preparation

hotfix/*
 │
 └── urgent production fixes
```

## Branch responsibilities

### `main`

Production-ready code.

Nothing should be merged directly without review/testing.

### `develop`

Integration branch for the next release.

Feature branches merge into `develop`.

### `feature/*`

Examples:

```text
feature/editor
feature/tabs
feature/find-replace
feature/clipboard-history
feature/file-system
```

### `release/*`

Used when preparing a release.

Example:

```text
release/0.5.0
```

### `hotfix/*`

Used for urgent production fixes.

Example:

```text
hotfix/0.5.1
```

---

# 7. Environments

NOTO will use three primary environments.

```text
Development
     ↓
Staging
     ↓
Production
```

## Development

Purpose:

* local development
* feature implementation
* debugging
* experimental work

Typical command:

```bash
pnpm dev
```

## Staging

Purpose:

* release candidate testing
* QA
* cross-platform testing
* previewing website changes
* testing installers

Example:

```text
staging.noto.example.com
```

## Production

Purpose:

* public users
* stable Web application
* official downloads
* official releases

Example:

```text
noto.example.com
```

---

# 8. Versioning

NOTO will use Semantic Versioning.

```text
MAJOR.MINOR.PATCH
```

Example:

```text
1.4.2
```

Meaning:

```text
1 → major release
4 → feature release
2 → bug-fix release
```

Examples:

```text
0.1.0
0.2.0
0.2.1
1.0.0
1.1.0
1.1.1
```

During early development:

```text
0.x.x
```

can be used.

The first stable public release becomes:

```text
1.0.0
```

---

# 9. Git Tags

Every production release must have a Git tag.

Example:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The tag becomes the trigger for the production release pipeline.

```text
v1.0.0
   ↓
GitHub Actions
   ↓
Build
   ↓
Test
   ↓
Package
   ↓
Release
```

Tags must be immutable from a release-management perspective.

Do not reuse an existing production version.

---

# 10. GitHub Actions

GitHub Actions will be the primary CI/CD system.

GitHub currently provides free GitHub Actions usage for public repositories on standard GitHub-hosted runners. For GitHub Free accounts, the documented private-repository allowance is 2,000 minutes/month, with 500 MB artifact storage and 10 GB cache storage.

Recommended workflows:

```text
.github/workflows/

ci.yml
web.yml
desktop.yml
mobile.yml
release.yml
```

---

# 11. Continuous Integration

Every pull request should trigger:

```text
Install dependencies
        ↓
Lint
        ↓
Typecheck
        ↓
Unit tests
        ↓
Build
```

Example conceptual flow:

```text
Pull Request
     ↓
GitHub Actions
     ↓
pnpm install
     ↓
pnpm lint
     ↓
pnpm typecheck
     ↓
pnpm test
     ↓
pnpm build
     ↓
PASS / FAIL
```

A pull request should not be merged if the required CI checks fail.

---

# 12. Angular Build

Angular applications will be built through the monorepo/Turbo pipeline.

Development:

```bash
pnpm dev:web
```

Production:

```bash
pnpm build
```

The final output should be deployable as static assets.

```text
dist/
├── index.html
├── assets/
├── *.js
└── *.css
```

The same principle applies to:

```text
apps/website
apps/web
```

---

# 13. Website Deployment

The recommended initial hosting strategy is:

```text
GitHub
   ↓
GitHub Actions
   ↓
Angular production build
   ↓
Cloudflare Pages
   ↓
Public Website
```

Initial cost:

```text
₹0
```

The website should be deployed automatically after successful production builds.

Example:

```text
main
 ↓
build website
 ↓
test
 ↓
deploy
 ↓
Production
```

A staging branch can deploy to a staging URL.

---

# 14. Desktop Build

Desktop NOTO will use:

```text
Angular
   +
Electron
```

Architecture:

```text
Angular Renderer
       │
       ▼
    Electron
       │
       ▼
Operating System
```

Electron packages the application into a distributable desktop application. Electron's distribution documentation recommends packaging, signing, publishing, and then configuring updates as separate release concerns.

---

# 15. Windows Installer

Primary target:

```text
Windows 10+
Windows 11+
```

Initial architecture:

```text
Angular
   ↓
Electron
   ↓
Windows packaging
   ↓
Noto Setup.exe
```

Example:

```text
Noto-1.0.0-win-x64.exe
```

Future architecture may also include:

```text
Noto-1.0.0-win-arm64.exe
```

The Windows installer should:

* install NOTO
* create Start Menu entry
* create desktop shortcut if selected
* register the application
* support upgrades
* support uninstall
* support automatic updates

---

# 16. macOS Package

Target:

```text
macOS
├── Apple Silicon
└── Intel
```

Packages:

```text
Noto-1.0.0-mac-arm64.dmg
Noto-1.0.0-mac-x64.dmg
```

macOS distribution requires code signing, and public distribution should also use Apple's notarization process. Electron's documentation notes that signing and notarization require Apple Developer enrollment and macOS/Xcode tooling.

Therefore:

```text
Build
 ↓
Sign
 ↓
Notarize
 ↓
Package
 ↓
Publish
```

---

# 17. Linux Package

Initial target:

```text
Linux x64
```

Primary package:

```text
Noto-1.0.0-linux-x64.AppImage
```

Possible additional package:

```text
Noto-1.0.0-linux-x64.deb
```

Linux automatic updating should not initially be treated the same way as Windows/macOS. Electron's built-in autoUpdater currently supports Windows and macOS, not Linux; Linux updates are generally better handled through the distribution/package mechanism.

---

# 18. Mobile Build

Mobile will use:

```text
Angular
   ↓
Capacitor
   ↓
Native Android/iOS project
```

## Android

Development/testing:

```text
APK
```

Production:

```text
AAB
```

Distribution:

```text
Google Play Store
```

## iOS

Development/testing:

```text
TestFlight
```

Production:

```text
App Store
```

Mobile releases should initially be treated as a later phase after Web/Desktop stability.

---

# 19. GitHub Releases

Every production release will create a GitHub Release.

Example:

```text
NOTO v1.0.0
```

Assets:

```text
Noto-1.0.0-win-x64.exe
Noto-1.0.0-win-arm64.exe

Noto-1.0.0-mac-arm64.dmg
Noto-1.0.0-mac-x64.dmg

Noto-1.0.0-linux-x64.AppImage
Noto-1.0.0-linux-x64.deb
```

GitHub Releases supports release assets and currently documents a maximum individual asset size of 2 GiB and up to 1,000 assets per release.

This makes GitHub Releases suitable for NOTO's initial desktop distribution.

---

# 20. Release Pipeline

The production pipeline should ultimately work like this:

```text
Developer
    │
    ▼
feature/*
    │
    ▼
Pull Request
    │
    ▼
CI
 ├── lint
 ├── typecheck
 ├── test
 └── build
    │
    ▼
develop
    │
    ▼
Staging
    │
    ▼
QA
    │
    ▼
release/1.0.0
    │
    ▼
main
    │
    ▼
git tag v1.0.0
    │
    ▼
GitHub Actions
    │
    ├───────────────┬───────────────┐
    ▼               ▼               ▼
  Web            Desktop          Mobile
    │               │               │
    ▼               ▼               ▼
Deploy          Package          Build
                   │
          ┌────────┼────────┐
          ▼        ▼        ▼
        Win      macOS     Linux
        .exe      .dmg    AppImage
                   │
                   ▼
             GitHub Release
```

---

# 21. Automated Release

The ideal release experience for the developer should eventually be:

```bash
git checkout main
git pull

git tag v1.0.0
git push origin v1.0.0
```

Then GitHub Actions handles:

```text
Build
 ↓
Test
 ↓
Package
 ↓
Sign
 ↓
Create release
 ↓
Upload assets
 ↓
Publish release
 ↓
Update website
```

The objective is:

> **One version tag should be enough to start the release process.**

---

# 22. Release Notes

Every production release should contain release notes.

Structure:

```text
# NOTO v1.0.0

## Highlights

- New editor
- File management
- Tabs
- Auto save

## Improvements

- Improved startup performance
- Improved editor responsiveness

## Bug Fixes

- Fixed tab restoration
- Fixed file saving issue

## Downloads

Windows
macOS
Linux

## System Requirements

See system requirements.
```

GitHub supports manually written release notes as well as automatically generated release notes, so the pipeline can eventually automate much of this process.

---

# 23. Download Page

The public download page should dynamically present the appropriate platform.

Example:

```text
Download NOTO

Latest Version
v1.0.0

Detected Platform:
Windows

[ Download for Windows ]

Other Platforms

Windows
  x64
  ARM64

macOS
  Apple Silicon
  Intel

Linux
  x64

Android
  Google Play

iOS
  App Store

Web
  Open NOTO
```

The download page should always point users toward the latest stable release.

---

# 24. System Requirements

The website must maintain a system requirements section.

Example:

## Windows

```text
OS: Windows 10 or later
Architecture: x64 / ARM64
RAM: 4 GB minimum
Storage: 500 MB+
Display: 1280 × 720 minimum
```

## macOS

```text
OS: Supported modern macOS version
Architecture: Apple Silicon / Intel
RAM: 4 GB minimum
Storage: 500 MB+
```

## Linux

```text
Architecture: x64
RAM: 4 GB minimum
Storage: 500 MB+
```

These numbers should be finalized after real application performance testing rather than treated as arbitrary permanent requirements.

---

# 25. Auto-Update Strategy

Auto-update is a core part of the desktop product.

Desired experience:

```text
User opens NOTO
       ↓
Check latest version
       ↓
New version?
   ┌───┴───┐
   │       │
  No      Yes
   │       │
   ▼       ▼
Continue  Download
           │
           ▼
       Install later
           │
           ▼
       Restart NOTO
```

For Electron, the built-in `autoUpdater` supports Windows and macOS. Electron also documents a free `update.electronjs.org` service designed for public GitHub repositories whose builds are published to GitHub Releases, with macOS builds code-signed.

Therefore the initial NOTO strategy should be:

```text
GitHub
   ↓
GitHub Release
   ↓
Electron update service
   ↓
NOTO desktop
```

Do not build a custom update server initially.

A custom update server can be introduced later if NOTO requires:

* staged rollouts
* percentage releases
* private releases
* enterprise channels
* custom update policies
* regional releases

---

# 26. Update Channels

Future NOTO releases can have channels.

```text
Stable
   │
   └── v1.0.x

Beta
   │
   └── v1.1.0-beta.x

Nightly
   │
   └── development builds
```

Users should default to:

```text
Stable
```

Power users can optionally choose:

```text
Beta
```

---

# 27. Code Signing Strategy

Code signing is not optional for a serious public desktop release.

Electron recommends signing distributable applications because Windows and macOS apply security checks to unsigned software.

## Windows

Production builds should eventually be signed.

Possible future signing architecture:

```text
GitHub Actions
      ↓
Windows build
      ↓
Code signing service
      ↓
Signed installer
      ↓
GitHub Release
```

## macOS

Production process:

```text
Build
 ↓
Apple code signing
 ↓
Notarization
 ↓
DMG
 ↓
GitHub Release
```

macOS signing/notarization requires Apple Developer enrollment and macOS/Xcode tooling.

---

# 28. Development vs Production Signing

Do not require production certificates during ordinary development.

```text
Development
   ↓
Unsigned
   ↓
Local testing
```

Production:

```text
Production
   ↓
Signed
   ↓
Notarized where required
   ↓
Public release
```

Signing credentials must never be committed to Git.

Store them using:

```text
GitHub Actions Secrets
```

---

# 29. Free Infrastructure — Initial Stage

The initial NOTO infrastructure can be:

```text
GitHub
    │
    ├── Repository
    ├── Actions
    ├── Releases
    └── Source control
          │
          ▼
     Cloudflare Pages
          │
          ▼
      NOTO Website
```

Initial expected cost:

```text
Repository          ₹0
CI/CD               ₹0 initially
Releases            ₹0 initially
Website hosting     ₹0 initially
Domain              Optional paid
Backend             ₹0
Database            ₹0
```

GitHub documents that public repositories can use standard GitHub-hosted Actions runners without Actions usage charges.

---

# 30. Free-Tier Limits

The important current GitHub Free limits include:

```text
GitHub Actions
├── 2,000 minutes/month
├── 500 MB artifact storage
└── 10 GB cache/repository

GitHub Releases
├── Individual asset < 2 GiB
├── Up to 1,000 assets/release
└── No stated total release-size limit
```

GitHub's current documentation confirms these values and notes that Actions allowances differ between public and private repositories.

For NOTO, this should be sufficient during early development.

---

# 31. Avoiding Free-Tier Waste

Builds should not unnecessarily run all platforms on every commit.

### Pull Request

Run:

```text
Lint
Typecheck
Unit tests
Web build
```

### Develop

Run:

```text
Full CI
Staging deployment
```

### Production tag

Run:

```text
Windows
macOS
Linux
Website
Mobile when applicable
```

This keeps CI usage under control.

---

# 32. When Paid Hosting Becomes Necessary

Do not purchase hosting simply because NOTO is a software product.

Move to paid infrastructure when there is a real requirement.

Examples:

```text
Large traffic
      ↓
CDN upgrade

Large download volume
      ↓
Object storage/CDN

Cloud synchronization
      ↓
Backend + database

Authentication
      ↓
Identity service

Large-scale analytics
      ↓
Analytics infrastructure

Enterprise customers
      ↓
Dedicated infrastructure
```

The first paid infrastructure is more likely to be:

```text
Domain
```

rather than:

```text
VPS / Hostinger
```

---

# 33. When NOTO Needs a Backend

The initial NOTO architecture remains local-first.

No backend is required simply to:

* write notes
* edit documents
* manage tabs
* save locally
* manage clipboard history
* use the desktop application
* use the web application locally

A backend becomes relevant when NOTO introduces:

```text
Cloud Sync
      ↓
User Accounts
      ↓
Cross-device synchronization
      ↓
Cloud Backup
      ↓
Collaboration
```

Then the architecture can evolve into:

```text
NOTO
 │
 ├── Local Storage
 │
 └── Optional Cloud
        │
        ├── Authentication
        ├── API
        ├── Database
        └── Object Storage
```

---

# 34. Final Recommended Infrastructure

For the first serious NOTO release:

```text
                    ┌───────────────────┐
                    │      GitHub       │
                    │                   │
                    │ Repository        │
                    │ Actions           │
                    │ Releases          │
                    └─────────┬─────────┘
                              │
                         Git Tag
                              │
                              ▼
                    ┌───────────────────┐
                    │  Release Pipeline │
                    └─────────┬─────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
         Website           Desktop           Mobile
            │                 │                 │
            ▼                 ▼                 ▼
       Cloudflare          Electron         Capacitor
         Pages                │                 │
                              │          ┌──────┴──────┐
                              │          ▼             ▼
                              │       Android         iOS
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
                 Windows    macOS     Linux
                    │         │         │
                   .exe      .dmg    AppImage
                    │         │         │
                    └─────────┼─────────┘
                              ▼
                       GitHub Release
                              │
                              ▼
                       Auto Update
```

---

# 35. Final User Experience

The finished product should feel like this:

```text
User searches:

"NOTO"

       ↓

NOTO Website

       ↓

┌────────────────────────────────────────┐
│                 NOTO                   │
│                                        │
│       Your notes. Your workspace.      │
│                                        │
│       [ Open Web ]                     │
│                                        │
│       [ Download NOTO ]                │
└────────────────────────────────────────┘

       ↓

Platform detected

       ↓

Windows
   ↓
Download .exe
   ↓
Install
   ↓
Open NOTO
   ↓
Automatic updates
```

For another user:

```text
NOTO Website
     ↓
macOS
     ↓
Download .dmg
     ↓
Install
     ↓
NOTO
     ↓
Automatic updates
```

For mobile:

```text
NOTO Website
     ↓
Android / iOS
     ↓
App Store
     ↓
Install
```

For Web:

```text
NOTO Website
     ↓
Open Web
     ↓
NOTO runs in browser
```

---

# 36. Implementation Phases

The build/release architecture should be implemented in phases.

> **Implementation note.** This document specifies Angular and Capacitor. The
> repository is built with React + Vite, Electron Forge and Expo / React Native.
> The release architecture below is implemented as written; only the UI
> framework differs. Items that need an external account, a paid certificate or
> a store enrolment are marked accordingly — the pipeline for them exists and is
> switched on by adding the secret.

## Phase 1 — Repository Foundation

* [x] GitHub repository
* [x] Monorepo
* [x] pnpm workspace
* [x] Turbo
* [ ] Branch protection — *configured on GitHub, not in the repository; see `docs/development/branching.md`*
* [x] `.github` structure
* [x] CI workflow

## Phase 2 — Web

* [x] Web application (React + Vite)
* [x] Website (`apps/website`)
* [x] Production build
* [x] Cloudflare Pages deployment workflow
* [x] Staging deployment (from `dev`)
* [x] Production deployment (from `main` and from a release tag)

Needs a Cloudflare account: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
Without them the workflow builds and reports success, and skips only the upload.

## Phase 3 — Desktop

* [x] Electron integration
* [x] Windows build (x64 and ARM64)
* [x] macOS build (Apple Silicon and Intel)
* [x] Linux build (x64)
* [x] Installer generation — `.exe`, `.dmg`, `.zip`, `.AppImage`, `.deb`, `.rpm`
* [x] GitHub Release integration

## Phase 4 — Release Automation

* [x] Semantic versioning — `scripts/version.mjs`, enforced against the tag
* [x] Git tags — `v*` triggers the pipeline; tags are immutable
* [x] Release workflow
* [x] Automated release notes — handwritten highlights plus GitHub's generated changelog
* [x] Release assets — with `SHA256SUMS.txt`
* [x] Download page — platform-detecting, resolves the latest release live
* [x] System requirements

## Phase 5 — Desktop Updates

* [x] Update checking
* [x] Update download
* [x] Restart/install flow
* [x] Stable channel
* [x] Beta channel — selection and tagging; needs a static feed to serve updates
* [x] Update failure handling — never blocks startup

## Phase 6 — Signing

* [x] Windows signing — workflow and Forge hooks in place
* [x] macOS signing — workflow and Forge hooks in place
* [x] macOS notarization — workflow and Forge hooks in place
* [x] GitHub Actions secrets — documented in `docs/deployment/secrets.md`
* [x] Production signing workflow — enabled by the `NOTO_RELEASE_SIGN` variable

Needs a code-signing certificate and Apple Developer enrolment. Without them,
builds are produced unsigned rather than failing.

## Phase 7 — Mobile

* [x] Expo (in place of Capacitor)
* [x] Android project — generated by `expo prebuild` in CI
* [x] Android build — APK and AAB
* [ ] Google Play — needs an upload keystore and a Play Console account
* [x] iOS project — generated by `expo prebuild` in CI
* [ ] TestFlight — needs Apple Developer enrolment and signing
* [ ] App Store — needs Apple Developer enrolment and signing

## Phase 8 — Scale

Only when required:

* [ ] Custom domain
* [ ] CDN
* [ ] Object storage
* [ ] Backend
* [ ] Cloud sync
* [ ] Authentication
* [ ] Database
* [ ] Analytics
* [ ] Crash reporting

---

# 37. Final Decision

The initial NOTO infrastructure is therefore:

```text
Frontend
    Angular

Monorepo
    pnpm + Turbo

Web
    Angular + Cloudflare Pages

Desktop
    Angular + Electron

Mobile
    Angular + Capacitor

Source Control
    GitHub

CI/CD
    GitHub Actions

Desktop Distribution
    GitHub Releases

Website
    Cloudflare Pages

Updates
    Electron autoUpdater / update.electronjs.org

Versioning
    Semantic Versioning

Releases
    Git tags + GitHub Releases

Windows
    .exe

macOS
    .dmg

Linux
    .AppImage / .deb

Android
    Google Play

iOS
    App Store

Backend
    None initially

Hosting
    Free initially

Domain
    Optional initially
```

## The target principle

> **Develop once, push once, tag once, and let the pipeline build, package, release, publish, and distribute NOTO for every supported platform.**

This architecture keeps NOTO **free to operate during development**, avoids premature Hostinger/server costs, and leaves a clean path toward a professional commercial product when users and traffic eventually justify paid infrastructure.
