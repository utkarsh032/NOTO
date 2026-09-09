/**
 * Where Supabase keeps a session, and how to be certain it is gone.
 *
 * Its own module, with no imports at all, and that is the whole point of it.
 * `@noto/sync/supabase` pulls in `@supabase/supabase-js` — around 120 kB — and
 * the two questions asked here come *before* the decision to load any of it:
 * whether there is a session worth restoring, and, on the way out, whether the
 * one on this device is really gone. Answering either by loading the client
 * would mean a visitor who has never signed in downloads it to be told they are
 * signed out.
 *
 * Both platforms that have a cloud store the session in `localStorage` — a
 * browser because that is where it is, and Electron because its renderer has
 * one that Electron keeps in the application's user-data directory.
 */

/** Supabase's storage key, one per project: `sb-<project-ref>-auth-token`. */
const SESSION_KEY = /^sb-.+-auth-token$/;

/**
 * Every key Supabase keeps a session under. Empty when storage is unreadable.
 *
 * Matching the key rather than reading its contents is deliberate: nothing here
 * needs to know what is in a session to know that there is one.
 */
function storedSessionKeys(): string[] {
  const keys: string[] = [];

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && SESSION_KEY.test(key)) keys.push(key);
    }
  } catch {
    // Private mode, or storage disabled. Nothing is stored, so nothing to clear.
    return [];
  }

  return keys;
}

/** Whether a session from a previous run is sitting in storage. */
export function hasStoredSession(): boolean {
  return storedSessionKeys().length > 0;
}

/**
 * Removes the stored session by hand.
 *
 * The last step of signing out, and the one that has to work when nothing else
 * does. `supabase.auth.signOut()` asks the server to revoke the token first,
 * and clearing storage afterwards is a branch of its error handling rather than
 * a promise it makes. What that branch protects is the whole point of the
 * button: a session left on this device signs the person straight back in next
 * time. Whatever the server said, the copy here goes.
 */
export function clearStoredSession(): void {
  try {
    for (const key of storedSessionKeys()) localStorage.removeItem(key);
  } catch {
    // Nothing readable is nothing stored.
  }
}
