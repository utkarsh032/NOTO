# Website and web app deployment

Two Cloudflare Pages projects, both built from this repository by
`.github/workflows/web.yml`.

```text
GitHub
   │
   ▼
GitHub Actions
   │
   ▼
Vite production build
   │
   ▼
Cloudflare Pages
   │
   ├── noto-website   the public site
   └── noto-web       the web application
```

Initial cost: **₹0**. Cloudflare Pages' free tier covers static hosting and
bandwidth; the first paid item Noto is likely to need is a domain, not a server.

## Environments

| Branch | Environment | Deploys to                             |
| ------ | ----------- | -------------------------------------- |
| `dev`  | staging     | The Pages preview deployment for `dev` |
| `main` | production  | The Pages production deployment        |

A tagged release also deploys production, with the release version baked in, as
part of `release.yml`.

Non-production builds render a banner across the top of the website saying which
environment they are, so a staging URL is never mistaken for the real download
page.

## First-time setup

1. In the Cloudflare dashboard, create two Pages projects. Choose **Direct
   Upload** — the deployment is pushed by GitHub Actions, not built by
   Cloudflare.

   ```text
   noto-website
   noto-web
   ```

   If you name them differently, set the repository variables
   `CLOUDFLARE_PAGES_WEBSITE_PROJECT` and `CLOUDFLARE_PAGES_WEB_PROJECT`.

2. Set the production branch of both projects to `main`.

3. Create an API token with the **Cloudflare Pages: Edit** permission, and add
   it to the repository together with your account ID:

   ```text
   CLOUDFLARE_API_TOKEN
   CLOUDFLARE_ACCOUNT_ID
   ```

Until those secrets exist, the workflow still builds both applications and
reports success — it only skips the upload, and says so with a warning. Forks
and fresh clones therefore get a useful CI verdict without any Cloudflare
account at all.

## Build-time configuration

The workflow passes these into the Vite build:

| Variable                | Meaning                                    |
| ----------------------- | ------------------------------------------ |
| `VITE_NOTO_VERSION`     | Version shown in the footer and About page |
| `VITE_NOTO_ENV`         | `production` or `staging`                  |
| `VITE_NOTO_COMMIT`      | Commit the build came from                 |
| `VITE_NOTO_REPOSITORY`  | `owner/repo`                               |
| `VITE_NOTO_WEB_APP_URL` | Where "Open Noto" points — **set this**    |

`VITE_NOTO_WEB_APP_URL` defaults to a placeholder. Set it as a repository
variable or in the workflow once the web application has a real URL, or every
"Open Noto" button on the website points nowhere.

## Client-side routing

The website routes in the browser, so `public/_redirects` serves `index.html`
for every unmatched path. Without it, refreshing `/download` returns a 404.

`public/_headers` sets the security headers and caches the fingerprinted assets
under `/assets/*` indefinitely.

## Custom domains

When a domain is bought, add it to both Pages projects and point the DNS at
Cloudflare. Suggested layout:

```text
noto.example.com        the website
app.noto.example.com    the web application
staging.noto.example.com   the staging website
```

Then set `VITE_NOTO_WEB_APP_URL` to the real web application URL.

## Deploying by hand

```bash
pnpm build:website
pnpm dlx wrangler pages deploy apps/website/dist --project-name=noto-website
```

Prefer the workflow. A hand deployment has no version, environment or commit
baked into it, and the About page will say so.
