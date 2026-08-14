# Code signing

Windows and macOS both apply security checks to unsigned software. Signing is
not optional for a serious public desktop release — but it is also not something
ordinary development should ever need.

```text
Development                 Production
     │                           │
     ▼                           ▼
  Unsigned                    Signed
     │                           │
     ▼                           ▼
Local testing            Notarized where required
                                 │
                                 ▼
                          Public release
```

**Signing credentials are never committed to Git.** They live in GitHub Actions
secrets, are written to the runner's temporary directory during a build, and are
deleted afterwards.

## Turning signing on

Signing is opt-in and off by default. `forge.config.ts` enables the signing and
notarization hooks only when `NOTO_SIGN=true` _and_ the relevant credentials are
present, so a build with no certificates simply produces unsigned packages
rather than failing.

To sign releases, set the repository variable:

```text
NOTO_RELEASE_SIGN = true
```

and add the secrets below. To sign a one-off build, run the **Desktop** workflow
manually with the `sign` input checked.

## Windows

Authenticode signing. Until an installer has built up reputation with Microsoft
SmartScreen, Windows warns about it on download; signing is what starts that
reputation accruing.

| Secret                         | What it is                             |
| ------------------------------ | -------------------------------------- |
| `WINDOWS_CERTIFICATE_BASE64`   | The `.pfx` certificate, base64-encoded |
| `WINDOWS_CERTIFICATE_PASSWORD` | Its password                           |

```bash
base64 -w 0 certificate.pfx > certificate.b64
```

```text
GitHub Actions
      ↓
Windows build
      ↓
Authenticode signing (timestamped)
      ↓
Signed installer
      ↓
GitHub Release
```

The build timestamps the signature against DigiCert's timestamp server, so
installers stay valid after the certificate expires.

Certificates are issued to a verified organisation or individual by a
certificate authority. An OV certificate is the cheaper option; an EV
certificate clears SmartScreen faster.

## macOS

macOS distribution requires code signing, and public distribution should also
use Apple's notarization process. Both require **Apple Developer Program
enrollment**, and notarization requires macOS with Xcode tooling — which is why
the release workflow builds macOS on a macOS runner.

| Secret                        | What it is                                                  |
| ----------------------------- | ----------------------------------------------------------- |
| `APPLE_CERTIFICATE_BASE64`    | Developer ID Application certificate `.p12`, base64-encoded |
| `APPLE_CERTIFICATE_PASSWORD`  | Its password                                                |
| `APPLE_IDENTITY`              | e.g. `Developer ID Application: Your Name (TEAMID)`         |
| `APPLE_ID`                    | The Apple ID used for notarization                          |
| `APPLE_APP_SPECIFIC_PASSWORD` | An app-specific password, not the account password          |
| `APPLE_TEAM_ID`               | Your 10-character team identifier                           |

```text
Build
 ↓
Apple code signing (hardened runtime)
 ↓
Notarization
 ↓
DMG
 ↓
GitHub Release
```

The workflow imports the certificate into a temporary keychain, builds, and
removes it afterwards.

### Entitlements

[`apps/desktop/packaging/entitlements.mac.plist`](../../apps/desktop/packaging/entitlements.mac.plist)
grants the JIT entitlements the hardened runtime requires. Chromium compiles
JavaScript at runtime and maps that memory as executable, which the hardened
runtime forbids by default — without these entitlements, a notarized Noto
crashes on launch.

### macOS signing and auto-update

Squirrel.Mac will not apply an update to an unsigned application. An unsigned
macOS build installs and runs, but never updates itself. Signing macOS is
therefore a prerequisite for macOS auto-update, not just for a cleaner first
launch.

## Linux

No signing. Distribution package managers have their own trust model, and the
AppImage is verified through the published checksums instead.

## Verifying a release without certificates

Every release publishes `SHA256SUMS.txt`, generated from the artifacts the
pipeline actually built:

```bash
sha256sum --check --ignore-missing SHA256SUMS.txt
```

This is not a substitute for signing, but it does let anyone confirm the file
they downloaded is the file that was built.
