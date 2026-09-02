/**
 * The human-written changelog.
 *
 * This is the summarised view: one entry per released version, in the words of
 * whoever cut the release. The `/releases` page shows the full notes published
 * on GitHub, fetched live. Add an entry here as part of preparing a release —
 * `docs/releases/README.md` describes where it fits in the process.
 */

export type ChangeKind = 'added' | 'improved' | 'fixed' | 'changed' | 'removed';

export interface ChangelogEntry {
  version: string;
  /** ISO date, or null while the version is still unreleased. */
  date: string | null;
  /** One sentence describing what this release is about. */
  summary: string;
  changes: { kind: ChangeKind; description: string }[];
}

export const CHANGE_KIND_LABEL: Record<ChangeKind, string> = {
  added: 'Added',
  improved: 'Improved',
  fixed: 'Fixed',
  changed: 'Changed',
  removed: 'Removed',
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.4.0',
    date: '2026-09-02',
    summary:
      'Accounts that are real: sign in and Noto knows who you are, sign up and a bot check stands in the way — and signed out is still the whole application.',
    changes: [
      {
        kind: 'added',
        description:
          'Signing in works. An email and a password now return a real session, and the screens that greet you or list your devices read your profile rather than a fixture. The account is additive, as it was always meant to be: Noto opens, writes and searches with nobody signed in, and a build with no cloud credentials behaves exactly as it did before.',
      },
      {
        kind: 'added',
        description:
          'Creating an account goes through Cloudflare Turnstile. The check is verified on the server, where the secret that makes a token mean anything never reaches a browser, and it fails closed — if the verifier cannot be reached, the sign-up is refused rather than waved through.',
      },
      {
        kind: 'improved',
        description:
          'The cloud is no longer part of what a signed-out visitor downloads. The Supabase client moved behind a dynamic import, taking 164 kB out of the bundle that loads before anyone has asked for an account.',
      },
      {
        kind: 'fixed',
        description:
          'Sign-in and sign-up failed in a browser with “Could not reach the server”. The server never saw those requests: its CORS preflight did not name the `apikey` header that every Supabase call sends, so the browser stopped them before they left.',
      },
      {
        kind: 'changed',
        description:
          'Password rules are weaker than they were. The breach-corpus lookup, the common-sequence list and the rule against putting your email in your password have all been removed, and the minimum is six characters — a password already circulating in a public breach will now be accepted.',
      },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-08-31',
    summary:
      'The seven screens Noto is actually made of, the same application running on Android at last, and a Noto that tells you when there is a newer one.',
    changes: [
      {
        kind: 'added',
        description:
          'Noto has the seven screens the product is made of — Home, Workspace, Documents, Noto Memory, Search, Settings, and Account & Devices — under one shell with a persistent sidebar and a global header. Quick Note, Quick Paste, the command palette, import, export and version history stay as overlays over whichever screen is open.',
      },
      {
        kind: 'changed',
        description:
          'Android runs the same Noto as web and desktop. The application is now the shared interface itself, packaged into the APK and talking to the phone’s SQLite database across a bridge — the arrangement the desktop application has always used, with a different pipe. Tabs, find and replace, history, formatting and every screen are no longer ported to Android; they are the same code running there.',
      },
      {
        kind: 'fixed',
        description:
          'Editing a formatted document on Android no longer flattens it. The phone had its own plain-text editor, so opening a document with headings, tables or images and typing one character replaced all of it with unformatted paragraphs. That editor is gone.',
      },
      {
        kind: 'added',
        description:
          'Noto tells you when a new version exists, instead of leaving you to check the download page. The sidebar shows which build it is and offers the update behind its release notes. Desktop downloads and installs it; the web application reloads. Neither happens without being asked, and background checking can be switched off — it is the only thing in Noto that reaches the network unbidden.',
      },
      {
        kind: 'changed',
        description:
          'The workspace is one card: the document and its toolbar together, filling the pane, rather than a formatting bar floating above a narrower sheet. The tab strip appears as soon as anything is open, rarely used controls move behind a More formatting menu, zoom moves to the status bar, and the side panel becomes a tabbed card — outline, statistics, history and the assistant — over a Document Info card.',
      },
      {
        kind: 'added',
        description:
          'Checklists, on CmdOrCtrl+Shift+9. The toolbar named them and the schema did not have them, so a Task List template had nowhere to put its boxes.',
      },
      {
        kind: 'added',
        description:
          'Printing, showing invisible characters, and an editor that remembers where each document was left. Print renders the same DOM the editor draws with the application stripped off, so the page cannot drift from the screen: a dark theme prints black on white, links print their address, and headings, tables and images break sensibly.',
      },
      {
        kind: 'improved',
        description:
          'Opening Noto is faster. Every screen but Home loads on demand, and the editor with it, taking the entry bundle from 1,012 kB to 376 kB.',
      },
      {
        kind: 'fixed',
        description:
          'Opening a document no longer takes the workspace down with it in some cases. Revealing a lazily loaded screen re-runs the effects beneath it, which handed the editor hooks an instance that had just been destroyed.',
      },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08-26',
    summary:
      'Rich formatting — headings, lists, links, images and tables — Noto’s own icon on every platform, and an editor that keeps everything you type.',
    changes: [
      {
        kind: 'added',
        description:
          'Documents are no longer plain text. Headings, bold, italic, underline, strikethrough, bullet and numbered lists, blockquotes, inline and block code, links, images, tables, horizontal rules and text alignment are all available, from a toolbar above the document and from the keyboard.',
      },
      {
        kind: 'added',
        description:
          'Links, with the shortcut on CmdOrCtrl+Shift+K because the command palette already owns CmdOrCtrl+K. Typing a bare address turns it into a link, and a host typed without a scheme gets https://. Addresses that cannot be made safe are refused rather than silently ignored — a note renders as HTML and will sync to other devices, so a javascript: link would be stored cross-site scripting rather than a bad link.',
      },
      {
        kind: 'added',
        description:
          'Images and tables. An image is referenced by its address or kept inline when pasted from the clipboard; Noto has no asset store yet, so nothing is copied into the document behind your back. Tables have resizable columns, with row, column and header controls in the toolbar.',
      },
      {
        kind: 'added',
        description:
          'Noto has its own icon everywhere — the desktop application, the Windows installer, the Android launcher and launch screen, the browser tab and the marketing site. Until now the desktop application carried Electron’s atom and Android carried the green robot, and there was no launch screen at all. One source image derives them all.',
      },
      {
        kind: 'fixed',
        description:
          'Switching documents within a second of typing no longer drops the last few keystrokes. Autosave flushes its queue on unmount, when the window is hidden and on an explicit save, and the indicator no longer calls a document saved while a write is still queued.',
      },
      {
        kind: 'added',
        description:
          'Documents can be deleted — from a control on each sidebar row on web and desktop, and on Android from the document list, the editor header or a long press.',
      },
      {
        kind: 'fixed',
        description:
          'Keyboard shortcuts work. They were declared in the command registry and bound to nothing; keys now resolve through the registry, so a command unavailable in the current context cannot fire.',
      },
      {
        kind: 'fixed',
        description:
          'On Android, a title typed in the editor now appears in the document list. Each screen held its own copy of the list, so an edit reached the database but never the screen that had already loaded it.',
      },
    ],
  },
  {
    version: '1.1.6',
    date: '2026-08-26',
    summary: 'Noto for Android, published on the download page.',
    changes: [
      {
        kind: 'added',
        description:
          'An Android application for phones running Android 7.0 or later, published on the download page as a 16 MB APK — 64-bit, with a separate build for older 32-bit phones, signed with Noto’s own upload key. Documents are stored on the device, as on every other platform.',
      },
    ],
  },
  {
    version: '1.1.5',
    date: '2026-08-25',
    summary: 'The Android APK, published on the download page at last.',
    changes: [
      {
        kind: 'added',
        description:
          'The Android APK is published on the download page — a 16 MB 64-bit build, with a separate one for older 32-bit phones, signed with Noto’s own upload key.',
      },
      {
        kind: 'fixed',
        description:
          'Publishing waits for the mobile build instead of running as soon as the desktop packages are ready. The APK was being built correctly and then arriving too late to be attached, which is why 1.1.3 and 1.1.4 shipped without it.',
      },
      {
        kind: 'fixed',
        description:
          'Generating the native Android project no longer removes packages the rest of the build depends on, which had been hanging that step until the job timed out.',
      },
    ],
  },
  {
    version: '1.1.4',
    date: '2026-08-25',
    summary: 'The Android APK, signed with a real upload key and published on the download page.',
    changes: [
      {
        kind: 'added',
        description:
          'The Android APK is published on the download page — a 16 MB 64-bit build, with a separate one for older 32-bit phones. 1.1.3 shipped without it because the signing key was missing, and the pipeline correctly refused to publish an APK carrying the shared Android debug key.',
      },
    ],
  },
  // 1.1.2 has no entry because it has no release. It was tagged, its packaging
  // run was cancelled by a hung build, and nothing was ever published under it
  // — so listing it here would advertise a version with nothing to download.
  // Everything it promised ships in 1.1.3.
  {
    version: '1.1.3',
    date: '2026-08-25',
    summary: 'Noto for Android, published as an APK you can install from the download page.',
    changes: [
      {
        kind: 'added',
        description:
          'An Android application for phones running Android 7.0 or later, published on the download page as a 16 MB APK — 64-bit, with a separate build for older 32-bit phones. Documents are stored on the device, as on every other platform.',
      },
      {
        kind: 'fixed',
        description:
          'Android release builds are signed with a real upload key. The pipeline had been passing one through and nothing was reading it, so builds were signed with the shared Android debug key instead.',
      },
      {
        kind: 'fixed',
        description:
          'The download page only links files a release actually carries, rather than offering every platform for every version and occasionally pointing at a file that was never published.',
      },
      {
        kind: 'fixed',
        description:
          'A build that stops responding no longer costs a release. Packaging attempts are given a deadline and retried, and a genuinely broken build now fails loudly instead of being reported as cancelled. This is what stopped 1.1.2 from being published.',
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-08-15',
    summary: 'The first published release of Noto.',
    changes: [
      {
        kind: 'added',
        description:
          'Desktop applications for Windows, macOS and Linux, with automatic updates on Windows and macOS.',
      },
      {
        kind: 'added',
        description:
          'A web application that runs in the browser with nothing to install, and keeps working offline once loaded.',
      },
      {
        kind: 'added',
        description:
          'Local-first storage on every platform — SQLite on the desktop, IndexedDB in the browser. No account and no telemetry.',
      },
      {
        kind: 'added',
        description:
          'A rich text editor built on ProseMirror: headings, lists, quotes, code blocks and inline formatting, with autosave.',
      },
      {
        kind: 'added',
        description:
          'This website, with download, documentation and release pages, and a download page that resolves the latest release live.',
      },
      {
        kind: 'added',
        description:
          'The build and release pipeline: continuous integration, packaged installers for every desktop platform, and tag-driven GitHub Releases with checksums.',
      },
    ],
  },
];

/** True until the first version has actually been published. */
export const HAS_RELEASES = CHANGELOG.some((entry) => entry.date !== null);
