# Update channels and auto-update

## How desktop updates work

```text
User opens Noto
       │
       ▼
Check the update feed
       │
   New version?
   ┌───┴───┐
  No      Yes
   │       │
   ▼       ▼
Continue  Download in the background
             │
             ▼
      "A new version is ready"
             │
             ▼
      Applied on the next restart
```

Noto uses Electron's built-in `autoUpdater` through
[`update-electron-app`](https://github.com/electron/update-electron-app),
pointed at `update.electronjs.org` — the free service Electron operates for
public GitHub repositories that publish their builds to GitHub Releases.

**There is no Noto update server, and there should not be one yet.** A custom
update server is worth building only when Noto needs something the service
cannot do: staged rollouts, percentage releases, private or enterprise channels,
custom update policies, or regional releases.

The implementation is [`apps/desktop/src/main/updater.ts`](../../apps/desktop/src/main/updater.ts).

## Platform support

| Platform | Auto-update | How updates arrive                                                 |
| -------- | ----------- | ------------------------------------------------------------------ |
| Windows  | Yes         | Squirrel.Windows, via the `RELEASES` feed and `.nupkg`             |
| macOS    | Yes         | Squirrel.Mac, via the release `.zip` — **requires a signed build** |
| Linux    | No          | Replace the AppImage, or update the `.deb` / `.rpm`                |

Electron's `autoUpdater` supports Windows and macOS only. On Linux, updating is
the distribution's job, and treating it otherwise fights the package manager.
The updater detects Linux and exits early with a log line rather than failing.

macOS auto-update needs the application to be code-signed. An unsigned macOS
build installs and runs, but will not update itself.

### Windows and multiple architectures

Squirrel.Windows drives updates from a single `RELEASES` manifest at the root of
the release, and two architectures cannot both own that file. Only the **x64**
build contributes `RELEASES` and its `.nupkg`; ARM64 is published as an
installer download and does not auto-update. `scripts/collect-desktop-artifacts.mjs`
enforces this.

## Channels

| Channel | Tag                | GitHub     | Auto-update source                  |
| ------- | ------------------ | ---------- | ----------------------------------- |
| Stable  | `v1.0.0`           | Latest     | `update.electronjs.org`             |
| Beta    | `v1.1.0-beta.1`    | Prerelease | A static feed, if one is configured |
| Nightly | `v1.2.0-nightly.1` | Prerelease | A static feed, if one is configured |

Users default to **stable** and stay there unless they choose otherwise.

`update.electronjs.org` serves whatever GitHub marks as the latest release,
which by definition is stable. Beta and nightly therefore need their own feed:

```bash
NOTO_UPDATE_CHANNEL=beta
NOTO_UPDATE_FEED_URL=https://updates.example.com
```

The updater then reads from
`$NOTO_UPDATE_FEED_URL/<channel>/<platform>/<arch>`. Until such a feed is
published, a beta or nightly build simply does not update itself and logs why —
which is the correct behaviour, rather than silently pulling a stable build over
a prerelease.

## Environment variables

| Variable               | Default  | Effect                                              |
| ---------------------- | -------- | --------------------------------------------------- |
| `NOTO_UPDATE_CHANNEL`  | `stable` | Which channel this installation follows             |
| `NOTO_UPDATE_FEED_URL` | unset    | Base URL of a static update feed for beta / nightly |

## When updating is skipped

The updater exits early, with a log line, when:

- the build is not packaged (`pnpm dev:desktop`) — there is nothing to replace;
- the platform is Linux;
- a non-stable channel is selected with no feed configured.

A failed update check never prevents Noto from opening.
