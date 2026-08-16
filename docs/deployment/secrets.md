# Secrets and variables

Everything the pipeline needs that cannot live in the repository. Configure
under **Settings → Secrets and variables → Actions**.

None of these are required to get a green CI run. Each one unlocks a stage, and
the stage it unlocks either skips itself with a warning or produces an unsigned
build without it. That is deliberate: a fork should be able to build Noto
without asking anyone for credentials.

## Variables

| Variable              | Default | Effect                                        |
| --------------------- | ------- | --------------------------------------------- |
| `NOTO_RELEASE_SIGN`   | `false` | Sign and notarize desktop packages on release |
| `NOTO_RELEASE_MOBILE` | `false` | Include mobile builds in the release          |

## Secrets

### Website and web application

**None.** The website and web application are Cloudflare Workers projects
connected directly to this repository through Workers Builds, so Cloudflare
checks out the commit and deploys it itself. GitHub never needs a Cloudflare
credential, and `web.yml` only builds.

See [website deployment](website.md).

### Windows signing

| Secret                         | Needed for           | Without it         |
| ------------------------------ | -------------------- | ------------------ |
| `WINDOWS_CERTIFICATE_BASE64`   | Authenticode signing | Unsigned installer |
| `WINDOWS_CERTIFICATE_PASSWORD` | Authenticode signing | Unsigned installer |

### macOS signing and notarization

| Secret                        | Needed for   | Without it                       |
| ----------------------------- | ------------ | -------------------------------- |
| `APPLE_CERTIFICATE_BASE64`    | Code signing | Unsigned build; no auto-update   |
| `APPLE_CERTIFICATE_PASSWORD`  | Code signing | Unsigned build; no auto-update   |
| `APPLE_IDENTITY`              | Code signing | Unsigned build; no auto-update   |
| `APPLE_ID`                    | Notarization | Gatekeeper warns on first launch |
| `APPLE_APP_SPECIFIC_PASSWORD` | Notarization | Gatekeeper warns on first launch |
| `APPLE_TEAM_ID`               | Notarization | Gatekeeper warns on first launch |

See [code signing](code-signing.md).

### Android

| Secret                      | Needed for         | Without it                         |
| --------------------------- | ------------------ | ---------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | Play Store uploads | Debug-signed build, not uploadable |
| `ANDROID_KEYSTORE_PASSWORD` | Play Store uploads | Debug-signed build, not uploadable |
| `ANDROID_KEY_ALIAS`         | Play Store uploads | Debug-signed build, not uploadable |
| `ANDROID_KEY_PASSWORD`      | Play Store uploads | Debug-signed build, not uploadable |

### iOS

iOS release signing needs an Apple Developer account, provisioning profiles and
a distribution certificate. The mobile workflow currently produces an **unsigned
archive**, which proves the project builds but cannot be uploaded to TestFlight
or the App Store. Signed iOS builds are Phase 7 work.

## Encoding a file as a secret

GitHub Actions secrets are text. Binary credentials go in base64:

```bash
base64 -w 0 certificate.pfx      # Linux
base64 -i certificate.p12        # macOS
```

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx"))
```

## Rules

- Signing credentials are **never** committed to Git.
- Workflows write them to the runner's temporary directory, never into the
  repository checkout, and delete them in an `always()` step.
- Rotate a secret immediately if it appears in a log. Actions masks secret
  values, but masking is a safety net, not a guarantee.
