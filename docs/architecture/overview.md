# Architecture overview

Noto is one product with four applications. The applications are thin; almost
everything that matters lives in the shared packages.

Thin is meant literally on Android: that application is a WebView around the
same `@noto/ui` build the web and desktop applications render, plus the native
SQLite connection behind it. See [The mobile shell](#the-mobile-shell).

```text
                        @noto/ui  (design system + application shell)
                              │
      ┌───────────────┬───────┴───────┬────────────────┐
      ▼               ▼               ▼                ▼
   website           web           desktop          mobile
   (static)      React + Vite    React + Electron   Expo + WebView
      │               │               │                │
      │               ▼               ▼                ▼
      │           IndexedDB        SQLite            SQLite
      │            (Dexie)      (main process)   (expo-sqlite, over
      │                                           a WebView bridge)
      ▼
  @noto/config  (tokens, constants, release metadata)
```

## The applications

| App                   | Stack                       | Local storage          |
| --------------------- | --------------------------- | ---------------------- |
| `apps/website`        | React + Vite (static)       | none                   |
| `apps/web`            | React + Vite                | IndexedDB via Dexie    |
| `apps/desktop`        | React + Electron Forge      | SQLite, main process   |
| `apps/mobile`         | Expo shell around a WebView | SQLite via expo-sqlite |
| `apps/mobile-webview` | React + Vite (`@noto/ui`)   | none; asks the shell   |

## The mobile shell

Tiptap and ProseMirror need a DOM. A native React Native editor could not have
run `@noto/editor` at all, so Android would have meant a second, smaller Noto —
one that drifts from web and desktop with every release, and whose editor would
have ended up in a WebView regardless, because that is what the React Native
rich-text libraries are.

So Android runs the real interface instead. `apps/mobile-webview` builds
`@noto/ui` with Vite; `apps/mobile/plugins/with-android-webapp.cjs` copies that
build into the Android project at prebuild, where Gradle packages it; and
`apps/mobile` loads it from `file:///android_asset/webapp/index.html`. Tabs,
find and replace, history, formatting, the outline and every screen are not
ported to Android — they are the same code, running there.

What the native side still owns is everything a WebView cannot do: the SQLite
connection, printing, saving an exported file to the share sheet, safe-area
insets and the hardware back button.

The website is a separate application from the web app on purpose. It is a
public marketing and download site: it must load fast for someone who has never
heard of Noto, and it has no business shipping the editor, the store or the
storage layer to that visitor. It shares the design _tokens_, which is where the
visual consistency comes from.

## The desktop shell

The desktop application is the same shell in an Electron window, plus three
things a browser tab cannot have — and all three exist for the same feature.

**Two windows, one bundle.** The Quick Note dock is a second `BrowserWindow`:
frameless, transparent, always on top, absent from the taskbar, and sized to a
44px tab that opens into a 340px panel. It loads the _same_ renderer bundle at
`#/dock`, and `src/renderer/main.tsx` mounts `DockApp` instead of `App` when it
sees that hash. A second Vite entry would have meant a second HTML file, a
second build and a second copy of the design system in the installer, to render
a handle and a note field that `@noto/ui` already exports.

**The main process owns the dock’s placement.** Which edge, how far down, and
which display are all things a renderer cannot know: inside a 44px window,
`clientX` is a number between 0 and 44 whichever monitor the pointer is over.
So `src/main/dock.ts` holds the placement, persists it to `dock.json` in the
user data directory, and moves the window; the renderer reports gestures. A
drag is two messages and no coordinates — while the dock is being dragged the
window is following the pointer, so the pointer stops moving relative to the
page and the renderer is sent no pointer moves at all. The main process follows
the system cursor on a timer between `drag-start` and `drag-end` instead.

**Closing the window does not quit.** It hides, the dock comes out, and Noto
stays in the tray — which is what makes a note at 11pm not require having left
a document editor open all evening. The tray menu is where Quit lives, and
`app.requestSingleInstanceLock()` keeps a second launch from opening a rival
copy on the same database.

**Global accelerators.** `src/main/shortcuts.ts` registers Quick Note, Quick
Paste and the dock toggle with the operating system, so they fire while another
application has the keyboard. The keys are not written there: they are read from
`CORE_COMMANDS`, the same registry the command palette lists and the sidebar
prints on its Quick Note card, so the hint the user is shown and the key the
system listens for cannot drift apart. A key pressed outside the window arrives
in the renderer as a **command id** on `@noto/ui`’s command bus
(`emitAppCommand`), which means it runs exactly the code the palette runs. The
shell never learns that Electron exists.

Which surface answers a global Quick Note depends on where you are: with the
window in front of you it is the floating note over the document, and with Noto
minimised or closed it is the dock panel — because opening a whole application
to write one line is not an answer.

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
