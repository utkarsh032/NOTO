import { z } from 'zod';

/**
 * The environment, validated once at boot (plan §11).
 *
 * A missing secret stops the process when it starts, not on the first sign-in
 * at 3 a.m. Everything the server reads from `process.env` is read here and
 * nowhere else, so this file is also the complete list of what a deployment
 * has to set.
 */

/** `15m`, `30d`, `3600s` → seconds. */
function duration(fallback: string) {
  return z
    .string()
    .default(fallback)
    .transform((value, context) => {
      const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
      if (!match) {
        context.addIssue({ code: 'custom', message: 'Use a number and a unit: 15m, 30d.' });
        return z.NEVER;
      }

      const unit = { s: 1, m: 60, h: 3600, d: 86_400 }[match[2] as 's' | 'm' | 'h' | 'd'];
      return Number(match[1]) * unit;
    });
}

/** A comma-separated list, trimmed, empties dropped. */
const list = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== ''),
  );

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const postgresUrl = z
  .string()
  .regex(/^postgres(ql)?:\/\//, { message: 'Expected a postgres:// connection string.' });

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(8787),

    /** As `noto_api` — the role row-level security applies to. */
    DATABASE_URL: postgresUrl,
    /** As `noto_service` — bypasses RLS; the server's own identity tables only. */
    DATABASE_SERVICE_URL: postgresUrl,
    DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),

    /** Signs access tokens. Rotating it signs everyone out, which is the point. */
    JWT_SECRET: z.string().min(32, { message: 'Use at least 32 characters.' }),
    ACCESS_TOKEN_TTL: duration('15m'),
    REFRESH_TOKEN_TTL: duration('30d'),

    /** Where the links in mail point: the web app, which has the verify and reset screens. */
    NOTO_WEB_APP_URL: z.url().default('https://noto-web.utkarshraj525.workers.dev'),
    NOTO_ALLOWED_ORIGINS: list,
    /** Any localhost origin may call the API. Development only. */
    NOTO_ALLOW_LOCALHOST_ORIGINS: flag,
    /**
     * Which header carries the caller's address. `cf-connecting-ip` behind
     * Cloudflare; `x-forwarded-for` behind most other proxies; `none` when the
     * process is reachable directly and headers cannot be trusted.
     */
    NOTO_CLIENT_IP_HEADER: z
      .enum(['cf-connecting-ip', 'x-forwarded-for', 'x-real-ip', 'none'])
      .default('cf-connecting-ip'),

    TURNSTILE_SECRET: z.string().min(1).optional(),
    TURNSTILE_HOSTNAMES: list,

    RESEND_API_KEY: z.string().min(1).optional(),
    MAIL_FROM: z.string().min(3).default('Noto <no-reply@noto.app>'),

    /** Run the sweep jobs in this process. Off when a second instance exists. */
    NOTO_RUN_JOBS: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'production') return;

    // In production, "not configured" must not quietly mean "let everyone in"
    // or "mail nobody".
    if (!env.TURNSTILE_SECRET || env.TURNSTILE_HOSTNAMES.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['TURNSTILE_SECRET'],
        message: 'Production needs TURNSTILE_SECRET and TURNSTILE_HOSTNAMES.',
      });
    }

    if (!env.RESEND_API_KEY) {
      context.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'Production needs RESEND_API_KEY: without it nobody can verify an address.',
      });
    }

    if (env.NOTO_ALLOW_LOCALHOST_ORIGINS) {
      context.addIssue({
        code: 'custom',
        path: ['NOTO_ALLOW_LOCALHOST_ORIGINS'],
        message: 'Localhost origins are for development only.',
      });
    }
  });

export type Env = z.infer<typeof schema>;

/** Parses the environment, or throws one error that names every problem at once. */
export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.safeParse(source);
  if (parsed.success) return parsed.data;

  const problems = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.') || '(env)'}: ${issue.message}`)
    .join('\n');

  throw new Error(`The API's environment is not valid:\n${problems}`);
}
