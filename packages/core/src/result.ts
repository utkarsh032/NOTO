import type { NotoError, NotoErrorCode, Result } from '@noto/types';

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<T = never>(
  code: NotoErrorCode,
  message: string,
  cause?: unknown,
): Result<T, NotoError> {
  return { ok: false, error: { code, message, cause } };
}

/** Narrowing helper so callers can branch without touching the discriminant. */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/** Returns the value, or throws — for call sites that genuinely cannot recover. */
export function unwrap<T>(result: Result<T, NotoError>): T {
  if (result.ok) return result.value;
  throw new Error(`[${result.error.code}] ${result.error.message}`);
}
