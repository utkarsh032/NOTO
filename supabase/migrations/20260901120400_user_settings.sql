-- `user_settings` — the Settings tree, stored as JSONB.
--
-- Three JSONB columns rather than thirty scalar ones. Settings are read and
-- written as one object, their shape is owned by
-- `packages/types/src/settings.ts`, and adding a preference should not be a
-- database migration. The columns are separate rather than one blob so that two
-- devices changing appearance and editor settings at the same time do not
-- overwrite each other.

create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  appearance jsonb not null default '{}'::jsonb,
  editor jsonb not null default '{}'::jsonb,
  updates jsonb not null default '{}'::jsonb,
  sync_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.user_settings is
  'One row per user. Defaults are empty objects; the client fills gaps from @noto/config.';
comment on column public.user_settings.sync_enabled is
  'Opt-in. False keeps Noto entirely local even while signed in — signing in is not consent to upload.';

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();
