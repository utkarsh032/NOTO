import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { CloudflareTurnstile, NoTurnstile } from '@noto/backend/shared';
import { sql } from 'kysely';

import { createApp } from './app.ts';
import { createKysely } from './db/pool.ts';
import { createDatabase } from './db/tx.ts';
import { readEnv } from './env.ts';
import { startJobs } from './jobs/index.ts';
import { createConsoleMail, createMailLinks, createResendMail } from './mail.ts';
import { createArgon2Hasher } from './security/passwords.ts';
import { createAccessTokens } from './security/tokens.ts';

/**
 * The composition root: read the environment, build the ports, start the
 * server. The only file that knows every concrete implementation, and the only
 * one that reads `process.env` (through `readEnv`).
 */

const env = readEnv();

const api = createKysely({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_SIZE,
  applicationName: 'noto-api',
});
const service = createKysely({
  connectionString: env.DATABASE_SERVICE_URL,
  max: Math.max(2, Math.ceil(env.DATABASE_POOL_SIZE / 2)),
  applicationName: 'noto-api-service',
});
const db = createDatabase({ api, service });

if (!env.TURNSTILE_SECRET) {
  console.warn(
    'TURNSTILE_SECRET is not set: every sign-up passes the bot check. Development only.',
  );
}
if (!env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not set: mail is printed here instead of sent.');
}

const app = createApp(
  {
    db,
    hasher: createArgon2Hasher(),
    tokens: createAccessTokens({ secret: env.JWT_SECRET, ttlSeconds: env.ACCESS_TOKEN_TTL }),
    mail: env.RESEND_API_KEY
      ? createResendMail({ apiKey: env.RESEND_API_KEY, from: env.MAIL_FROM })
      : createConsoleMail(),
    links: createMailLinks(env.NOTO_WEB_APP_URL),
    turnstile: env.TURNSTILE_SECRET
      ? new CloudflareTurnstile({
          secret: env.TURNSTILE_SECRET,
          expectedAction: 'signup',
          expectedHostnames: env.TURNSTILE_HOSTNAMES,
        })
      : new NoTurnstile(),
    refreshTokenTtlSeconds: env.REFRESH_TOKEN_TTL,
    async ready() {
      try {
        await sql`select 1`.execute(api);
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    env,
    socketAddress: (c) => {
      try {
        return getConnInfo(c).remote.address;
      } catch {
        return undefined;
      }
    },
  },
);

const stopJobs = env.NOTO_RUN_JOBS ? startJobs(db) : () => undefined;

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.warn(`Noto API listening on http://localhost:${info.port} (${env.NODE_ENV})`);
});

/** Stop taking requests, finish the ones in flight, then close the pools. */
function shutdown(signal: string) {
  console.warn(`${signal}: shutting down.`);
  stopJobs();
  server.close(() => {
    void Promise.all([api.destroy(), service.destroy()]).finally(() => process.exit(0));
  });
  // A request that never finishes must not keep the process alive forever.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
