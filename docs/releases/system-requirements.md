# System requirements

These are starting figures for a desktop application of Noto's shape. They
should be revised against measurements from real installations rather than left
as permanent guesses.

The canonical copy is
[`packages/config/src/release.ts`](../../packages/config/src/release.ts), which
is what the website and the release notes render. Update it there.

## Windows

```text
Operating system   Windows 10 or later
Architecture       x64 or ARM64
Memory             4 GB minimum
Storage            500 MB or more
Display            1280 × 720 minimum
```

ARM64 builds are installer-only and do not auto-update; see
[update channels](update-channels.md).

## macOS

```text
Operating system   A supported modern macOS version
Architecture       Apple Silicon or Intel
Memory             4 GB minimum
Storage            500 MB or more
```

## Linux

```text
Architecture       x64
Memory             4 GB minimum
Storage            500 MB or more
Desktop            A glibc-based distribution with a graphical session
```

Published as an AppImage, a `.deb` and an `.rpm`. Other architectures are not
built.

## Web

```text
Browser            A current version of Chrome, Edge, Firefox or Safari
Storage            IndexedDB enabled
```

Noto stores documents in the browser. Private browsing modes often restrict
IndexedDB, and documents written in a private window will not survive it
closing.

## Android and iOS

Not published yet. Requirements will be set when the mobile applications reach
the stores.

## What the storage figure covers

The application itself. Documents are stored separately and grow with what you
write — a large library of text documents is still measured in megabytes.
