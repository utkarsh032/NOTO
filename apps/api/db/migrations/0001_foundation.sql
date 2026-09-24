-- Foundation: extensions, enums and the helpers every later migration uses.
--
-- Ported from supabase/migrations/20260901120000_foundation.sql. The one real
-- change is where "who is calling" comes from: Supabase read it from the JWT
-- through auth.uid(); here the API names the caller at the start of every
-- transaction with `set_config('app.user_id', …, true)` (apps/api/src/db/tx.ts),
-- and current_user_id() reads it back. Every policy is written against that
-- helper, so it is the only thing that had to change.

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.device_platform as enum ('windows', 'macos', 'linux', 'ios', 'android', 'web');

create type public.auth_event_kind as enum (
  'sign_in',
  'sign_out',
  'sign_up',
  'password_reset',
  'password_changed',
  'mfa_enrolled',
  'mfa_challenge_failed',
  'device_revoked',
  'email_changed',
  'email_verified',
  'session_reuse_detected',
  'export_requested',
  'account_deleted'
);

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------

-- Keeps `updated_at` honest. Doing this in the database rather than in the
-- application means a row edited through psql is stamped the same way as one
-- edited through the API.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'BEFORE UPDATE trigger: stamps updated_at with the transaction time.';

-- ---------------------------------------------------------------------------
-- The caller
-- ---------------------------------------------------------------------------

-- The user this transaction acts for, or null. Set with SET LOCAL semantics
-- (the third argument of set_config is `true`), so a pooled connection cannot
-- carry one request's identity into the next.
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

comment on function public.current_user_id is
  'The caller named by the API for this transaction (app.user_id), or null.';

-- Answers "is the caller this user", which most policies reduce to. Written
-- once so a policy is a statement of intent rather than a repeated comparison.
create or replace function public.is_self(target uuid)
returns boolean
language sql
stable
as $$
  select public.current_user_id() = target;
$$;

comment on function public.is_self is
  'True when the transaction''s caller is `target`. The building block of RLS.';
