-- Foundation: extensions, enums and the helpers every later migration uses.
--
-- Nothing in this file is Noto-specific on its own. It exists so that the table
-- migrations that follow can be read as a description of the data rather than a
-- mixture of data and plumbing.

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
--
-- Phase 1 creates only the two it needs. The remaining six in the plan arrive
-- with the tables that use them; an unused type is a claim the schema cannot
-- keep.
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
  'export_requested',
  'account_deleted'
);

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------

-- Keeps `updated_at` honest. Doing this in the database rather than in the
-- application means three clients cannot disagree about it, and a row edited
-- through the SQL console is stamped the same way as one edited through Noto.
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

-- Answers "is the caller signed in as this user", which is the condition most
-- RLS policies in phase 1 reduce to. Written once so a policy is a statement of
-- intent rather than a repeated auth.uid() comparison.
create or replace function public.is_self(target uuid)
returns boolean
language sql
stable
as $$
  select auth.uid() = target;
$$;

comment on function public.is_self is
  'True when the JWT belongs to `target`. The building block of phase-1 RLS.';
