/**
 * Whether this installation has ever been offered the sign-in screen.
 *
 * Noto opens on Home, because it works signed out and always has. But a person
 * launching it for the first time has no way of knowing an account exists, and
 * the account screen used to answer that question with a fixture — somebody
 * else's name, somebody else's devices.
 *
 * So the sign-in screen is shown once, on the first launch, and never forced
 * again. "Continue without an account" is a real answer, and a product that
 * asks twice is not accepting it.
 */

const KEY = 'noto.welcomed';

/**
 * True exactly once per installation.
 *
 * Marks immediately rather than waiting for an outcome: someone who closes the
 * window on the sign-in screen has still been asked, and asking again on the
 * next launch would be a nag rather than an offer.
 */
export function claimFirstLaunch(): boolean {
  try {
    if (localStorage.getItem(KEY) !== null) return false;

    localStorage.setItem(KEY, new Date().toISOString());

    return true;
  } catch {
    // Private browsing, or storage disabled. Without somewhere to record that
    // the question was asked, asking it would repeat on every launch — so it
    // is not asked at all. A greeting is not worth becoming a nag.
    return false;
  }
}
