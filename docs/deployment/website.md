# Website and web app deployment

Two Cloudflare **Workers** projects, each connected to this repository through
Workers Builds. Cloudflare checks out the commit, runs the build, and deploys —
GitHub Actions is not in that path.

```text
git push
   │
   ▼
Cloudflare Workers Builds
   │
   ├── noto      →  apps/website  →  https://noto.utkarshraj525.workers.dev
   └── noto-app  →  apps/web      →  https://noto-app.utkarshraj525.workers.dev
```

Initial cost: **₹0**. The first paid item Noto is likely to need is a domain,
not a server.

## Project settings

Each project is configured in the Cloudflare dashboard as follows.

| Setting           | `noto` (website)                                           | `noto-app` (web application)                           |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| Build command     | `pnpm build:website`                                       | `pnpm build:web`                                       |
| Deploy command    | `npx wrangler deploy --config apps/website/wrangler.jsonc` | `npx wrangler deploy --config apps/web/wrangler.jsonc` |
| Root directory    | `/`                                                        | `/`                                                    |
| Production branch | `main`                                                     | `main`                                                 |

**Root directory must stay `/`.** This is a pnpm workspace; installing from
`apps/website` alone cannot resolve the `workspace:*` dependencies.

Non-production branches build too, which is what makes `dev` a staging
deployment. Non-production builds render a banner across the top of the website
saying which environment they are, so a preview URL is never mistaken for the
real download page.

## Configuration lives in the repository

[`apps/website/wrangler.jsonc`](../../apps/website/wrangler.jsonc) and
[`apps/web/wrangler.jsonc`](../../apps/web/wrangler.jsonc). Both are
static-asset Workers — no `main`, so Cloudflare serves `dist/` directly with no
Worker code in the request path.

The `name` field is what binds a deployment to a project, so it must match the
project name in the dashboard.

### Single-page routing

Both applications route in the browser, so both set:

```jsonc
"assets": {
  "directory": "./dist",
  "not_found_handling": "single-page-application"
}
```

Do **not** add a `_redirects` file with a `/* /index.html 200` catch-all. That
is the Cloudflare **Pages** idiom; Workers Assets rejects it at upload:

```text
Invalid _redirects configuration:
Line 3: Infinite loop detected in this rule.
```

Workers Assets normalizes `/index.html` back to `/`, which re-matches `/*`, so
the rule loops. `not_found_handling` does the same job. Note that `_redirects`
is validated only server-side at upload, so `wrangler deploy --dry-run` will
**not** catch this.

`_headers` _is_ supported and is used by the website for security headers and
immutable caching of fingerprinted assets.

## Deploying by hand

Useful when a project's automatic build is not working, or to prove a config
before wiring up the dashboard:

```bash
pnpm dlx wrangler login    # once, opens a browser
pnpm deploy:website
pnpm deploy:web
```

Both scripts build first, then deploy with the matching config.

To check a config without deploying anything:

```bash
pnpm exec wrangler deploy --config apps/web/wrangler.jsonc --dry-run
```

## GitHub Actions does not deploy

[`.github/workflows/web.yml`](../../.github/workflows/web.yml) builds both
applications and keeps the bundles as artifacts. It stops there deliberately:

- Cloudflare already deploys from Git on every push. A second path would race
  it, and could deploy something different.
- It would need an API token GitHub does not otherwise require.
- It would drift out of step with the `wrangler.jsonc` each project uses.

So there are **no Cloudflare secrets in GitHub**, and none are needed. What the
workflow gives you is a build verdict on pull requests, where Cloudflare's own
build does not report.

## Build-time configuration

| Variable                | Meaning                                    | Default                        |
| ----------------------- | ------------------------------------------ | ------------------------------ |
| `VITE_NOTO_VERSION`     | Version shown in the footer and About page | The workspace manifest version |
| `VITE_NOTO_ENV`         | `production` or `staging`                  | `production`                   |
| `VITE_NOTO_COMMIT`      | Commit the build came from                 | empty — shown as "local build" |
| `VITE_NOTO_REPOSITORY`  | `owner/repo`                               | —                              |
| `VITE_NOTO_WEB_APP_URL` | Where "Open Noto" points                   | The `noto-app` deployment      |

None of these need setting in Cloudflare. The version in particular is read
from the manifest at build time by a Vite `define` — relying on an environment
variable meant every Cloudflare deployment advertised a fallback version
instead of the real one, because Cloudflare's build command sets no variables.

## Custom domains

Add the domain to each Worker under **Settings → Domains & Routes**. Suggested
layout:

```text
noto.example.com        the website
app.noto.example.com    the web application
```

Then set `VITE_NOTO_WEB_APP_URL` to the application's URL, or update the
default in [`apps/website/src/env.ts`](../../apps/website/src/env.ts).

## When a deployment does not appear

A Worker showing Cloudflare's "There is nothing here yet" placeholder exists but
has **no deployment** — its build has never succeeded. Check, in order:

1. The project's build log in the Cloudflare dashboard.
2. That it was created as a **Worker**, not a **Pages** project. The
   `wrangler deploy` command does not apply to Pages.
3. That the root directory is `/`.
4. That `name` in the `wrangler.jsonc` matches the project name.

`pnpm deploy:web` from your machine is the fastest way to distinguish a broken
dashboard configuration from a broken repository configuration: if the manual
deploy works, the config is fine and the problem is in the project settings.
