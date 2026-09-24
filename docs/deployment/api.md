# Deploying the API

`apps/api` is a long-lived Node process with a real connection pool, talking
to PostgreSQL. It needs a host that runs Node natively: no Docker, no
container image (decision recorded in
[`Backend_Node_Plan.md`](../../R&D/Backend_Node_Plan.md) §1.2). This page
covers the two hosts audit decision **D1** chooses between, and what both
need.

Deploy **staging first**, and move production sign-in onto the API only in the
Phase 3 cutover release.

## What every deployment needs

**A PostgreSQL 17+ database**, in the region decision D2 picks. Any managed
Postgres works (Neon, Render Postgres, Railway Postgres, a VM's own).
Point-in-time recovery must be on before real accounts arrive.

**Three connection strings**, one per role:

| Variable               | Role           | Used by                                         |
| ---------------------- | -------------- | ----------------------------------------------- |
| `DATABASE_MIGRATE_URL` | the owner      | `db:bootstrap` and `db:migrate`, at deploy time |
| `DATABASE_URL`         | `noto_api`     | the server, every request (RLS applies)         |
| `DATABASE_SERVICE_URL` | `noto_service` | the server, identity tables only                |

With the owner URL set, `pnpm --filter @noto/api db:bootstrap` creates both
login roles with the passwords in the other two URLs. On a managed database
whose owner lacks `CREATEROLE`, create them in the provider's console instead:
`noto_api` as a plain login role, `noto_service` with `BYPASSRLS`.

**The rest of the environment** (`apps/api/src/env.ts` refuses to start
without the required ones):

| Variable                | Staging / production value                                                             |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `NODE_ENV`              | `production`                                                                           |
| `JWT_SECRET`            | 48 random bytes, base64url. Different per environment. Rotating it signs everyone out. |
| `TURNSTILE_SECRET`      | The secret key of the widget the web app uses                                          |
| `TURNSTILE_HOSTNAMES`   | The web app's hostnames, comma-separated                                               |
| `RESEND_API_KEY`        | Required: without mail nobody can verify an address                                    |
| `MAIL_FROM`             | e.g. `Noto <no-reply@noto.app>`, from a domain verified in Resend                      |
| `NOTO_WEB_APP_URL`      | The web app that has the verify and reset screens                                      |
| `NOTO_ALLOWED_ORIGINS`  | Extra browser origins beyond the built-in list (a staging web app, say)                |
| `NOTO_CLIENT_IP_HEADER` | `cf-connecting-ip` behind Cloudflare, `x-forwarded-for` behind Render/Railway's proxy  |
| `NOTO_RUN_JOBS`         | `true` on exactly one instance                                                         |
| `PORT`                  | Whatever the host assigns                                                              |

Generate a secret with:

```bash
node -e "console.log(crypto.randomBytes(48).toString('base64url'))"
```

**The commands.** Every host runs the same three:

```bash
# build
pnpm install --frozen-lockfile && pnpm turbo run build --filter=@noto/api
# before each release (pre-deploy)
pnpm --filter @noto/api db:migrate
# start
pnpm --filter @noto/api start
```

The build bundles the `@noto/*` workspace packages into
`apps/api/dist/index.js`. npm dependencies stay in `node_modules`, because
`@node-rs/argon2` is a native module and can't be bundled. That is why the
start command runs from the installed repository rather than copying `dist/`
somewhere on its own.

**Health checks.** `/healthz` says the process is up; `/readyz` says the
database answers. Point the host's health check at `/readyz`.

## Option A: Render (native Node web service)

1. **New → Web Service**, connect the repository, branch `dev` for staging.
2. Runtime **Node**, root directory empty (the repository root).
3. Build command, pre-deploy command and start command: the three above.
4. Health check path `/readyz`.
5. Environment: the table above. `NOTO_CLIENT_IP_HEADER=x-forwarded-for`.
6. A Render Postgres instance in the same region, or an external one.

Render's free web services sleep when idle; staging can live with that,
production cannot (use a paid instance).

## Option B: a small VM under systemd

Any Linux VM with Node 22+ and pnpm. Clone the repository to `/srv/noto`,
create `/etc/noto/api.env` (mode `600`, owned by root) with the environment
above, build once, then install this unit as
`/etc/systemd/system/noto-api.service`:

```ini
[Unit]
Description=Noto API
After=network-online.target
Wants=network-online.target

[Service]
User=noto
WorkingDirectory=/srv/noto
EnvironmentFile=/etc/noto/api.env
ExecStartPre=/usr/bin/pnpm --filter @noto/api db:migrate
ExecStart=/usr/bin/node apps/api/dist/index.js
Restart=on-failure
RestartSec=5
# The process only needs its own checkout and the network.
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/srv/noto

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now noto-api
journalctl -u noto-api -f          # logs: one JSON line per event
```

Put a TLS-terminating proxy in front (Caddy is the least configuration) or a
Cloudflare Tunnel, and set `NOTO_CLIENT_IP_HEADER` to match. The API itself
speaks plain HTTP on `PORT` and must not be exposed directly.

## Verifying a deployment

Against the staging URL, before any client points at it:

1. `GET /readyz` → `{"ok":true}`.
2. Sign up from the staging web app (Turnstile passes), receive the mail,
   follow the link.
3. Sign in; the Account screen lists the device and the security log shows
   `sign_up`, `email_verified`, `sign_in`.
4. Forgot password → mail → reset → the old session is signed out.
5. A browser request from an origin not on the list is refused (no
   `Access-Control-Allow-Origin` in the response).

Then record the staging URL in `docs/deployment/secrets.md`, and give it to
the clients as `VITE_NOTO_API_URL` / `NOTO_API_URL` (Phase 3).
