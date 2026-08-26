# Brand assets

Two source files, and everything else in the repository derived from them.

| Source              | What it is                                                        |
| ------------------- | ----------------------------------------------------------------- |
| `noto-icon.png`     | The app mark — a rounded square, transparent outside it.          |
| `noto-wordmark.png` | The mark set beside the word, for places wide enough to carry it. |

Replace a source, then regenerate:

```sh
python scripts/generate-brand-assets.py
```

Pillow is the only requirement (`pip install pillow`). It runs by hand rather
than as part of `turbo build`, because the artwork changes about as often as
the logo does; the outputs below are committed.

| Output                                     | Used by                                        |
| ------------------------------------------ | ---------------------------------------------- |
| `apps/web/public/favicon.ico`              | Browser tab — 16, 32 and 48 in one file        |
| `apps/web/public/apple-touch-icon.png`     | iOS home screen                                |
| `apps/web/public/icon-{192,512}.png`       | `site.webmanifest`, so an install has an icon  |
| `apps/website/public/favicon.ico`          | Browser tab                                    |
| `apps/website/public/apple-touch-icon.png` | iOS home screen                                |
| `apps/website/public/social-card.png`      | `og:image` and `twitter:image`                 |
| `apps/desktop/assets/icon.ico`             | Windows executable and Squirrel installer      |
| `apps/desktop/assets/icon.icns`            | macOS bundle and DMG volume                    |
| `apps/desktop/assets/icon.png`             | Linux packages, and the window icon at runtime |
| `apps/mobile/assets/icon.png`              | Expo `icon` — iOS, and the Android legacy icon |
| `apps/mobile/assets/adaptive-icon.png`     | Expo `android.adaptiveIcon.foregroundImage`    |
| `packages/ui/src/assets/noto-icon.png`     | The collapsed sidebar rail                     |
| `packages/ui/src/assets/noto-wordmark.png` | The sidebar header                             |

Two of these are deliberately flattened. The App Store rejects an icon with an
alpha channel, and a home-screen icon with transparent corners is composited
onto black, so the mobile icon and the Apple touch icon are overscaled until
the artwork's own rounded corners fall outside the canvas. Everything else
keeps its transparency.
