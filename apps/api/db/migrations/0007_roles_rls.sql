-- Roles, grants and row-level security (plan §3).
--
-- Ported from supabase/migrations/20260901120600_rls.sql and
-- 20260923120000_protect_columns.sql. Under Supabase every query ran as the
-- caller; here the API connects as one role, so the caller is named per
-- transaction (`app.user_id`) and the same policies read it through is_self().
-- The RLS safety net survives the move.
--
-- Two roles:
--
--   noto_api      every request. RLS applies: it is not an owner and has no
--                 bypassrls. Column grants keep server-owned fields out of its
--                 reach even on its own rows.
--   noto_service  the server's own identity code: sessions, email tokens, the
--                 security log, rate limits. bypassrls, deliberately, and never
--                 used by a route that takes an id from the caller as a filter.
--
-- The roles are created here without a password so the migration can grant to
-- them. `pnpm db:bootstrap` (or an operator, in production) gives them LOGIN
-- and a password; migrations never carry a secret.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'noto_api') then
    create role noto_api nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'noto_service') then
    create role noto_service nologin bypassrls;
  end if;
end;
$$;

grant usage on schema public to noto_api, noto_service;

-- ---------------------------------------------------------------------------
-- noto_service: the server's own tables, in full.
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on
  public.users,
  public.sessions,
  public.email_tokens,
  public.devices,
  public.auth_events,
  public.auth_attempts,
  public.user_settings
to noto_service;

grant usage on all sequences in schema public to noto_service;

-- ---------------------------------------------------------------------------
-- noto_api: what a signed-in person may touch, and only their own.
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.email_tokens enable row level security;
alter table public.devices enable row level security;
alter table public.auth_events enable row level security;
alter table public.auth_attempts enable row level security;
alter table public.user_settings enable row level security;

-- users --------------------------------------------------------------------
--
-- Every column but the password hash is readable; only the profile fields are
-- writable. Email, verification, lockout and deletion are server flows with
-- their own checks and audit events, not column edits. Column grants do what
-- the Supabase trigger `protect_profile_columns` did, and more strictly.

grant select (
  id, email, email_verified_at, password_changed_at, display_name, avatar_url, locale,
  marketing_opt_in, onboarded_at, locked_until, mfa_enabled, created_at, updated_at, deleted_at
) on public.users to noto_api;

grant update (display_name, avatar_url, locale, marketing_opt_in, onboarded_at)
  on public.users to noto_api;

create policy "users are readable by themselves"
  on public.users for select to noto_api
  using (public.is_self(id));

create policy "users are updatable by themselves"
  on public.users for update to noto_api
  using (public.is_self(id))
  with check (public.is_self(id));

-- devices ------------------------------------------------------------------
--
-- The owner may list, register and revoke. Ownership, IP and location belong
-- to the server; so does un-revoking, which only a fresh sign-in may do.

grant select on public.devices to noto_api;
grant insert (id, user_id, name, platform, os_name, app_version, push_token, last_active_at)
  on public.devices to noto_api;
grant update (name, os_name, app_version, push_token, last_active_at, revoked_at)
  on public.devices to noto_api;

create policy "devices are readable by their owner"
  on public.devices for select to noto_api
  using (public.is_self(user_id));

create policy "devices are insertable by their owner"
  on public.devices for insert to noto_api
  with check (public.is_self(user_id));

create policy "devices are updatable by their owner"
  on public.devices for update to noto_api
  using (public.is_self(user_id))
  with check (public.is_self(user_id));

-- Revoking is allowed; un-revoking is not. Applies only when a caller is named,
-- so the server's own sign-in path keeps the power to clear it.
create or replace function public.protect_device_columns()
returns trigger
language plpgsql
as $$
begin
  if public.current_user_id() is null then
    return new;
  end if;

  if old.revoked_at is not null then
    new.revoked_at := old.revoked_at;
  end if;

  return new;
end;
$$;

comment on function public.protect_device_columns is
  'BEFORE UPDATE on devices: a caller may revoke its device but not un-revoke it.';

create trigger devices_protect_columns
  before update on public.devices
  for each row execute function public.protect_device_columns();

-- auth_events --------------------------------------------------------------
--
-- Select only. A security log a client can write is not a security log, and one
-- a client can delete would let an intruder erase how they got in.

grant select on public.auth_events to noto_api;

create policy "auth events are readable by their owner"
  on public.auth_events for select to noto_api
  using (public.is_self(user_id));

-- user_settings ------------------------------------------------------------

grant select on public.user_settings to noto_api;
grant update (appearance, editor, updates, sync_enabled) on public.user_settings to noto_api;

create policy "settings are readable by their owner"
  on public.user_settings for select to noto_api
  using (public.is_self(user_id));

create policy "settings are updatable by their owner"
  on public.user_settings for update to noto_api
  using (public.is_self(user_id))
  with check (public.is_self(user_id));

-- sessions, email_tokens, auth_attempts --------------------------------------
--
-- No grant and no policy for noto_api. RLS is enabled with nothing permitted,
-- so even a future stray grant would return no rows.
