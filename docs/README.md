# Noto documentation

Documentation lives in the repository, next to the code it describes.

| Section                        | What it covers                                                |
| ------------------------------ | ------------------------------------------------------------- |
| [architecture/](architecture/) | How Noto is put together and why                              |
| [development/](development/)   | Working on Noto: setup, branching, CI                         |
| [releases/](releases/)         | Versioning, cutting a release, update channels, release notes |
| [deployment/](deployment/)     | Where things are deployed, and the secrets that make it work  |

The plan these follow is [`R&D/Build&Release.md`](../R&D/Build&Release.md).

## Quick reference

```bash
pnpm install              # install the workspace
pnpm dev:web              # web application        → http://localhost:5173
pnpm dev:website          # public website         → http://localhost:5174
pnpm dev:desktop          # desktop application
pnpm dev:mobile           # mobile application

pnpm lint                 # everything CI checks, locally
pnpm typecheck
pnpm test
pnpm build

pnpm package:desktop      # build installers for this machine's platform
pnpm release:prepare 1.0.0
```

## The shape of the pipeline

```text
feature/*  ─┐
            ├─▶ pull request ─▶ CI (lint · typecheck · test · build)
hotfix/*   ─┘                        │
                                     ▼
                                    dev ─▶ staging deployment
                                     │
                                     ▼
                              release/x.y.z ─▶ main ─▶ git tag vX.Y.Z
                                                          │
                        ┌─────────────────────────────────┼─────────────────┐
                        ▼                                 ▼                 ▼
                  Cloudflare Workers                Desktop packages     Mobile builds
                  (website + web app)               (win/mac/linux)      (optional)
                        │                                 │
                        └──────────────▶ GitHub Release ◀─┘
                                              │
                                              ▼
                                        Auto-update
```
