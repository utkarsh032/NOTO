/**
 * Statements the SQL channel will not run, whoever sends them.
 *
 * The renderer still composes its own SQL — the shared query layer in
 * `@noto/database/sqlite` runs there — so this is the interim fix, not the
 * final one (moving the repositories into this process is). What it closes is
 * the step from "can run SQL" to "can write any file on disk": `ATTACH` and
 * `VACUUM INTO` both create a database file at a path the statement names, and
 * `load_extension` loads native code.
 */
const FORBIDDEN_SQL = /\b(?:attach|detach)\b|\bvacuum\s+into\b|\bload_extension\b/i;

/** The pragmas the schema module actually uses. Every other one is refused. */
const ALLOWED_PRAGMA = /^\s*pragma\s+(?:foreign_keys|user_version|journal_mode|table_info)\b/i;

export type SqlCheck = { ok: true } | { ok: false; reason: string };

export function checkStatement(sql: unknown, params: unknown): SqlCheck {
  if (typeof sql !== 'string' || sql.trim() === '') {
    return { ok: false, reason: 'a statement must be a non-empty string' };
  }

  if (!Array.isArray(params)) return { ok: false, reason: 'parameters must be an array' };

  const valid = params.every(
    (value) =>
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'bigint' ||
      value instanceof Uint8Array,
  );
  if (!valid) return { ok: false, reason: 'a parameter is not a SQL value' };

  if (FORBIDDEN_SQL.test(sql)) return { ok: false, reason: 'that statement is not allowed' };

  if (/^\s*pragma\b/i.test(sql) && !ALLOWED_PRAGMA.test(sql)) {
    return { ok: false, reason: 'that pragma is not allowed' };
  }

  return { ok: true };
}
