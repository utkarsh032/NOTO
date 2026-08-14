# NOTO : Product Requirements Document (PRD)

## **Document Version:** 1.0

**Product:** Noto
**Product Type:** Cross-platform productivity and information workspace
**Target Platforms:** Web + Desktop + Mobile
**Primary Platform:** Desktop
**Architecture:** Shared Core + Platform-specific clients
**Development Model:** Local-first + Cloud-synced
**Technology Direction:** React ecosystem + Electron + React Native/Expo

---

# 1\. Product Overview

## 1.1 What is Noto?

Noto is a cross-platform productivity application designed to combine:

- A powerful text editor
- Document and tab management
- Quick notes
- Clipboard history
- Information capture
- Personal memory
- Search
- Cross-device synchronization
- Recovery and version history
- AI-powered assistance

Noto is inspired by the strengths of products such as OneNote, VS Code, Notion, Slack and Figma, while introducing a stronger **personal memory and capture layer**.

Noto should feel like:

> **A place where you write, capture, remember, organize, find and reuse information.**

---

# 2\. Product Philosophy

Noto will follow five core principles.

### 2.1 Desktop-first

Desktop is the primary and most powerful Noto experience.

Desktop will provide capabilities that require operating-system integration:

- Floating Noto
- Global shortcuts
- Clipboard history
- Screenshot capture
- Smart Sidebar
- PIP
- Companion mode
- Filesystem access
- Native notifications
- System tray

---

### 2.2 Local-first

Noto should remain useful even when the internet is unavailable.

The basic workflow should be:

```text
User
 ↓
Noto
 ↓
Local Storage
 ↓
Immediate Result
 ↓
Sync Queue
 ↓
Cloud
```

Internet availability should enhance Noto, not determine whether Noto can function.

---

### 2.3 One Product, Three Platforms

Noto will not be three independent applications.

The architecture will be:

```text
                     NOTO
                      │
                Shared Code
                      │
   ┌──────────────────┼──────────────────┐
   │                  │                  │
   ▼                  ▼                  ▼
  WEB              DESKTOP             MOBILE
 React             React              React Native
                     +                    +
                  Electron              Expo
```

---

### 2.4 Shared Core, Platform-specific capabilities

Noto's business logic, models, services and core functionality will be shared.

Platform-specific functionality will be implemented only where the operating system requires it.

```text
             Noto Code
                100%
                 │
      ┌──────────┼──────────┐
      │          │          │
   Shared      Shared     Shared
    Core        Core       Core
      │          │          │
   Platform   Platform   Platform
   specific   specific   specific
      │          │          │
     Web      Desktop     Mobile
```

The objective is maximum practical code reuse, not forced 100% UI reuse.

---

### 2.5 One Noto Identity

Web, Desktop and Mobile should feel like one product.

The platforms may have different layouts and capabilities, but they must share:

- Noto branding
- Design language
- Data model
- Documents
- Memory
- Search
- Sync
- Account
- Settings
- AI
- User experience principles

---

# 3\. Target Platforms

## 3.1 Web

Technology:

- React
- TypeScript
- Vite
- Browser APIs
- IndexedDB/Dexie

Primary purpose:

- Access Noto from anywhere
- Edit documents
- Search memory
- Access synchronized information
- Manage documents and tabs
- Use AI features

---

## 3.2 Desktop

Technology:

- React
- TypeScript
- Electron
- SQLite

Target:

- Windows
- macOS
- Linux

Desktop is the primary Noto experience.

It will expose advanced OS-level capabilities.

---

## 3.3 Mobile

Technology:

- React Native
- TypeScript
- Expo
- SQLite/native storage

Target:

- Android
- iOS

Mobile will prioritize:

- Quick Note
- Capture
- Memory
- Search
- Reading
- Editing
- AI
- Synchronization

Mobile should not simply reproduce the desktop UI on a small screen.

---

# 4\. Product Feature Structure

Noto features are divided into three major tiers:

## Basic

Core productivity and document editing.

## Advanced

Desktop productivity, capture, memory and workspace capabilities.

## Pro

Cross-device synchronization, AI and advanced intelligence/recovery.

---

# 5\. BASIC FEATURES

## 5.1 Text Editor

Purpose:

Allow users to write and edit content.

Requirements:

- Create document
- Edit document
- Delete document
- Save document
- Load document
- Rich text editing
- Keyboard shortcuts
- Selection
- Copy/paste
- Cursor management

Technology:

**React + Tiptap + ProseMirror**

---

## 5.2 Rich Formatting

Supported functionality:

- Headings
- Bold
- Italic
- Underline
- Strikethrough
- Lists
- Numbered lists
- Links
- Blockquotes
- Code
- Images
- Tables where appropriate
- Text alignment
- Formatting controls

Technology:

**Tiptap / ProseMirror**

---

## 5.3 Files

Noto will support:

- New
- Open
- Save
- Save All
- Close
- Close All
- Delete
- Rename
- Recent files
- Recovery

Desktop may additionally interact with the native filesystem.

---

## 5.4 Tabs

Users can work with multiple documents simultaneously.

Requirements:

- Open tab
- Close tab
- Switch tab
- Active tab
- Dirty/unsaved indicator
- Tab title
- Tab state persistence

---

## 5.5 Undo / Redo

Support:

- Undo
- Redo
- Keyboard shortcuts
- Editor history

Primary technology:

**ProseMirror history**

---

## 5.6 Find / Replace

Requirements:

- Find text
- Find next
- Find previous
- Replace
- Replace all
- Case sensitivity
- Search within document

---

## 5.7 Word Wrap

Users can enable/disable wrapping of long lines.

---

## 5.8 Zoom

Users can control editor viewing size.

Zoom should affect presentation without corrupting document content.

---

## 5.9 Show Characters

Optional visualization of:

- Spaces
- Tabs
- Line breaks
- Other invisible characters

Useful for users working with structured text.

---

## 5.10 Scrolling

Support:

- Vertical scrolling
- Horizontal scrolling
- Smooth scrolling
- Editor-specific scrolling
- Platform-appropriate behavior

---

## 5.11 Print

Users can print documents.

Desktop:

- Native print capabilities where appropriate

Web:

- Browser print/PDF capabilities

---

## 5.12 Auto Save

Noto should automatically save user changes.

Architecture:

```text
User typing
 ↓
Editor state
 ↓
Debounce
 ↓
Local database
 ↓
Recovery snapshot
 ↓
Sync queue
```

Auto-save should not require a network connection.

---

# 6\. ADVANCED FEATURES

# 6.1 Floating Noto

Desktop feature.

Purpose:

Allow Noto to appear instantly above other applications.

Possible activation:

- Global keyboard shortcut
- System tray
- Application command

Technology:

**Electron window management**

---

# 6.2 Smart Sidebar

Desktop companion interface.

Purpose:

Allow users to access Noto while using another application.

Possible functions:

- Search Memory
- Quick Note
- Clipboard
- Quick Paste
- Capture
- AI
- Recent items

Technology:

**React + Electron**

---

# 6.3 Quick Note

Allow users to create a note immediately without opening the full document workflow.

Possible entry points:

- Global shortcut
- Floating Noto
- Sidebar
- Desktop application
- Mobile
- Web

Quick Notes become part of Noto Memory.

---

# 6.4 Noto Memory

Noto Memory is one of the core differentiating systems.

Everything useful captured by Noto can become a Memory Item.

```text
MemoryItem
│
├── Document
├── Quick Note
├── Clipboard
├── Screenshot
├── Image
├── Link
├── Captured Text
└── AI-generated content
```

Memory should support:

- Storage
- Search
- Tags/metadata
- Pinning
- History
- Retrieval
- AI processing
- Synchronization

---

# 6.5 Clipboard History

Desktop-first feature.

Noto monitors clipboard activity where the user permits it.

Supported content may include:

- Text
- Links
- Images
- Other supported clipboard data

Workflow:

```text
OS Clipboard
 ↓
Electron
 ↓
Clipboard Service
 ↓
Local SQLite
 ↓
Noto Memory
```

Security requirements:

- User-controlled enable/disable
- Retention settings
- Ability to delete history
- Sensitive-content protection
- Exclusion rules where practical

---

# 6.6 Quick Paste

Allow users to find previously remembered clipboard or memory content and paste it again.

Example:

```text
Shortcut
 ↓
Noto Quick Paste
 ↓
Search
 ↓
Select content
 ↓
Paste
```

---

# 6.7 Screenshot Capture

Desktop:

```text
Global Shortcut
 ↓
Electron
 ↓
Screenshot
 ↓
Noto Memory
```

Mobile:

- Native capture/share workflows where supported

Captured screenshots can be:

- Saved
- Named
- Searched
- Pinned
- Referenced by AI

---

# 6.8 Image Capture

Allow users to quickly save images into Noto.

Sources:

- Desktop
- Camera
- Gallery
- Browser-supported capture
- Share integrations

---

# 6.9 Link Capture

Allow users to quickly save useful links.

Stored information may include:

- URL
- Title
- Source
- Timestamp
- User notes
- Tags

Links become Memory Items.

---

# 6.10 Pin Content

Users can pin:

- Documents
- Memory
- Clipboard items
- Links
- Notes
- Tabs

Pinned content should be quickly accessible.

---

# 6.11 Tab Controls

Support:

- Close left
- Close right
- Close others
- Close all

---

# 6.12 Pin Tab

Pinned tabs remain protected from accidental closing.

---

# 6.13 Duplicate Tab

Create another tab using the current document/content.

---

# 6.14 Move Tab

Users can rearrange tabs through:

- Drag and drop
- Keyboard commands
- Context menu

---

# 6.15 Restore Tab

Allow reopening recently closed tabs.

Noto should maintain a recent closed-tab history.

---

# 6.16 Import / Export

Noto should provide a document conversion layer.

Potential formats:

- TXT
- Markdown
- HTML
- JSON
- PDF
- DOCX where supported

Architecture:

```text
External Format
 ↓
Importer
 ↓
Noto Document Model
 ↓
Editor
```

Export:

```text
Noto Document Model
 ↓
Exporter
 ↓
External Format
```

---

# 6.17 PDF

Allow users to generate PDFs from Noto documents.

Potential implementation:

- Browser print/PDF
- Electron PDF capabilities
- PDF generation libraries where controlled output is required

---

# 6.18 Layout

Allow users to customize the workspace.

Potential layouts:

- Single editor
- Editor + sidebar
- Editor + memory
- Split view
- Multiple panels

Desktop should have the most advanced layout capabilities.

---

# 6.19 Settings

Settings should control:

- Editor
- Appearance
- Theme
- Font
- Font size
- Zoom
- Word wrap
- Auto-save
- Clipboard
- Memory
- Notifications
- Shortcuts
- Sync
- AI
- Privacy
- Storage
- Recovery

---

# 7\. PRO FEATURES

# 7.1 Device Sync

Noto content should synchronize between:

```text
Desktop
   ↕
Web
   ↕
Mobile
```

Synchronization should include appropriate:

- Documents
- Memory
- Quick Notes
- Links
- Settings
- Pins
- Versions

---

# 7.2 Real-Time Sync

Changes should become available across connected devices.

Initial technology:

**Supabase Realtime**

Future complex rich-text synchronization:

**Yjs/CRDT evaluation**

---

# 7.3 Web + Desktop + Mobile

One Noto account should provide access to the same ecosystem.

The interfaces remain platform-appropriate while using shared data and business logic.

---

# 7.4 Noto Companion

Desktop feature.

Noto should remain available while users work in other applications.

Potential forms:

- Sidebar
- Floating window
- Quick launcher
- System tray

---

# 7.5 PIP Mode

Allow a compact Noto window to remain visible above other applications.

Desktop implementation:

**Electron**

Mobile implementation:

Use platform-native PIP capabilities where applicable and appropriate.

---

# 7.6 Smart Paste

Noto can use Memory + AI to suggest previously used content.

Example:

```text
User starts writing
 ↓
Noto recognizes context
 ↓
Search Memory
 ↓
Relevant content found
 ↓
Suggestion displayed
```

User remains in control of whether to insert the suggestion.

---

# 7.7 AI Assistant

AI can assist with:

- Writing
- Rewriting
- Grammar
- Summarization
- Explanation
- Expansion
- Shortening
- Formatting
- Brainstorming
- Understanding selected content

Architecture:

```text
Noto UI
 ↓
AI Service
 ↓
AI Provider
```

The UI must not directly depend on a specific AI provider.

---

# 7.8 AI Search

Users can search using natural language.

Example:

> "Find the note where I wrote about the Angular upload issue."

Architecture:

```text
User Question
 ↓
Search Service
 ↓
Keyword + Semantic Search
 ↓
Relevant Noto Memory
 ↓
AI
 ↓
Answer / Results
```

---

# 7.9 AI Organization

AI can identify relationships between information.

Potential capabilities:

- Suggest tags
- Group related content
- Identify duplicate information
- Suggest categories
- Connect related notes
- Organize Memory

AI suggestions should not silently destroy or modify user information.

---

# 7.10 Noto Memory Search

Search across:

- Documents
- Quick Notes
- Clipboard
- Links
- Screenshots
- Images
- Captured content
- Memory

Initial search:

**Full-text search**

Advanced search:

**Semantic/vector search**

---

# 7.11 Version History

Noto maintains historical document versions.

Architecture:

```text
Document
│
├── Version 1
├── Version 2
├── Version 3
├── Version 4
└── Current
```

Users can:

- View versions
- Compare versions
- Restore versions

---

# 7.12 Advanced Recovery

Noto should protect against:

- Accidental closure
- Application crash
- System failure
- Unsaved changes
- Corrupted sessions
- Sync interruptions

Recovery layers:

```text
Editor State
 ↓
Local Autosave
 ↓
Recovery Snapshot
 ↓
Version History
 ↓
Cloud Backup
```

---

# 8\. NOTO CORE

Noto Core is the heart of the product.

It should contain business logic that is independent from the platform.

```text
                    Noto Core
                       │
       ┌───────────────┼────────────────┐
       │               │                │
   Documents         Memory            Search
       │               │                │
       ├───────────────┼────────────────┤
       │               │                │
      Sync          Versioning         AI
       │               │                │
       └───────────────┼────────────────┘
                       │
                    Settings
```

---

# 9\. Noto Core Responsibilities

## Documents

Responsible for:

- Create
- Read
- Update
- Delete
- Rename
- Save
- Load
- Metadata
- Document state

---

## Tabs

Responsible for:

- Active tab
- Tab ordering
- Pinned tabs
- Closed tabs
- Duplicate tabs
- Restore
- Tab groups/state

---

## Memory

Responsible for:

- Memory Items
- Metadata
- Capture types
- Pinning
- Retrieval
- Retention
- Memory relationships

---

## Search

Responsible for:

- Local search
- Cloud search
- Full-text search
- Semantic search
- Search ranking

---

## Sync

Responsible for:

- Sync queue
- Change tracking
- Upload
- Download
- Conflict detection
- Conflict resolution
- Retry
- Offline queue

---

## AI

Responsible for:

- AI requests
- Context preparation
- Provider abstraction
- AI results
- AI actions
- AI safety/privacy boundaries

---

## Settings

Responsible for:

- User preferences
- Application preferences
- Editor settings
- Platform settings
- Privacy settings
- AI settings
- Sync settings

---

## Data

Responsible for:

- Repository interfaces
- Local persistence
- Cloud persistence
- Data serialization
- Migration

---

## Platform

Responsible for platform-specific capabilities.

```text
platform/
│
├── web/
├── desktop/
└── mobile/
```

Examples:

- Clipboard
- File system
- Global shortcut
- Screenshot
- Notifications
- Window management
- Camera
- Native sharing

---

# 10\. FINAL PROJECT STRUCTURE

```text
noto/
│
├── apps/
│   │
│   ├── web/
│   │    └── React
│   │
│   ├── desktop/
│   │    ├── React
│   │    └── Electron
│   │
│   └── mobile/
│        ├── React Native
│        └── Expo
│
├── packages/
│   │
│   ├── core/
│   │
│   ├── documents/
│   │
│   ├── editor/
│   │
│   ├── memory/
│   │
│   ├── search/
│   │
│   ├── sync/
│   │
│   ├── ai/
│   │
│   ├── settings/
│   │
│   ├── data/
│   │
│   ├── auth/
│   │
│   ├── ui/
│   │
│   └── platform/
│        ├── web/
│        ├── desktop/
│        └── mobile/
│
└── tools/
```

---

# 11\. NOTO DESIGN SYSTEM

Noto will maintain a shared design system across all platforms.

```text
Noto Design System
│
├── Button
├── Input
├── Dialog
├── Menu
├── Tabs
├── Editor Toolbar
├── Cards
├── Icons
├── Tooltips
├── Dropdowns
├── Context Menus
├── Command Palette
├── Sidebar
├── Panels
├── Toasts
├── Loading States
├── Empty States
├── Error States
└── Colors / Typography
```

The design system defines:

- Colors
- Typography
- Spacing
- Border radius
- Shadows
- Icons
- Interaction states
- Accessibility
- Light theme
- Dark theme

The components should share the same visual language while allowing platform-specific layouts.

---

# 12\. TECHNOLOGY STACK

## Frontend

| Area             | Technology                                    |
| ---------------- | --------------------------------------------- |
| Web UI           | React                                         |
| Desktop UI       | React                                         |
| Mobile UI        | React Native                                  |
| Language         | TypeScript                                    |
| Web Build        | Vite                                          |
| Mobile Tooling   | Expo                                          |
| Desktop Runtime  | Electron                                      |
| Styling          | Tailwind CSS                                  |
| Design System    | Custom Noto Design System                     |
| State Management | Zustand / appropriate lightweight state layer |
| Monorepo         | Nx                                            |

---

## Editor

| Area            | Technology          |
| --------------- | ------------------- |
| Rich Text       | Tiptap              |
| Editor Engine   | ProseMirror         |
| Undo/Redo       | ProseMirror history |
| Custom features | Tiptap extensions   |

---

## Local Storage

### Web

```text
React
 ↓
Dexie
 ↓
IndexedDB
```

### Desktop

```text
React
 ↓
Electron
 ↓
SQLite
```

### Mobile

```text
React Native
 ↓
SQLite / platform storage
```

---

# 13\. BACKEND

## Do we need a backend?

### Yes, for Pro/cloud functionality.

But we do not need to build a large custom backend at the beginning.

Initial backend:

### Supabase

```text
Supabase
│
├── PostgreSQL
├── Authentication
├── Storage
├── Realtime
└── Edge Functions
```

---

# 14\. DATABASE ARCHITECTURE

## Local databases

Desktop/Mobile:

**SQLite**

Web:

**IndexedDB**

## Cloud database

**PostgreSQL**

Potential core tables:

```text
users
devices
documents
document_versions
memory_items
clipboard_items
captures
links
folders
tags
pinned_items
settings
sync_operations
```

The final schema will be designed during the architecture/data-model phase rather than prematurely.

---

# 15\. FILE STORAGE

Large binary content such as:

- Screenshots
- Images
- Attachments
- Exported files

should not be stored directly inside PostgreSQL.

Use:

```text
PostgreSQL
   ↓
Metadata

Supabase Storage
   ↓
Binary files
```

---

# 16\. SEARCH ARCHITECTURE

## Phase 1

Local search:

```text
Local Database
 ↓
Local Search Index
```

Cloud:

```text
PostgreSQL
 ↓
Full-Text Search
```

## Phase 2

Semantic search:

```text
Content
 ↓
Embeddings
 ↓
pgvector
 ↓
Semantic Search
```

This avoids introducing a separate vector database unnecessarily.

---

# 17\. AI ARCHITECTURE

```text
                Noto AI
                   │
              AI Service
                   │
       ┌───────────┼───────────┐
       ↓           ↓           ↓
    Provider     Provider    Provider
```

The exact providers can be selected later.

AI functionality should be isolated behind an internal interface.

---

# 18\. SECURITY AND PRIVACY

Because Noto may store sensitive personal information, privacy is a first-class requirement.

Potential sensitive information includes:

- Clipboard data
- Screenshots
- Documents
- Links
- Personal notes
- AI context

Requirements:

- Secure authentication
- Authorization
- Encrypted network communication
- Secure local storage where appropriate
- User-controlled clipboard history
- Configurable retention
- Delete functionality
- Sync controls
- AI privacy controls
- No silent destructive AI actions

---

# 19\. OFFLINE ARCHITECTURE

Offline is not an optional enhancement.

Core functionality should work locally.

```text
                 Noto
                   │
             Local First
                   │
        ┌──────────┴──────────┐
        ↓                     ↓
   Local Database        Sync Queue
        │                     │
        │                  Internet
        │                     │
        └──────────┬──────────┘
                   ↓
                 Cloud
```

If the internet is unavailable:

```text
Create
Edit
Save
Search
Read
Recover
```

should continue to work according to the platform's locally available data.

---

# 20\. SYNCHRONIZATION

Synchronization should be asynchronous.

```text
User Action
 ↓
Noto Core
 ↓
Local Database
 ↓
Sync Operation
 ↓
Queue
 ↓
Internet
 ↓
Cloud
```

The UI should not wait for cloud confirmation before treating a local change as saved.

---

# 21\. PERFORMANCE PRINCIPLES

Noto should feel instant.

Required principles:

- Local-first operations
- Debounced autosave
- Virtualized lists
- Lazy loading
- Code splitting
- Background synchronization
- Efficient React rendering
- Web Workers where appropriate
- Incremental search indexing
- Memory management
- Image optimization
- Large-file streaming where appropriate

For example:

```text
50,000 Memory Items
        ↓
Virtualized List
        ↓
Only visible items rendered
```

---

# 22\. PLATFORM FEATURE STRATEGY

Not every feature needs identical behavior everywhere.

### Shared

- Documents
- Editor
- Memory
- Search
- AI
- Sync
- Settings
- Version history

### Desktop-specific

- Floating Noto
- Global shortcuts
- Clipboard monitoring
- Smart Sidebar
- PIP
- System tray
- Advanced filesystem
- Desktop screenshot

### Mobile-specific

- Camera
- Native sharing
- Notifications
- Mobile capture
- Mobile navigation
- Native platform behavior

### Web-specific

- Browser APIs
- Browser storage
- Browser-based printing
- Browser limitations

---

# 23\. DEVELOPMENT PHASES

## Phase 1 — Foundation

Set up:

- Nx monorepo
- React
- TypeScript
- Web
- Electron
- React Native
- Expo
- Tailwind
- Noto Design System
- Tiptap
- Shared packages
- Development standards

Goal:

> All three applications start from one Noto repository.

---

## Phase 2 — Noto Core + Editor

Build:

- Document model
- Local database
- Text editor
- Rich formatting
- Files
- Tabs
- Undo/Redo
- Find/Replace
- Word Wrap
- Zoom
- Show Characters
- Scrolling
- Print
- Auto-save

Goal:

> A fully functional offline Noto editor.

---

## Phase 3 — Workspace + Memory

Build:

- Quick Note
- Noto Memory
- Clipboard
- Quick Paste
- Screenshot
- Image Capture
- Link Capture
- Pin Content
- Tab Controls
- Pin Tab
- Duplicate Tab
- Move Tab
- Restore Tab
- Import/Export
- PDF
- Layout
- Settings

Goal:

> Noto becomes more than a text editor.

---

## Phase 4 — Desktop Power

Build:

- Floating Noto
- Global shortcut
- Smart Sidebar
- Clipboard monitoring
- PIP
- Companion
- System tray
- Native notifications
- Filesystem integration
- Desktop recovery

Goal:

> Establish Noto as a powerful desktop productivity utility.

---

## Phase 5 — Cloud + Sync

Add:

- Supabase
- Authentication
- PostgreSQL
- Storage
- Device registration
- Sync engine
- Realtime
- Cloud backup
- Version history
- Recovery

Goal:

> One Noto identity across devices.

---

## Phase 6 — Mobile

Build:

- Mobile UI
- Quick Note
- Memory
- Capture
- Documents
- Search
- Sync
- Native sharing
- Notifications
- Mobile settings

Goal:

> Noto becomes a complete Web + Desktop + Mobile ecosystem.

---

## Phase 7 — AI

Build:

- AI Assistant
- Smart Paste
- AI Search
- AI Organization
- Semantic Memory Search
- Embeddings
- pgvector
- Advanced AI context system

Goal:

> Turn Noto Memory into an intelligent personal information system.

---

# 24\. Final Architecture

```text
                              NOTO
                               │
                         Shared Code
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
         WEB                DESKTOP               MOBILE
       React                React              React Native
                               +                    +
                            Electron               Expo
          │                    │                    │
          ▼                    ▼                    ▼
      IndexedDB              SQLite               SQLite
       + Dexie
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                          Noto Core
                               │
       ┌───────────┬───────────┼───────────┬───────────┐
       │           │           │           │           │
   Documents     Editor      Memory      Search       AI
       │           │           │           │           │
       └───────────┴───────────┼───────────┴───────────┘
                               │
                             Sync
                               │
                           Supabase
                               │
                ┌──────────────┼──────────────┐
                │              │              │
            PostgreSQL      Storage        Realtime
                │
             pgvector
                │
                AI
```

---

# 25\. Final Technology Decision

## Noto officially targets:

### Web

**React + TypeScript**

### Desktop

**React + Electron + TypeScript**

### Mobile

**React Native + Expo + TypeScript**

### Shared

**Noto Core + TypeScript**

### Editor

**Tiptap + ProseMirror**

### Local database

**SQLite + IndexedDB/Dexie**

### Cloud/backend

**Supabase + PostgreSQL**

### File storage

**Supabase Storage**

### Realtime

**Supabase Realtime**

### Search

**PostgreSQL Full-Text Search**

### Advanced search

**pgvector**

### AI

**Provider-independent AI Service**

### Monorepo

**Nx**

### Styling

**Tailwind CSS + Noto Design System**

### Testing

**Vitest + Playwright + React Native testing**

---

# 26\. The Noto Technical Principle

> **Noto is one product, not three applications.**

```text
                     NOTO
                      │
                Shared Code
                      │
   ┌──────────────────┼──────────────────┐
   │                  │                  │
   ▼                  ▼                  ▼
  WEB              DESKTOP             MOBILE
 React             React              React Native
                     +                    +
                  Electron              Expo
```

The goal is:

**Build the core once.**

**Reuse the business logic everywhere.**

**Reuse UI where practical.**

**Use platform-specific code only where the operating system requires it.**

**Keep data local first.**

**Synchronize with the cloud.**

**Add AI on top of the user's own information.**

---

# 27\. Product Positioning

Noto should ultimately feel like:

```text
                 NOTO
                   │
       ┌───────────┼───────────┐
       │           │           │
    OneNote     VS Code      Memory
   Documents   Workspace    Clipboard
       │           │           │
       └───────────┼───────────┘
                   │
                 Noto
                   │
       ┌───────────┼───────────┐
       │           │           │
      Sync         AI        Capture
       │           │           │
       └───────────┼───────────┘
                   │
              Personal
             Information
                System
```

The long-term vision is not merely:

> **"A better Notepad."**

It is:

> **"A fast, local-first workspace that remembers what you write, copy, capture and save — and helps you find and use it anywhere."**
