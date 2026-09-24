import { PostgresAuthAdapter } from '@noto/backend/postgres';

import { accountsAwaitingReset } from '../src/db/import-supabase.ts';
import { createKysely } from '../src/db/pool.ts';
import { createDatabase } from '../src/db/tx.ts';
import { readEnv } from '../src/env.ts';
import { createConsoleMail, createMailLinks, createResendMail } from '../src/mail.ts';
import { createArgon2Hasher } from '../src/security/passwords.ts';
import { createAccessTokens } from '../src/security/tokens.ts';

/**
 * `pnpm --filter @noto/api db:send-reset-mails [--limit N] [--per-minute M]`
 *
 * Mails a password-reset link to imported accounts that have no password yet
 * (see `db:import-supabase`). Paced, so a few thousand accounts do not arrive
 * at the mail provider in one second, and resumable: an account with a live
 * reset link is skipped, so a second run picks up where the first stopped.
 *
 * Uses the server's own environment — the same mail provider and links the
 * running API uses. Reset links last an hour; anyone who misses theirs uses
 * "Forgot password" on the sign-in screen, which is the same flow.
 */

function option(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : Number(process.argv[index + 1]);
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

const limit = option('limit', 100);
const perMinute = option('per-minute', 60);
const env = readEnv();

const api = createKysely({ connectionString: env.DATABASE_URL, max: 1 });
const service = createKysely({ connectionString: env.DATABASE_SERVICE_URL, max: 2 });
const db = createDatabase({ api, service });

const auth = new PostgresAuthAdapter({
  db,
  hasher: createArgon2Hasher(),
  tokens: createAccessTokens({ secret: env.JWT_SECRET, ttlSeconds: env.ACCESS_TOKEN_TTL }),
  mail: env.RESEND_API_KEY
    ? createResendMail({ apiKey: env.RESEND_API_KEY, from: env.MAIL_FROM })
    : createConsoleMail(),
  links: createMailLinks(env.NOTO_WEB_APP_URL),
});

try {
  const emails = await accountsAwaitingReset(service, limit);
  const gapMs = Math.ceil(60_000 / perMinute);

  console.warn(`${emails.length} account(s) to mail, one every ${gapMs} ms.`);

  for (const [index, email] of emails.entries()) {
    await auth.requestPasswordReset(email);
    console.warn(`  ${index + 1}/${emails.length} ${email}`);
    if (index < emails.length - 1) await new Promise((resolve) => setTimeout(resolve, gapMs));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await Promise.all([api.destroy(), service.destroy()]);
}
