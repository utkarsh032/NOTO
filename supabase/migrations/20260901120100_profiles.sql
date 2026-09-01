-- `profiles` — the public half of an account.
--
-- Supabase owns `auth.users`, and application code is not allowed to read it.
-- `profiles` is the row Noto may join against, show in a UI and expose over the
-- API. One row per user, created by trigger the moment GoTrue creates the user,
-- so there is no window in which a signed-in account has no profile.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext not null,
  display_name text not null,
  avatar_url text,
  locale text not null default 'en',
  marketing_opt_in boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint profiles_display_name_length check (char_length(display_name) between 1 and 80),
  constraint profiles_locale_length check (char_length(locale) between 2 and 12)
);

comment on table public.profiles is
  'Public account data. Mirrors auth.users, which application code cannot read.';
comment on column public.profiles.email is
  'Mirrored from GoTrue for display. GoTrue remains the authority.';
comment on column public.profiles.marketing_opt_in is
  'Explicit opt-in, default false. Unrelated to transactional mail, which is not optional.';

create unique index profiles_email_key on public.profiles (email) where deleted_at is null;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
