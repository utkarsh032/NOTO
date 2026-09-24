-- Columns a signed-in client may not write, even on its own rows.
--
-- RLS answers "whose row is this", not "which columns may they change". The
-- owner-update policies on `devices` and `profiles` therefore let a client set
-- fields that belong to the server: un-revoke a device that was signed out,
-- plant its own IP address and location, or soft-delete and restore its
-- profile behind the account-deletion flow's back.
--
-- These triggers apply only when there is a caller (`auth.uid()` is not null).
-- The service role has no `auth.uid()`, so server-side code — sign-in, the
-- scheduled jobs — keeps full control, which is the point: those columns are
-- written by the server and nobody else.

-- ---------------------------------------------------------------------------
-- devices
-- ---------------------------------------------------------------------------

create or replace function public.protect_device_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Ownership never moves. Not even between a person's own accounts.
  if new.user_id is distinct from old.user_id then
    raise exception 'a device cannot be moved to another account'
      using errcode = 'insufficient_privilege';
  end if;

  new.id := old.id;
  new.created_at := old.created_at;

  -- Derived server-side from the request, so never taken from a client.
  new.last_seen_ip := old.last_seen_ip;
  new.location := old.location;

  -- Revoking is allowed; un-revoking is not. A revoked device gets back in by
  -- signing in again, which runs as the service role and proves the password.
  if old.revoked_at is not null then
    new.revoked_at := old.revoked_at;
  end if;

  return new;
end;
$$;

comment on function public.protect_device_columns is
  'BEFORE UPDATE on devices: a client may revoke but not un-revoke, and may not write ownership, IP or location.';

create trigger devices_protect_columns
  before update on public.devices
  for each row execute function public.protect_device_columns();

-- ---------------------------------------------------------------------------
-- profiles
--
-- Replaces the phase-1 function, adding `deleted_at`: account deletion is a
-- server flow with a grace period and an audit event, not a column edit.
-- ---------------------------------------------------------------------------

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

  if auth.uid() is not null then
    new.deleted_at := old.deleted_at;
  end if;

  return new;
end;
$$;
