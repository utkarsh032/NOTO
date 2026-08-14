# Cutting a release

> **One version tag is enough to start the release process.**

Everything below the tag is automated. Everything above it — deciding the
version, writing the notes, getting the code onto `main` — is deliberate human
work.

## Versioning

Noto follows [Semantic Versioning](https://semver.org).

```text
MAJOR.MINOR.PATCH
  │     │     └── backwards-compatible bug fixes
  │     └──────── backwards-compatible new functionality
  └────────────── breaking changes
```

During early development, stay on `0.x.x`. The first stable public release is
`1.0.0`.

Prerelease identifiers select the update channel — see
[update channels](update-channels.md):

```text
v1.0.0            stable
v1.1.0-beta.2     beta
v1.2.0-nightly.7  nightly
```

Every release-facing manifest carries the same version: the root `package.json`,
each of the four apps, and `apps/mobile/app.json`. `scripts/version.mjs` keeps
them in step and the release workflow refuses a tag that disagrees with them.

## Preparing

```bash
git checkout dev && git pull
pnpm release:prepare 1.0.0
```

That sets the version everywhere, derives the Android `versionCode` and iOS
`buildNumber`, and creates `docs/releases/1.0.0.md` if it does not exist. It
does not commit, tag or push — the notes need writing first.

Then, by hand:

1. **Write `docs/releases/1.0.0.md`.** This becomes the top of the GitHub
   Release body. Highlights, improvements, bug fixes — in your own words.
2. **Add the entry to `apps/website/src/content/changelog.ts`**, so the website
   changelog matches.
3. **Open a pull request** from `release/1.0.0` into `main`.

```bash
git checkout -b release/1.0.0
git commit -am "chore(release): 1.0.0"
git push -u origin release/1.0.0
```

## Releasing

Once the pull request is merged and CI is green on `main`:

```bash
git checkout main
git pull

git tag v1.0.0
git push origin v1.0.0
```

That is the whole release command. The tag triggers
`.github/workflows/release.yml`.

## What the pipeline does

```text
v1.0.0
   │
   ▼
prepare      parse the tag → version, channel, prerelease
             check the manifests agree with the tag
             check the tag is an ancestor of main
             check no release already exists for it
   │
   ▼
verify       format · lint · typecheck · test · build · e2e
   │
   ├────────────────┬──────────────────┬─────────────────┐
   ▼                ▼                  ▼                 ▼
desktop           web                mobile          (skipped unless
win x64/arm64   website +          android aab/apk   NOTO_RELEASE_MOBILE
mac x64/arm64   web app to         ios archive        is set)
linux x64       Cloudflare Pages
   │
   ▼
publish      collect every artifact
             generate SHA256SUMS.txt
             compose the release body from docs/releases/<version>.md
             append GitHub's generated changelog
             create the GitHub Release and upload the assets
```

## Assets published

```text
Noto-1.0.0-win-x64.exe            Noto-1.0.0-mac-arm64.dmg
Noto-1.0.0-win-arm64.exe          Noto-1.0.0-mac-x64.dmg
noto-1.0.0-full.nupkg             Noto-1.0.0-mac-arm64.zip
RELEASES                          Noto-1.0.0-mac-x64.zip

Noto-1.0.0-linux-x64.AppImage     SHA256SUMS.txt
Noto-1.0.0-linux-x64.deb
Noto-1.0.0-linux-x64.rpm
```

The `.nupkg` and `RELEASES` files are Squirrel's Windows update feed, and the
macOS `.zip` files are Squirrel.Mac's update payload. They are not downloads for
users, but removing them breaks auto-update.

GitHub Releases accepts assets up to 2 GiB each and 1,000 per release, so this
is comfortably within what the free tier allows.

## Tags are immutable

A published version number is never reused. If a release is wrong, publish a
patch version; do not move the tag. The `prepare` job fails if a release already
exists for the tag.

## Releasing a prerelease

Identical, with a prerelease tag:

```bash
git tag v1.1.0-beta.1
git push origin v1.1.0-beta.1
```

The release is marked as a prerelease, is not marked "latest", and the ancestor
check against `main` is skipped so betas can be cut from `dev` or a release
branch.

## Hotfixes

```bash
git checkout -b hotfix/1.0.1 main
# fix, then:
pnpm release:prepare 1.0.1
# pull request into main, merge, then:
git tag v1.0.1 && git push origin v1.0.1
```

Merge the hotfix back into `dev` afterwards.

## Rebuilding a release by hand

`release.yml` can also be dispatched manually against an existing tag. It
defaults to creating a **draft** release in that mode, so a manual run cannot
publish over a real one by accident.
