# Noto Design System --- UI & Visual Design Specification

**Product:** Noto\
**Document:** Design System & UI Guidelines\
**Version:** 1.0\
**Status:** Final Design Direction\
**Primary Experience:** Desktop-first, light theme\
**Platforms:** Desktop, Web, Mobile

------------------------------------------------------------------------

## 1. Design Direction

Noto should feel like a **calm, fast, modern writing workspace** rather
than a generic productivity dashboard.

### Core design principles

1.  **Writing first** --- content and editor remain the visual priority.
2.  **Clean and quiet** --- avoid excessive borders, gradients, shadows,
    and decoration.
3.  **Fast to understand** --- users should know where to write, search,
    save, and find information immediately.
4.  **Soft but professional** --- use restrained green accents with
    neutral surfaces.
5.  **Consistent** --- the same visual language must work across Home,
    Workspace, Documents, Memory, Search, Settings, and Account.
6.  **Information density with breathing room** --- support large
    amounts of content without making the UI feel crowded.
7.  **Progressive disclosure** --- advanced functionality should appear
    in menus, panels, dialogs, or contextual actions.
8.  **Local-first feeling** --- saving and sync states should always be
    understandable.

------------------------------------------------------------------------

# 2. Brand Theme

## Primary Brand Color

Noto uses a **deep emerald green** as the primary brand color.

  Token         Value       Usage
  ------------- ----------- -----------------------------
  Primary 50    `#F0FDF4`   Very light brand background
  Primary 100   `#DCFCE7`   Selected backgrounds
  Primary 200   `#BBF7D0`   Soft borders/highlights
  Primary 300   `#86EFAC`   Secondary emphasis
  Primary 400   `#4ADE80`   Interactive accents
  Primary 500   `#22C55E`   Main accent
  Primary 600   `#16A34A`   Primary buttons
  Primary 700   `#15803D`   Hover / strong accent
  Primary 800   `#166534`   Active/strong text
  Primary 900   `#14532D`   Deep brand tone

### Recommended primary UI color

**`#16A34A` --- Emerald 600**

Use this for:

-   Primary buttons
-   Active navigation
-   Selected states
-   Important icons
-   Links where appropriate
-   Save/sync success indicators
-   Brand highlights

Do not use the primary green everywhere. Most of the interface should
remain neutral.

------------------------------------------------------------------------

# 3. Neutral Color System

Noto should use warm-neutral whites and cool dark text.

  Token               Value       Usage
  ------------------- ----------- ------------------------
  White               `#FFFFFF`   Main cards/surfaces
  Background          `#FAFBFA`   Application background
  Surface             `#FFFFFF`   Cards
  Surface Secondary   `#F7F9F7`   Secondary panels
  Surface Tertiary    `#F1F4F1`   Inputs / subtle areas
  Border              `#E5E9E5`   Standard borders
  Border Strong       `#D5DBD5`   Strong dividers
  Text Primary        `#111827`   Headings/main text
  Text Secondary      `#4B5563`   Supporting text
  Text Tertiary       `#6B7280`   Metadata
  Text Disabled       `#9CA3AF`   Disabled controls

### Background rule

Prefer:

`#FAFBFA`

over pure white for the overall application background.

Use:

`#FFFFFF`

for cards, editor surfaces, dialogs, and focused content areas.

This creates subtle separation without heavy borders.

------------------------------------------------------------------------

# 4. Semantic Colors

Green is the Noto brand color. Other colors are reserved for meaning.

  Meaning   Color       Example
  --------- ----------- -------------------------------------
  Success   `#16A34A`   Saved, synced, completed
  Info      `#2563EB`   Links, informational messages
  Warning   `#D97706`   Storage warning, unsaved state
  Error     `#DC2626`   Delete, failure, destructive action
  Purple    `#7C3AED`   AI features
  Teal      `#0F766E`   Memory/capture secondary accent
  Orange    `#EA580C`   Clipboard/capture emphasis

### Important rule

Semantic colors should **not become additional brand colors**.

They are functional indicators only.

------------------------------------------------------------------------

# 5. AI Color

AI functionality should have a recognizable but subtle identity.

Recommended:

**AI Primary:** `#7C3AED`

Use for:

-   AI Assistant
-   AI Search
-   Smart Paste
-   AI Organization
-   AI-generated suggestions

Use a very light background such as:

`#F5F3FF`

Avoid large purple surfaces.

------------------------------------------------------------------------

# 6. Typography

## Primary font

Use:

**Inter**

Fallback:

``` text
Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
"Segoe UI", sans-serif
```

Inter should be used for:

-   Navigation
-   Buttons
-   Labels
-   Settings
-   Metadata
-   Dashboard UI
-   Document titles

## Editor typography

The editor may use:

**Inter**

or a readable document font depending on user preference.

Recommended default:

**Inter**

------------------------------------------------------------------------

# 7. Type Scale

  Style          Size   Weight   Line Height
  ------------ ------ -------- -------------
  Display        32px      700          40px
  H1             28px      700          36px
  H2             22px      650          30px
  H3             18px      600          26px
  H4             16px      600          24px
  Body Large     16px      400          26px
  Body           14px      400          22px
  Body Small     13px      400          20px
  Caption        12px      500          18px
  Button         14px      600          20px

### Text rule

Use typography hierarchy instead of color to create importance.

Do not make every heading green.

------------------------------------------------------------------------

# 8. Spacing System

Use an 8px spacing system.

``` text
4px   — micro spacing
8px   — icon/text spacing
12px  — compact spacing
16px  — standard spacing
20px  — control spacing
24px  — card padding
32px  — section spacing
40px  — major section spacing
48px  — page spacing
64px  — large layout spacing
```

### Default values

-   Card padding: **20--24px**
-   Page horizontal padding: **32px**
-   Section gap: **24px**
-   Form row gap: **16px**
-   Icon/text gap: **8px**
-   Navigation item height: **40--44px**

------------------------------------------------------------------------

# 9. Border Radius

Noto should use moderately rounded components.

  Component            Radius
  ------------------ --------
  Small controls          6px
  Inputs                  8px
  Buttons                 8px
  Cards                  12px
  Large panels           14px
  Dialogs                16px
  Floating windows       16px
  Pills / badges        999px

Avoid excessive "bubble UI".

------------------------------------------------------------------------

# 10. Shadows

Noto should use **very soft shadows**.

### Small

``` css
box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
```

### Medium

``` css
box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
```

### Dialog / Floating

``` css
box-shadow: 0 16px 40px rgba(15, 23, 42, 0.14);
```

### Rule

Prefer:

**border + subtle shadow**

over:

**large dark shadow**

------------------------------------------------------------------------

# 11. Application Layout

Noto desktop uses a consistent shell.

``` text
┌────────────────────────────────────────────────────────────┐
│                    Global Header                           │
├───────────────┬──────────────────────────────┬─────────────┤
│               │                              │             │
│   Sidebar     │       Main Content           │   Context   │
│               │                              │   Panel     │
│               │                              │             │
└───────────────┴──────────────────────────────┴─────────────┘
```

Not every screen needs all three columns.

### Sidebar

Recommended width:

**248px**

Collapsed:

**72px**

### Main content

Flexible.

### Context panel

Recommended:

**280--320px**

Use only when useful.

------------------------------------------------------------------------

# 12. Global Header

The global header should contain:

-   Search
-   Theme toggle
-   Notifications
-   Sync status where appropriate
-   Account/avatar

Recommended height:

**72px**

Search should be visually prominent but not oversized.

Example:

``` text
┌────────────────────────────────────────────┐
│ 🔍 Search everything in Noto...     Ctrl K │
└────────────────────────────────────────────┘
```

------------------------------------------------------------------------

# 13. Sidebar

The sidebar is consistent across all desktop screens.

``` text
Noto

+ New Document

Home
All Documents
Quick Notes
Noto Memory
Clipboard History
Search

────────────

PINNED
Project Roadmap
Daily Journal
Ideas

────────────

Quick Note

────────────

Synced
```

### Sidebar rules

-   Keep labels short.
-   Use icons consistently.
-   Active item gets a light green background.
-   Avoid dark full-height navigation.
-   Do not use excessive separators.
-   Keep the sidebar visually quiet.

### Active navigation

Background:

`#F0FDF4`

Text:

`#166534`

Icon:

`#15803D`

------------------------------------------------------------------------

# 14. Buttons

## Primary

Green filled button.

``` text
+ New Document
```

Style:

-   Background: `#16A34A`
-   Text: `#FFFFFF`
-   Radius: 8px
-   Height: 40px
-   Horizontal padding: 16px

Hover:

`#15803D`

## Secondary

White background with border.

## Ghost

Transparent.

Use for:

-   Toolbar controls
-   Navigation actions
-   Minor actions

## Destructive

Use:

`#DC2626`

Only for:

-   Delete
-   Permanent delete
-   Remove device
-   Reset destructive operations

------------------------------------------------------------------------

# 15. Inputs

Default:

-   Height: 40px
-   Radius: 8px
-   Border: `#E5E9E5`
-   Background: `#FFFFFF`
-   Text: `#111827`

Focus:

``` text
border: #16A34A
box-shadow: 0 0 0 3px #DCFCE7
```

Do not use thick focus borders.

------------------------------------------------------------------------

# 16. Cards

Noto cards should be:

-   White
-   Light border
-   12px radius
-   Minimal shadow
-   20--24px padding

``` text
┌──────────────────────────────────┐
│ Title                            │
│ Supporting information           │
│                                  │
│ Content                          │
└──────────────────────────────────┘
```

Avoid:

-   Heavy gradients
-   Thick colored borders
-   Excessive icons
-   Decorative backgrounds

------------------------------------------------------------------------

# 17. Document Cards

Document cards should emphasize:

1.  Document name
2.  Location
3.  Last modified
4.  Type
5.  Important state

Example:

``` text
📄 Project Roadmap                    Today, 9:41 AM
   Work / Planning
```

Actions should stay hidden behind:

`⋯`

until needed.

------------------------------------------------------------------------

# 18. Tabs

Workspace tabs should feel similar to a professional editor.

``` text
┌────────────────┐ ┌────────────────┐ ┌─────────────┐
│ Project Roadmap│ │ Meeting Notes  │ │ Ideas       │
│        ×       │ │        ×       │ │      ×      │
└────────────────┘ └────────────────┘ └─────────────┘
```

Active tab:

-   White background
-   Green top/bottom indicator
-   Stronger text

Inactive:

-   Transparent/light surface
-   Secondary text

Unsaved:

``` text
Project Roadmap ●
```

------------------------------------------------------------------------

# 19. Editor

The editor is the most important Noto surface.

It should feel:

**focused + spacious + distraction-free**

Recommended:

-   White editing canvas
-   720--850px comfortable text width
-   Large line height
-   Minimal toolbar
-   Sticky toolbar
-   Clear cursor
-   Subtle page metadata

Do not make the editor look like a form.

------------------------------------------------------------------------

# 20. Toolbar

Toolbar groups:

``` text
Paragraph
│
Bold Italic Underline
│
Link Image
│
Lists
│
Alignment
│
Code / Quote
│
More
```

Use icon buttons with tooltips.

Toolbar height:

**48px**

------------------------------------------------------------------------

# 21. Memory UI

Noto Memory uses cards rather than a traditional file table.

Memory types:

-   Note
-   Clipboard
-   Screenshot
-   Image
-   Link
-   File
-   Capture

Each type gets a small semantic icon/color.

Do not assign a different large card color to every type.

------------------------------------------------------------------------

# 22. Search UI

Search should feel like a **universal search engine for the user's
information**.

Top tabs:

``` text
All
Documents
Noto Memory
Clipboard
Images
Links
Files
```

Results should show:

-   Title
-   Matching text
-   Source
-   Date
-   Tags
-   Type
-   Actions

Matching terms should be highlighted with a subtle green background.

------------------------------------------------------------------------

# 23. Settings UI

Settings uses:

``` text
Category List | Setting Content | Context Cards
```

Categories:

-   General
-   Appearance
-   Editor
-   Files & Folders
-   Auto Save
-   Noto Memory
-   Clipboard
-   Shortcuts
-   AI Assistant
-   Privacy & Security
-   Sync & Backup
-   About Noto

The selected category uses the light green active state.

------------------------------------------------------------------------

# 24. Account & Devices

Account UI should prioritize:

-   Account information
-   Devices
-   Sessions
-   Security
-   Plan
-   Storage

Device rows should be simple.

``` text
💻 Windows Desktop
   Windows 11 • Noto Desktop
   This device
```

Do not overload device cards with unnecessary information.

------------------------------------------------------------------------

# 25. Status Indicators

### Synced

Green check:

``` text
✓ Synced
```

### Syncing

Use animated/subtle progress indicator:

``` text
↻ Syncing...
```

### Offline

Amber:

``` text
Offline • Changes saved locally
```

### Error

Red:

``` text
Sync failed • Retry
```

The user should always know whether their content is safely stored.

------------------------------------------------------------------------

# 26. Icons

Use one icon family throughout Noto.

Recommended:

**Lucide Icons**

Style:

-   20px standard
-   16px compact
-   24px feature icons
-   1.75--2px stroke

Avoid mixing icon styles.

------------------------------------------------------------------------

# 27. Illustration Style

Illustrations should be:

-   Minimal
-   Soft
-   Editorial
-   Writing-focused
-   Simple line/flat illustration

Examples:

-   Notebook
-   Pen
-   Paper
-   Desk
-   Small plant
-   Clipboard

Use illustrations primarily on:

-   Home
-   Empty states
-   Onboarding
-   First-use experiences

Do not place illustrations throughout every screen.

------------------------------------------------------------------------

# 28. Empty States

Example:

``` text
             [small illustration]

             No documents yet

      Create your first document
      and start writing.

          + New Document
```

Keep empty states simple.

------------------------------------------------------------------------

# 29. Loading States

Use skeletons instead of large spinners.

Example:

``` text
████████████████████
██████████

████████████████
██████████████████████
```

Use spinners only for short operations.

------------------------------------------------------------------------

# 30. Error States

Errors should explain:

1.  What happened
2.  Whether data is safe
3.  What the user can do

Example:

``` text
Couldn't sync right now

Your changes are saved locally.
We'll retry automatically.

[Retry]
```

------------------------------------------------------------------------

# 31. Toasts

Use short messages.

Good:

``` text
Document saved
```

``` text
Copied to clipboard
```

``` text
Version restored
```

Avoid:

``` text
Your document has successfully
been saved to the local database...
```

------------------------------------------------------------------------

# 32. Context Menus

Use context menus for secondary actions.

Document:

``` text
Open
Open in New Tab
Rename
Duplicate
Move
Pin
Export
Delete
```

Tab:

``` text
Close
Close Others
Close Left
Close Right
Pin Tab
Duplicate
Restore
```

------------------------------------------------------------------------

# 33. Dialogs

Dialogs should be compact.

Use them for:

-   Rename
-   Delete confirmation
-   Import
-   Export
-   Create folder
-   Restore version
-   Device removal

Do not use dialogs for normal navigation.

------------------------------------------------------------------------

# 34. Command Palette

Shortcut:

``` text
Ctrl / Cmd + Shift + P
```

UI:

``` text
┌──────────────────────────────────────────────┐
│ Search commands...                           │
├──────────────────────────────────────────────┤
│ + New Document                       Ctrl N   │
│ Quick Note                           Ctrl...  │
│ Search Memory                                 │
│ Open Settings                                 │
│ Toggle Sidebar                                │
└──────────────────────────────────────────────┘
```

The command palette should feel fast and keyboard-first.

------------------------------------------------------------------------

# 35. Quick Note

Quick Note is a floating lightweight editor.

``` text
┌────────────────────────────────┐
│ Quick Note                 ×   │
├────────────────────────────────┤
│                                │
│ Start typing...                │
│                                │
├────────────────────────────────┤
│ Saved locally        Save      │
└────────────────────────────────┘
```

It should open instantly.

------------------------------------------------------------------------

# 36. Quick Paste

Quick Paste should be a compact launcher.

``` text
┌──────────────────────────────────┐
│ Search memory to paste...        │
├──────────────────────────────────┤
│ 📋 Angular upload solution       │
│ 📋 API endpoint                  │
│ 🔗 Documentation                 │
│ 📝 Meeting notes                 │
└──────────────────────────────────┘
```

Keyboard navigation is essential.

------------------------------------------------------------------------

# 37. Responsive Design

## Desktop

Full experience:

``` text
Sidebar + Main + Context Panel
```

## Tablet

``` text
Collapsed Sidebar + Main
```

Context panels become overlays.

## Mobile

Use:

``` text
Top Bar
Content
Bottom Navigation
```

Navigation should not simply shrink the desktop UI.

------------------------------------------------------------------------

# 38. Dark Theme

The light theme is the primary design direction.

Dark mode should use the same semantic system.

Suggested dark tokens:

  Token               Value
  ------------------- -----------
  Background          `#0F1411`
  Surface             `#151B17`
  Surface Secondary   `#1B231E`
  Border              `#28332C`
  Text Primary        `#F3F4F6`
  Text Secondary      `#A7B0AA`
  Primary             `#22C55E`
  Primary Strong      `#4ADE80`

Do not simply invert the light theme.

------------------------------------------------------------------------

# 39. Accessibility

Noto must support:

-   Keyboard navigation
-   Visible focus states
-   Screen-reader labels
-   Minimum accessible touch target: 44px
-   Sufficient text contrast
-   No color-only meaning
-   Reduced motion
-   High zoom
-   Clear disabled states

------------------------------------------------------------------------

# 40. Motion

Noto should feel fast.

Recommended animation duration:

``` text
Fast:     100–150ms
Normal:   150–200ms
Complex:  200–300ms
```

Use motion for:

-   Sidebar expansion
-   Dialog opening
-   Panel transitions
-   Dropdowns
-   Toasts
-   Drag/drop feedback

Avoid decorative animations.

------------------------------------------------------------------------

# 41. Desktop Window Behavior

Desktop Noto should support:

-   Resizable windows
-   Minimum usable window size
-   Floating Noto
-   Always-on-top PIP
-   Smart Sidebar
-   System tray
-   Global shortcuts

The UI should remain usable when the window becomes narrow.

------------------------------------------------------------------------

# 42. Design Tokens

Recommended implementation structure:

``` text
design-system/
│
├── tokens/
│   ├── colors
│   ├── typography
│   ├── spacing
│   ├── radius
│   ├── shadows
│   ├── motion
│   └── breakpoints
│
├── components/
│   ├── Button
│   ├── Input
│   ├── Select
│   ├── Dialog
│   ├── Menu
│   ├── Tabs
│   ├── Sidebar
│   ├── Card
│   ├── Badge
│   ├── Toast
│   ├── Tooltip
│   ├── Search
│   └── CommandPalette
│
└── patterns/
    ├── Workspace
    ├── Documents
    ├── Memory
    ├── Search
    ├── Settings
    └── Account
```

------------------------------------------------------------------------

# 43. Tailwind Direction

Use semantic tokens rather than hard-coded colors throughout the
application.

Example:

``` text
bg-background
bg-surface
bg-surface-secondary

text-primary
text-secondary
text-tertiary

border-default
border-strong

text-brand
bg-brand
bg-brand-soft
```

Avoid repeatedly writing raw values such as:

``` text
bg-[#16A34A]
text-[#111827]
```

Create Noto design tokens and consume those tokens everywhere.

------------------------------------------------------------------------

# 44. Component States

Every interactive component should define:

``` text
Default
Hover
Active
Focus
Selected
Disabled
Loading
Error
```

Example button:

``` text
Default → Hover → Active → Disabled
```

Do not design only the default state.

------------------------------------------------------------------------

# 45. Product-Specific Rules

### Rule 1

**Content beats chrome.**

The user's document should always have more visual importance than the
application controls.

### Rule 2

**Green is an accent, not a background.**

Use green selectively.

### Rule 3

**One action, one clear hierarchy.**

Primary actions should be obvious.

### Rule 4

**Advanced features stay contextual.**

AI, versioning, export, and tab controls should not overwhelm the main
workspace.

### Rule 5

**Search is universal.**

Users should be able to find documents, notes, clipboard content,
screenshots, links, and memory from one search experience.

### Rule 6

**Memory is a first-class feature.**

Noto Memory should feel like a core product area, not an attachment to
the notes system.

### Rule 7

**Keyboard-first on desktop.**

Shortcuts should be available for frequently repeated actions.

### Rule 8

**Offline state must be visible but quiet.**

Do not interrupt the user for normal offline operation.

------------------------------------------------------------------------

# 46. Screen-Level Visual Rules

## Home

Focus:

**Start writing**

Primary elements:

-   New Document
-   Open Document
-   Quick Note
-   Quick Paste
-   Recent Documents
-   Continue Writing

------------------------------------------------------------------------

## Workspace / Editor

Focus:

**Writing**

Primary elements:

-   Tabs
-   Editor
-   Formatting toolbar
-   Outline
-   Document information
-   Save state

------------------------------------------------------------------------

## Documents

Focus:

**Manage**

Primary elements:

-   Documents
-   Folders
-   Recent
-   Starred
-   Trash
-   Import
-   Export
-   New Document

------------------------------------------------------------------------

## Noto Memory

Focus:

**Remember**

Primary elements:

-   Search
-   Memory types
-   Cards
-   Filters
-   Tags
-   Pinning
-   Storage summary

------------------------------------------------------------------------

## Search

Focus:

**Find**

Primary elements:

-   Universal search
-   Result categories
-   Top matches
-   Filters
-   Result ranking
-   AI summary

------------------------------------------------------------------------

## Settings

Focus:

**Customize**

Primary elements:

-   Categories
-   Preferences
-   Save/reset
-   Account/storage context

------------------------------------------------------------------------

## Account & Devices

Focus:

**Identity & Sync**

Primary elements:

-   Account
-   Devices
-   Sessions
-   Security
-   Plan
-   Storage

------------------------------------------------------------------------

# 47. Final Noto Visual Identity

The final visual language should be:

``` text
Noto
│
├── Emerald Green
│   └── Brand / Primary actions
│
├── Warm White
│   └── Main workspace
│
├── Soft Gray
│   └── Structure / secondary UI
│
├── Dark Navy-Gray
│   └── Primary typography
│
├── Purple
│   └── AI
│
└── Semantic Colors
    ├── Blue → Information
    ├── Amber → Warning
    └── Red → Destructive
```

### Overall visual target

**Minimal + calm + professional + writing-focused + fast +
intelligent.**

Noto should look like a product that users can comfortably keep open all
day.

------------------------------------------------------------------------

# 48. Final Design Checklist

Before approving any Noto screen:

-   [ ] Uses Noto emerald brand system
-   [ ] Background is neutral
-   [ ] Green is used selectively
-   [ ] Typography hierarchy is clear
-   [ ] Spacing follows 8px system
-   [ ] Cards use subtle borders/shadows
-   [ ] Icons use one consistent family
-   [ ] Primary action is obvious
-   [ ] Secondary actions are quiet
-   [ ] Content has visual priority
-   [ ] Empty state exists
-   [ ] Loading state exists
-   [ ] Error state exists
-   [ ] Keyboard interaction is considered
-   [ ] Responsive behavior is defined
-   [ ] Dark mode mapping is defined
-   [ ] Accessibility states are defined

------------------------------------------------------------------------

## Final Design Principle

> **Noto should disappear behind the user's work.**

The interface should make writing, capturing, remembering, searching,
and reusing information feel immediate and effortless.

**Primary visual direction: Emerald + Neutral White + Soft Gray + Dark
Text, with Purple reserved for AI.**
