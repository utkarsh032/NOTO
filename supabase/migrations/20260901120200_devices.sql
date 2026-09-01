-- `devices` — every installation of Noto that has signed in.
--
-- The id is generated on the device and kept in local storage, so reinstalling
-- Noto produces a new device and signing out and back in does not. That is what
-- makes the account screen's device list mean something: it is a list of
-- installations, not a list of sessions.

create table public.devices (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  platform public.device_platform not null,
  os_name text not null,
  app_version text not null,
  push_token text,
  last_seen_ip inet,
  location text,
  last_active_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint devices_name_length check (char_length(name) between 1 and 120),
  constraint devices_app_version_length check (char_length(app_version) between 1 and 40)
);

comment on table public.devices is
  'One row per installation that has signed in. The id is client-generated and stable.';
comment on column public.devices.id is
  'Generated on the device and stored locally. Never minted by the server.';
comment on column public.devices.location is
  'Coarse city and country, derived server-side from last_seen_ip. Never GPS.';
comment on column public.devices.revoked_at is
  'Set by "sign out this device". Sync refuses a revoked device without deleting its history.';

create index devices_user_idx on public.devices (user_id, deleted_at, last_active_at desc);

create trigger devices_set_updated_at
  before update on public.devices
  for each row execute function public.set_updated_at();
