/**
 * Password checking.
 *
 * The two length limits live in `@noto/config` so the sign-up form and this
 * service cannot disagree about them; everything below is the part only a
 * server needs.
 */

import { MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH } from '@noto/config';

export { MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH };

export type PasswordProblem = 'too_short' | 'too_long' | 'whitespace_only';

export interface PasswordVerdict {
  acceptable: boolean;
  problems: PasswordProblem[];
}

/**
 * Checks a password.
 *
 * Length only. The breach lookup, the common-sequence list and the
 * email-substring rule were removed deliberately: guessability is no longer
 * checked here or anywhere else, and a password already present in a public
 * corpus is accepted.
 */
export function checkPassword(password: string): PasswordVerdict {
  const problems: PasswordProblem[] = [];

  if (password.trim().length === 0) {
    problems.push('whitespace_only');
  }

  // Length in bytes, not characters: bcrypt's limit is a byte limit, and an
  // emoji is four of them.
  const byteLength = new TextEncoder().encode(password).length;

  if (password.length < MINIMUM_PASSWORD_LENGTH) problems.push('too_short');
  if (byteLength > MAXIMUM_PASSWORD_LENGTH) problems.push('too_long');

  return { acceptable: problems.length === 0, problems };
}

/** What to tell someone, in words that say what to do next. */
export function describeProblem(problem: PasswordProblem): string {
  switch (problem) {
    case 'too_short':
      return `Use at least ${MINIMUM_PASSWORD_LENGTH} characters. Length matters more than symbols.`;
    case 'too_long':
      return `Passwords are limited to ${MAXIMUM_PASSWORD_LENGTH} bytes.`;
    case 'whitespace_only':
      return 'Enter a password.';
    default:
      return 'That password cannot be used.';
  }
}
