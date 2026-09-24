-- `users` — identity and credentials, in one row.
--
-- Replaces Supabase's `profiles`, which existed only to mirror `auth.users`.
-- With no GoTrue there is nothing to mirror, so the two merge (plan §4.1).
--
-- `password_hash` never leaves this table: `noto_api` is granted every column
-- except it (0007), no DTO carries it, and the row mappers have no branch that
-- could emit it.

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  email_verified_at timestamptz,
  password_hash text,
  password_changed_at timestamptz,
  display_name text not null,
  avatar_url text,
  locale text not null default 'en',
  marketing_opt_in boolean not null default false,
  onboarded_at timestamptz,
  locked_until timestamptz,
  mfa_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint users_display_name_length check (char_length(display_name) between 1 and 80),
  constraint users_locale_length check (char_length(locale) between 2 and 12),
  constraint users_email_length check (char_length(email) between 3 and 254)
);

comment on table public.users is
  'One row per account. Identity and credentials; replaces Supabase''s auth.users + profiles.';
comment on column public.users.email_verified_at is
  'Null until the address answers its verification mail. Sign-in is refused until it is set.';
comment on column public.users.password_hash is
  'argon2id. Never selected by noto_api, never in a DTO. Null only if OAuth is ever added.';
comment on column public.users.password_changed_at is
  'Refresh tokens issued before this moment are refused.';
comment on column public.users.marketing_opt_in is
  'Explicit opt-in, default false. Unrelated to transactional mail, which is not optional.';
comment on column public.users.deleted_at is
  'Start of the 30-day deletion grace period. Written by the server only.';

-- Unique among live accounts, so an address frees up once its account is gone.
create unique index users_email_key on public.users (email) where deleted_at is null;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();
