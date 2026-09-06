/**
 * What the application may know about the cloud before loading any of it.
 *
 * Deliberately tiny and free of imports. `cloud.ts` pulls in
 * `@supabase/supabase-js`, and Noto's performance budget says a signed-out
 * visitor downloads none of it — so the decision of whether to load that module
 * has to be answerable without loading it.
 */

export const cloudConfig = {
  url: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
};

/**
 * The Turnstile sitekey. Public: it is rendered into the sign-up form.
 *
 * `null` disables sign-up in the interface rather than offering a form the
 * server is going to refuse — the Edge Function fails closed on a missing
 * token, so a build without this key cannot create accounts.
 */
export const turnstileSiteKey =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? null;

/** False in every build that ships without Supabase credentials, which is fine. */
export const cloudConfigured = Boolean(cloudConfig.url && cloudConfig.anonKey);

/**
 * Whether a session from a previous visit is sitting in storage.
 *
 * Supabase persists it under `sb-<project-ref>-auth-token`. Matching the key
 * rather than reading it means a visitor who has never signed in never pays for
 * the client: there is nothing to restore, so nothing is fetched.
 */
export function hasStoredSession(): boolean {
  return storedSessionKeys().length > 0;
}

/**
 * Every key Supabase keeps a session under. Empty when storage is unreadable.
 */
function storedSessionKeys(): string[] {
  const keys: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && /^sb-.+-auth-token$/.test(key)) keys.push(key);
    }
  } catch {
    // Private mode, or storage disabled. Nothing is stored, so nothing to clear.
    return [];
  }

  return keys;
}

/**
 * Removes the stored session by hand.
 *
 * The last step of signing out, and the one that has to work when nothing else
 * does. `supabase.auth.signOut()` asks the server to revoke the token first,
 * and clearing storage afterwards is a branch of its error handling rather
 * than a promise it makes. What that branch protects is the whole point of the
 * button: a session left in this browser signs the person straight back in on
 * the next reload. Whatever the server said, the copy on this device goes.
 */
export function clearStoredSession(): void {
  try {
    for (const key of storedSessionKeys()) localStorage.removeItem(key);
  } catch {
    // Nothing readable is nothing stored.
  }
}
