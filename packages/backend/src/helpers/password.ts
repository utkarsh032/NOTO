/**
 * Password rules.
 *
 * NIST 800-63B, not the 2009 corporate template: length is the requirement,
 * composition rules are not, and nothing expires on a timer. A rule that makes
 * people write passwords down has made the system less secure, not more.
 */

/** Twelve characters. No upper-case-plus-digit-plus-symbol theatre. */
export const MINIMUM_PASSWORD_LENGTH = 12;

/**
 * The longest password accepted.
 *
 * bcrypt silently truncates at 72 bytes, so anything beyond that is a false
 * promise; refusing it outright is more honest than accepting a password whose
 * tail does nothing. It also caps the work an attacker can make the hasher do.
 */
export const MAXIMUM_PASSWORD_LENGTH = 72;

export type PasswordProblem =
  'too_short' | 'too_long' | 'contains_email' | 'common_sequence' | 'whitespace_only';

export interface PasswordVerdict {
  acceptable: boolean;
  problems: PasswordProblem[];
}

/**
 * A short list of the sequences that turn up most often.
 *
 * Not a dictionary — the breach check is the real defence, and this catches the
 * handful of cases worth failing without a network round trip.
 */
const COMMON_SEQUENCES = [
  'password',
  '123456',
  'qwerty',
  'letmein',
  'welcome',
  'admin',
  'iloveyou',
  'noto',
];

/**
 * Checks a password against the local rules.
 *
 * Local only — the breach check in `AuthService` is a separate step, because it
 * needs the network and this must work without it.
 */
export function checkPassword(password: string, email?: string): PasswordVerdict {
  const problems: PasswordProblem[] = [];

  if (password.trim().length === 0) {
    problems.push('whitespace_only');
  }

  // Length in bytes, not characters: bcrypt's limit is a byte limit, and an
  // emoji is four of them.
  const byteLength = new TextEncoder().encode(password).length;

  if (password.length < MINIMUM_PASSWORD_LENGTH) problems.push('too_short');
  if (byteLength > MAXIMUM_PASSWORD_LENGTH) problems.push('too_long');

  const lowered = password.toLowerCase();

  if (email) {
    const localPart = email.split('@')[0]?.toLowerCase() ?? '';
    if (localPart.length >= 3 && lowered.includes(localPart)) {
      problems.push('contains_email');
    }
  }

  if (COMMON_SEQUENCES.some((sequence) => lowered.includes(sequence))) {
    problems.push('common_sequence');
  }

  return { acceptable: problems.length === 0, problems };
}

/** What to tell someone, in words that say what to do next. */
export function describeProblem(problem: PasswordProblem): string {
  switch (problem) {
    case 'too_short':
      return `Use at least ${MINIMUM_PASSWORD_LENGTH} characters. Length matters more than symbols.`;
    case 'too_long':
      return `Passwords are limited to ${MAXIMUM_PASSWORD_LENGTH} bytes.`;
    case 'contains_email':
      return 'Avoid using your email address inside your password.';
    case 'common_sequence':
      return 'That contains a very common sequence. Anything else would be stronger.';
    case 'whitespace_only':
      return 'Enter a password.';
    default:
      return 'That password cannot be used.';
  }
}
