-- Row Level Security.
--
-- This is the authorization layer for the whole product. Not the Edge
-- Functions, not the client. Enabling RLS with no policy denies everything, so
-- the safe state is the default and every grant below is deliberate.
--
-- The shape to notice: there is no policy anywhere that lets one user read
-- another user's row. Phase 1 has no sharing, so phase 1 has no such policy —
-- it arrives with `workspace_members`, and not a migration earlier.

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.auth_events enable row level security;
alter table public.auth_attempts enable row level security;
alter table public.user_settings enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
--
-- Readable and updatable by its owner. Not insertable or deletable by anyone:
-- creation belongs to the sign-up trigger and deletion to the cascade from
-- `auth.users`, so a client has no business doing either.
-- ---------------------------------------------------------------------------

create policy "profiles are readable by their owner"
  on public.profiles for select
  using (public.is_self(id));

create policy "profiles are updatable by their owner"
  on public.profiles for update
  using (public.is_self(id))
  with check (public.is_self(id));

-- `email` is mirrored from GoTrue and must not be editable here — changing it
-- in this table would desynchronise it from the address that actually signs in.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and new.email is distinct from old.email then
    raise exception 'email is changed through the account settings, not directly'
      using errcode = 'insufficient_privilege';
  end if;

  new.id := old.id;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- devices
--
-- Full CRUD for the owner. The client generates the id, so insert is a genuine
-- client operation here — unlike profiles.
-- ---------------------------------------------------------------------------

create policy "devices are readable by their owner"
  on public.devices for select
  using (public.is_self(user_id));

create policy "devices are insertable by their owner"
  on public.devices for insert
  with check (public.is_self(user_id));

create policy "devices are updatable by their owner"
  on public.devices for update
  using (public.is_self(user_id))
  with check (public.is_self(user_id));

create policy "devices are deletable by their owner"
  on public.devices for delete
  using (public.is_self(user_id));

-- ---------------------------------------------------------------------------
-- auth_events
--
-- Select only. A security log a client can write is not a security log, and one
-- a client can delete is worse than none — it would let an attacker who gains a
-- session erase the evidence of how they got in.
-- ---------------------------------------------------------------------------

create policy "auth events are readable by their owner"
  on public.auth_events for select
  using (public.is_self(user_id));

-- ---------------------------------------------------------------------------
-- auth_attempts
--
-- No policy at all. The table is reachable only through
-- `count_recent_attempts` and the recorder below, both `security definer`.
-- Anything else would let a client read or forge its own rate limit.
-- ---------------------------------------------------------------------------

create or replace function public.record_attempt(attempt_key text, attempt_kind text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.auth_attempts (key, kind) values (attempt_key, attempt_kind);
$$;

comment on function public.record_attempt is
  'Records one attempt against a hashed subject. The only write path into auth_attempts.';

-- ---------------------------------------------------------------------------
-- user_settings
--
-- Read and update by the owner. Insert belongs to the sign-up trigger.
-- ---------------------------------------------------------------------------

create policy "settings are readable by their owner"
  on public.user_settings for select
  using (public.is_self(user_id));

create policy "settings are updatable by their owner"
  on public.user_settings for update
  using (public.is_self(user_id))
  with check (public.is_self(user_id));

-- ---------------------------------------------------------------------------
-- Function grants
--
-- `security definer` functions bypass RLS by design, so their execute grants
-- are the access control. Only what an authenticated caller legitimately needs.
-- ---------------------------------------------------------------------------

revoke all on function public.count_recent_attempts(text, text, interval) from public, anon, authenticated;
revoke all on function public.record_attempt(text, text) from public, anon, authenticated;

grant execute on function public.count_recent_attempts(text, text, interval) to service_role;
grant execute on function public.record_attempt(text, text) to service_role;
