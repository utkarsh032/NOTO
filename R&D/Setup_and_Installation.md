# Noto --- Development Setup & Installation Specification

**Project:** Noto\
**Document:** Final Development Setup, Installation & Package
Specification\
**Status:** Final\
**Date:** August 13, 2026

------------------------------------------------------------------------

## 1. Purpose

This document defines the finalized development environment, technology
stack, installation strategy, package strategy, and project structure
for Noto.

The goal is to establish a clean, scalable foundation for building Noto
across Web, Desktop, and Mobile while maximizing shared code.

------------------------------------------------------------------------

## 2. Final Platform Architecture

``` text
                         NOTO
                          │
                    Shared Code
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
         WEB            DESKTOP         MOBILE
        React            React         React Native
         +                +               +
        Vite           Electron          Expo
```

Noto will use a monorepo so that common logic, types, editor
functionality, UI foundations, configuration, and other reusable code
can be shared between applications.

------------------------------------------------------------------------

## 3. Final Technology Stack

  -----------------------------------------------------------------------
  Area                    Technology              Purpose
  ----------------------- ----------------------- -----------------------
  Language                TypeScript              Shared, type-safe
                                                  development

  Web UI                  React                   Noto Web application

  Web Build               Vite                    Fast development and
                                                  production builds

  Desktop UI              React                   Reuse the React UI
                                                  foundation

  Desktop Runtime         Electron                Cross-platform desktop
                                                  application

  Mobile                  React Native            Native mobile
                                                  application

  Mobile Framework        Expo                    React Native
                                                  development and builds

  Monorepo                pnpm Workspaces +       Workspace and build
                          Turborepo               management

  Editor                  Tiptap + ProseMirror    Rich text editing

  Web Local Storage       IndexedDB + Dexie       Local-first browser
                                                  storage

  Desktop/Mobile Database SQLite                  Local structured
                                                  storage

  Cloud Platform          Supabase                Database,
                                                  authentication,
                                                  storage, realtime and
                                                  server functions

  Collaboration           Yjs                     Future real-time
                                                  collaborative editing

  State Management        Zustand                 Lightweight application
                                                  state

  Styling                 Tailwind CSS            UI styling

  Unit Testing            Vitest                  Unit and integration
                                                  testing

  E2E Testing             Playwright              End-to-end testing

  Code Quality            ESLint + Prettier       Linting and formatting

  Desktop Packaging       Electron Forge          Desktop packaging and
                                                  distribution

  Mobile Build            EAS                     Expo Android/iOS builds
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 4. Computer Software to Install

### 4.1 Required

Install these on the development computer:

1.  **Node.js LTS**
    -   Runtime for the JavaScript/TypeScript ecosystem.
    -   Provides npm.
    -   Use the LTS release rather than an experimental/current release.
2.  **Git**
    -   Source control.
    -   Required for the Noto repository and collaboration workflow.
3.  **Visual Studio Code**
    -   Primary development environment.
4.  **Android Studio**
    -   Required when local Android development/testing begins.
    -   Provides Android SDK and emulator tooling.

### 4.2 Optional

**GitHub Desktop**

Not required. Git command-line tools are sufficient.

------------------------------------------------------------------------

## 5. Official Downloads

-   Node.js: https://nodejs.org/
-   Git: https://git-scm.com/downloads
-   Visual Studio Code: https://code.visualstudio.com/
-   Android Studio: https://developer.android.com/studio

------------------------------------------------------------------------

## 6. Global Installation Policy

Do not globally install project libraries such as:

``` text
React
Vite
Electron
Tiptap
Tailwind CSS
TypeScript
Turborepo
Expo
```

These should be managed locally by the Noto project.

The project should have reproducible dependencies defined by its package
manifests and lockfile.

------------------------------------------------------------------------

## 7. Noto Monorepo Structure

The finalized repository structure is:

``` text
Noto/
│
├── apps/
│   ├── web/
│   ├── desktop/
│   └── mobile/
│
├── packages/
│   ├── core/
│   ├── editor/
│   ├── database/
│   ├── sync/
│   ├── types/
│   ├── ui/
│   └── config/
│
├── tooling/
│   ├── eslint/
│   ├── prettier/
│   └── typescript/
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
└── README.md
```

------------------------------------------------------------------------

## 8. Application Architecture

### Web

``` text
apps/web
│
├── React
├── Vite
├── Tailwind CSS
└── Browser APIs / IndexedDB
```

### Desktop

``` text
apps/desktop
│
├── React
├── Electron
├── Tailwind CSS
└── Local SQLite
```

### Mobile

``` text
apps/mobile
│
├── React Native
├── Expo
├── Expo Router
└── SQLite
```

------------------------------------------------------------------------

## 9. Shared Packages

### `packages/core`

Contains application-independent core business logic.

Examples:

``` text
Document operations
File operations
Command definitions
Shared utilities
Application rules
```

### `packages/editor`

Contains the shared editor foundation.

``` text
Tiptap
ProseMirror
Editor extensions
Document schema
Editor commands
Serialization
```

### `packages/database`

Provides common database abstractions and persistence logic.

Platform-specific implementations can sit underneath the common
interface.

``` text
Web       → IndexedDB / Dexie
Desktop   → SQLite
Mobile    → SQLite
```

### `packages/sync`

Responsible for future synchronization logic.

Potential future technologies:

``` text
Supabase
Yjs
CRDT synchronization
Offline/online sync
```

### `packages/types`

Shared TypeScript types and interfaces.

Examples:

``` text
Document
Folder
File
User
Workspace
Settings
SyncState
```

### `packages/ui`

Shared design-system foundations and reusable components where platform
compatibility allows.

### `packages/config`

Shared project configuration and constants.

------------------------------------------------------------------------

## 10. Editor Stack

Noto's rich text editor will use:

``` text
Noto Editor
     │
   Tiptap
     │
 ProseMirror
     │
Structured Document Model
```

Initial packages:

``` text
@tiptap/core
@tiptap/react
@tiptap/starter-kit
```

Additional Tiptap extensions should be installed only when the
corresponding feature is implemented.

Potential editor features include:

-   Headings
-   Bold
-   Italic
-   Lists
-   Links
-   Quotes
-   Code
-   Tables
-   Images
-   Keyboard shortcuts
-   Custom extensions
-   Future collaboration

------------------------------------------------------------------------

## 11. Local-First Storage

Noto should be designed around local-first behavior.

### Web

``` text
IndexedDB
    +
Dexie
```

Packages:

``` text
dexie
dexie-react-hooks
```

### Desktop and Mobile

``` text
SQLite
```

The exact SQLite integration should be selected according to the
platform implementation when those applications are created.

The goal is:

``` text
                Noto
                  │
          ┌───────┴───────┐
          │               │
       LOCAL            CLOUD
          │               │
    ┌─────┴─────┐      Supabase
    │           │
 IndexedDB    SQLite
```

Local storage remains the primary working layer.

Cloud services provide synchronization, accounts, backup, and related
online capabilities.

------------------------------------------------------------------------

## 12. Cloud Stack

Noto will use:

``` text
Supabase
```

Primary capabilities:

``` text
PostgreSQL
Authentication
Storage
Realtime
Edge Functions
```

Client package:

``` text
@supabase/supabase-js
```

Cloud functionality should be introduced progressively rather than
making the first local development build dependent on the cloud.

------------------------------------------------------------------------

## 13. State Management

Use:

``` text
Zustand
```

for lightweight application-wide state.

Potential state includes:

``` text
Current document
Editor state
Sidebar state
Theme
User preferences
Window state
UI commands
Application settings
```

Avoid introducing Redux unless future complexity clearly justifies it.

------------------------------------------------------------------------

## 14. Styling and Design System

Use:

``` text
Tailwind CSS
```

The styling architecture should be:

``` text
Tailwind CSS
      ↓
Design Tokens
      ↓
Noto UI Components
      ↓
Applications
```

The UI should be designed as a coherent Noto design system instead of
independently styling every application.

------------------------------------------------------------------------

## 15. Testing

### Unit and Integration

``` text
Vitest
```

Use for:

-   Core logic
-   Utilities
-   Editor behavior
-   State logic
-   Database abstractions

### End-to-End

``` text
Playwright
```

Use for:

-   Web workflows
-   Desktop workflows where supported
-   Critical user journeys
-   File/document operations
-   Authentication flows
-   Regression testing

Mobile testing will use the appropriate React Native/Expo testing
strategy.

------------------------------------------------------------------------

## 16. Code Quality

The project should standardize on:

``` text
TypeScript
ESLint
Prettier
```

Goals:

-   Consistent formatting
-   Early error detection
-   Maintainable code
-   Shared linting rules
-   Shared formatting rules

Configuration should be centralized where practical.

------------------------------------------------------------------------

## 17. Desktop Stack

Desktop:

``` text
React
   +
Electron
```

Packaging:

``` text
Electron Forge
```

Target desktop platforms:

``` text
Windows
macOS
Linux
```

Potential output:

``` text
Noto.exe
Noto.dmg
Noto.AppImage
```

Exact packaging configuration will be finalized when the desktop
application is created.

------------------------------------------------------------------------

## 18. Mobile Stack

Mobile:

``` text
React Native
      +
    Expo
```

Routing:

``` text
Expo Router
```

Build/distribution:

``` text
EAS
```

Target:

``` text
Android
iOS
```

Mobile-specific tooling should be configured when the mobile application
is created.

------------------------------------------------------------------------

## 19. Collaboration

Real-time collaboration is a future capability.

Planned technology:

``` text
Yjs
```

Architecture:

``` text
Editor
  ↓
Yjs
  ↓
CRDT
  ↓
Synchronization
  ↓
Remote Users
```

Yjs should not be added to the initial setup unless collaboration is
part of the current development milestone.

This keeps the initial architecture simpler.

------------------------------------------------------------------------

## 20. Package Installation Strategy

### Install during initial workspace setup

``` text
TypeScript
React
React DOM
Vite
Turborepo
Tailwind CSS
ESLint
Prettier
Vitest
Playwright
Zustand
Tiptap
Dexie
Supabase
```

### Install when platform applications are created

``` text
Electron
Electron Forge

React Native
Expo
Expo Router
SQLite
EAS
```

### Install when the feature requires them

``` text
Yjs
Collaboration packages
AI SDK/provider
Advanced file-processing packages
PDF-specific packages
Additional cloud extensions
```

------------------------------------------------------------------------

## 21. Installation Phases

### Phase 0 --- Computer Prerequisites

``` text
Install Node.js LTS
        ↓
Install Git
        ↓
Install VS Code
        ↓
Install Android Studio
```

Verify each installation before continuing.

------------------------------------------------------------------------

### Phase 1 --- Development Environment

``` text
Configure Git
        ↓
Configure pnpm
        ↓
Create Noto project directory
        ↓
Initialize Git repository
```

------------------------------------------------------------------------

### Phase 2 --- Monorepo

``` text
Create Noto monorepo
        ↓
Configure pnpm workspaces
        ↓
Configure Turborepo
        ↓
Configure TypeScript
        ↓
Configure ESLint
        ↓
Configure Prettier
```

------------------------------------------------------------------------

### Phase 3 --- Applications

Create:

``` text
apps/web
apps/desktop
apps/mobile
```

Then configure:

``` text
Web      → React + Vite
Desktop  → React + Electron
Mobile   → React Native + Expo
```

------------------------------------------------------------------------

### Phase 4 --- Core Noto Packages

Add:

``` text
packages/core
packages/editor
packages/database
packages/sync
packages/types
packages/ui
packages/config
```

------------------------------------------------------------------------

### Phase 5 --- Core Libraries

Add:

``` text
Tiptap
Dexie
Zustand
Tailwind CSS
Supabase
Vitest
Playwright
```

------------------------------------------------------------------------

### Phase 6 --- Platform Storage

``` text
Web
 ↓
IndexedDB + Dexie

Desktop
 ↓
SQLite

Mobile
 ↓
SQLite
```

------------------------------------------------------------------------

### Phase 7 --- Noto Foundation

Implement:

``` text
Design system
Shared types
Shared core
Shared editor architecture
Application shell
Theme system
File/document model
Local persistence
```

------------------------------------------------------------------------

## 22. Initial Setup Success Criteria

The setup phase is complete when:

``` text
✓ Node.js LTS installed
✓ npm available
✓ pnpm configured
✓ Git installed
✓ VS Code configured
✓ Android Studio installed
✓ Git repository initialized
✓ Noto monorepo created
✓ pnpm workspace working
✓ Turborepo working
✓ TypeScript working
✓ ESLint working
✓ Prettier working
✓ Web application starts
✓ Desktop application starts
✓ Mobile application starts
✓ Shared packages resolve correctly
```

------------------------------------------------------------------------

## 23. Important Development Rule

Do not build features before the foundation is stable.

The recommended order is:

``` text
Environment
    ↓
Monorepo
    ↓
Shared configuration
    ↓
Applications
    ↓
Shared packages
    ↓
Storage
    ↓
Editor
    ↓
Design system
    ↓
Noto features
```

This prevents the project from becoming three disconnected applications.

------------------------------------------------------------------------

## 24. Final Setup Principle

The core principle for Noto is:

> **Build once where possible, share everywhere, and keep
> platform-specific code isolated.**

The final architecture should allow:

``` text
                 Shared Noto Code
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
       WEB            DESKTOP         MOBILE
      React            React        React Native
      Vite            Electron          Expo
        │               │               │
        └───────────────┼───────────────┘
                        │
                 Noto Core Logic
                        │
              Local-first Architecture
                        │
                 Optional Cloud Sync
                        │
                    Supabase
```

This is the finalized baseline for the Noto development environment.
Future libraries should be added only when a concrete Noto feature
requires them.
