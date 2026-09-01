import { err, ok } from '@noto/core';
import type { NotoError, Result } from '@noto/types';
import type { z } from 'zod';

/**
 * The validation boundary.
 *
 * Every value that arrives from outside — a request body, a row from Postgres,
 * a redirect's query string — is parsed here before any service sees it.
 * `Result` rather than an exception, so a malformed request is handled by the
 * same branch as every other failure instead of a `try`/`catch` nobody wrote.
 */

export interface ValidationFailure extends NotoError {
  code: 'invalid_input';
  /** Field name → what is wrong with it, ready for a form to display. */
  fields: Record<string, string>;
}

/** Parses `input` against `schema`, collecting every field error rather than the first. */
export function validate<T>(schema: z.ZodType<T>, input: unknown): Result<T, NotoError> {
  const parsed = schema.safeParse(input);

  if (parsed.success) return ok(parsed.data);

  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.') || '_';
    // First problem per field wins: a form shows one message per input, and the
    // first is the one closest to what the person actually typed.
    fields[path] ??= issue.message;
  }

  const failure: ValidationFailure = {
    code: 'invalid_input',
    message: 'Some of what was sent is not valid.',
    fields,
  };

  return { ok: false, error: failure };
}

/** True when a failure carries per-field detail a form can render. */
export function isValidationFailure(error: NotoError): error is ValidationFailure {
  return error.code === 'invalid_input' && 'fields' in error;
}

/**
 * Parses a row that came out of the database.
 *
 * Distinct from `validate` because the two failures mean opposite things: a bad
 * request is the caller's problem and gets a 400, whereas a row that does not
 * match its own schema is *our* problem — a migration and a type that have
 * drifted apart — and must not be reported as though the caller sent it.
 */
export function parseRow<T>(schema: z.ZodType<T>, row: unknown, table: string): Result<T> {
  const parsed = schema.safeParse(row);

  if (parsed.success) return ok(parsed.data);

  return err(
    'unknown',
    `A row from "${table}" did not match its expected shape. The schema and the migrations have drifted.`,
    parsed.error,
  );
}
