/**
 * Password rules.
 *
 * NIST 800-63B, not the 2009 corporate template: length is the requirement,
 * composition rules are not, and nothing expires on a timer. A rule that makes
 * people write passwords down has made the system less secure, not more.
 *
 * They live in `@noto/config` rather than in `@noto/backend` because the form
 * and the service both have to state the same number. A sign-up screen that
 * accepts eleven characters and a server that refuses them is one definition
 * too many, and the person who finds out is the one being refused.
 */

/**
 * Six characters. No upper-case-plus-digit-plus-symbol theatre.
 *
 * Below the eight NIST 800-63B asks for, and chosen deliberately rather than
 * by oversight. Raising it is a one-line change here and nowhere else, which
 * is the point of the constant living in this package.
 */
export const MINIMUM_PASSWORD_LENGTH = 6;

/**
 * The longest password accepted.
 *
 * bcrypt silently truncates at 72 bytes, so anything beyond that is a false
 * promise; refusing it outright is more honest than accepting a password whose
 * tail does nothing. It also caps the work an attacker can make the hasher do.
 */
export const MAXIMUM_PASSWORD_LENGTH = 72;
