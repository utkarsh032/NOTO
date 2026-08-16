# Continuous integration

All CI runs on GitHub Actions. Public repositories use GitHub-hosted standard
runners without Actions usage charges; private repositories on GitHub Free get
2,000 minutes a month, 500 MB of artifact storage and 10 GB of cache. The
workflows below are shaped around not wasting that.

## The workflows

| File                            | Trigger                                     | What it does                                              |
| ------------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| `.github/workflows/ci.yml`      | Pull requests and pushes to `main` / `dev`  | Format, lint, typecheck, unit tests, build; e2e on demand |
| `.github/workflows/web.yml`     | Pushes touching web code; called by release | Builds the website and web app (Cloudflare deploys them)  |
| `.github/workflows/desktop.yml` | Manual; called by release                   | Packages Windows, macOS and Linux                         |
| `.github/workflows/mobile.yml`  | Manual; called by release (opt-in)          | Builds Android and iOS                                    |
| `.github/workflows/release.yml` | Pushing a `v*` tag                          | Orchestrates everything and publishes the release         |

`.github/actions/setup` is the composite action they all start with: it installs
pnpm at the version pinned in `packageManager`, installs Node with a pnpm store
cache, runs `pnpm install --frozen-lockfile`, and restores the Turborepo cache.

## What runs when

Not every platform is built on every commit — that is the difference between
staying inside the free tier and not.

```text
Pull request        format · lint · typecheck · test · build
                    (e2e only when labelled `run-e2e`)

Push to dev         the above, plus e2e
                    plus staging deployment of the website and web app

Push to main        the above, plus production deployment

Tag v*              the above, plus Windows, macOS and Linux packaging,
                    plus mobile when enabled, plus the GitHub Release
```

Desktop packaging is the expensive part — five matrix jobs across three
operating systems — and it only runs for a release or when someone asks for it
by hand.

## Caching

Two caches do the work:

- **pnpm store**, via `actions/setup-node`'s `cache: pnpm`. Keyed on the
  lockfile.
- **Turborepo**, at `.turbo`. Keyed on the lockfile and the commit, falling back
  to the most recent cache for the same lockfile.

A dependency change invalidates both, which is the intent: a stale cache that
survives a dependency bump is worse than no cache.

## Concurrency

Pull request runs are cancelled when a new commit is pushed to the same branch.
Runs on `main` and `dev` are not cancelled — every commit on an integration
branch gets a real verdict. Release runs are never cancelled.

## Repository variables

Set under **Settings → Secrets and variables → Actions → Variables**:

| Variable              | Default | Effect                                        |
| --------------------- | ------- | --------------------------------------------- |
| `NOTO_RELEASE_SIGN`   | `false` | Sign and notarize desktop packages on release |
| `NOTO_RELEASE_MOBILE` | `false` | Include mobile builds in the release          |

There are no Cloudflare variables or secrets here. Cloudflare Workers Builds
deploys the website and web app straight from Git — see
[deployment/website.md](../deployment/website.md).

Secrets are listed in [deployment/secrets.md](../deployment/secrets.md).

## Running CI locally

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

That is the `verify` and `build` jobs, in order.
