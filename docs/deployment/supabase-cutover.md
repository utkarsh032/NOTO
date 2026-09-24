# Moving accounts from Supabase to `apps/api`

The one-time move of sign-in from Supabase to `apps/api` (Implementation Plan,
Phase 3; Backend_Node_Plan §14 phase 2). It happens once. Read all of it before
starting.

## What changes for people

- **Everyone sets a new password once.** Supabase (GoTrue) stores bcrypt
  hashes; `apps/api` stores argon2id. We do not carry the old hashes over
  (decision D7): a forced reset is simpler to reason about and leaves no
  second hashing scheme in the sign-in path.
- Their account keeps the same id, email, display name and settings. Devices
  appear again as each one signs in.
- Nobody is signed out of their documents. Noto is local-first, so every
  document stays on every device whatever happens to the account.

## Before the release

1. `apps/api` is running in production. Its migrations have been applied, and
   staging passes the sign-up → verify → sign-in → refresh → reset → sign-out
   run-through.
2. Web and desktop builds exist with `VITE_NOTO_API_URL` set, which
   makes `apps/api` the backend. The Supabase variables can stay in the build;
   the API wins when both are set.
3. The release contains **no schema change**. If sign-in breaks, the only
   suspect should be the cutover.

## Moving the accounts

Run this against a read-only copy of the Supabase database. It writes the
importer's whole input as one JSON document. The Zod schema in
`apps/api/src/db/import-supabase.ts` is the authority on that shape; if the
two ever disagree, change this query, not the schema.

```sql
-- Confirmed, not-deleted accounts, with their profiles and settings.
with moved as (
  select u.id
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.email_confirmed_at is not null
    and p.deleted_at is null
)
select json_build_object(
  'users', coalesce((
    select json_agg(json_build_object(
      'id', u.id,
      'email', u.email,
      'email_confirmed_at', u.email_confirmed_at,
      'created_at', u.created_at,
      'raw_user_meta_data', u.raw_user_meta_data))
    from auth.users u where u.id in (select id from moved)), '[]'),
  'profiles', coalesce((
    select json_agg(json_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'avatar_url', p.avatar_url,
      'locale', p.locale,
      'marketing_opt_in', p.marketing_opt_in,
      'onboarded_at', p.onboarded_at))
    from public.profiles p where p.id in (select id from moved)), '[]'),
  'user_settings', coalesce((
    select json_agg(json_build_object(
      'user_id', s.user_id,
      'appearance', s.appearance,
      'editor', s.editor,
      'updates', s.updates,
      'sync_enabled', s.sync_enabled))
    from public.user_settings s where s.user_id in (select id from moved)), '[]')
);
```

Save the single value it returns as `accounts.json`, then run this as the
database owner (`DATABASE_MIGRATE_URL`):

```sh
pnpm --filter @noto/api db:import-supabase accounts.json
```

It prints `imported N, already present N, settings N`. The import is one
transaction, keeps the **same ids**, and can be re-run safely: existing ids
are skipped. An address already owned by a different live account is skipped
and listed as a conflict. Resolve each one by hand; accounts are never merged.
Anyone without a settings row gets the defaults. `password_hash` stays empty, and `email_verified_at` comes from
`email_confirmed_at`. An account with no password cannot sign in: the API
answers exactly as it does for a wrong password (403, same message, same
timing), so no one can use sign-in to find out which addresses were moved.
"Forgot password?" is how such an account gets a password.
Leave out `devices`, `auth_events` and `auth_attempts`: devices register
again on sign-in, and the old security log refers to sessions that no longer
exist.

Accounts that were never confirmed are left behind. Their owners can sign up
again.

## Telling people

- **An email to every moved account**: a normal password-reset email, sent in
  batches with, for example, `pnpm --filter @noto/api db:send-reset-mails
--limit 100 --per-minute 60` (it uses the API's normal environment). It
  skips accounts that already have a password or a live reset link, so
  re-running continues where it stopped and never mails anyone twice within
  the hour. The reset link is the whole instruction, and resetting also marks
  the address as confirmed. **Reset links last one hour.** The email must say
  that anyone whose link has expired uses "Forgot password?" on the sign-in
  screen, which is the same flow.
- **On the sign-in screen**, a failed sign-in shows the server's usual
  "email and password do not match" message, with "Forgot password?" next to
  the password field.
- **A line in the release notes**: "We moved Noto's accounts to our own
  server. Set a new password once, with the link we emailed you. If the link
  has expired, use 'Forgot password?' on the sign-in screen. Your documents
  were never affected."

## Release order

1. Deploy `apps/api`, then import the accounts.
2. Release the web app with `VITE_NOTO_API_URL`, then the desktop build.
3. Send the reset emails.
4. Watch sign-in errors and `auth_events` for a week.

**Rolling back** means rebuilding without `VITE_NOTO_API_URL`, so clients go
back to Supabase, which still holds everyone's old password. Anyone who reset
their password in the meantime uses the old one again. That is the reason
Supabase is not switched off until the week is over.

## After it is verified

This is plan step 6, and a separate release:

- delete `supabase/`, `packages/backend/src/supabase/`,
  `packages/sync/src/supabase/`, and `cloud.ts` in `apps/web` and
  `apps/desktop`, with the Supabase branch of each `use-*-account.ts` and
  `cloud-config.ts`;
- remove `@supabase/supabase-js` from `packages/backend` and `packages/sync`,
  the `supabase` CLI from the root, and the `db:*` scripts;
- remove the Supabase variables from `.env.example`, CI, and the Cloudflare
  build settings;
- pause, then delete, the Supabase project.

Keep `supabase/migrations/` in git history. It records how the schema got its
shape.
