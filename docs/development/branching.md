# Branching and workflow

Noto uses a small branch model. More branches than this is overhead, not
process.

```text
main            production-ready code; every tag is cut from here
 │
dev             integration branch for the next release
 │
feature/*       individual pieces of work
release/*       release preparation
hotfix/*        urgent fixes to what is already released
```

> The plan document calls the integration branch `develop`. This repository
> uses **`dev`**, and the workflows are configured for that name.

## The normal path

```text
feature/editor-tabs
        │
        ▼
   pull request ──▶ CI: lint · typecheck · test · build
        │
        ▼
       dev  ──▶ staging deployment (Cloudflare Workers preview)
        │
        ▼
  release/1.1.0  ──▶ pull request into main
        │
        ▼
       main  ──▶ git tag v1.1.0  ──▶ the release pipeline
```

### `feature/*`

One branch per piece of work, branched from `dev` and merged back into it.

```text
feature/editor
feature/tabs
feature/find-replace
feature/clipboard-history
feature/file-system
```

### `release/*`

Branched from `dev` when a release is being prepared. This is where the version
bump, the release notes and the changelog entry go — see
[cutting a release](../releases/README.md).

```text
release/1.0.0
```

Only fixes go onto a release branch. New features wait for the next one.

### `hotfix/*`

Branched from `main` for an urgent fix to something already released, merged
into both `main` and `dev` so the fix is not lost at the next release.

```text
hotfix/1.0.1
```

## Pull requests

Every change reaches `main` and `dev` through a pull request. A pull request
that fails CI is not merged; the failure is fixed rather than bypassed.

Title pull requests in Conventional Commit form — the title is what appears in
the generated release notes:

```text
feat(editor): add find and replace
fix(desktop): restore tabs after an update
chore(ci): cache the pnpm store
```

## Branch protection

Configure this on GitHub; it cannot be set from the repository. For both `main`
and `dev`:

- Require a pull request before merging.
- Require the `Lint, typecheck and test` and `Build` status checks to pass.
- Require branches to be up to date before merging.
- Do not allow force pushes or deletions.

On `main`, additionally require a review before merging.

## Tags

Tags are the release trigger and are treated as immutable. A published version
number is never reused, and a mistake is corrected by releasing a new patch
version rather than by moving a tag. The release workflow refuses to run against
a tag that already has a release.
