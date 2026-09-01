-- Account provisioning.
--
-- The plan proposed an Edge Function on the GoTrue webhook. A trigger is used
-- instead: it runs inside the same transaction as the user insert, so a profile
-- cannot fail to exist because a function was cold, rate-limited or mid-deploy.
-- Using a network call to guarantee a local invariant is the kind of thing that
-- works in testing and produces profile-less accounts in production.
--
-- This runs last of the phase-1 migrations because it touches every table it
-- provisions.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    -- A display name is required and sign-up may not have supplied one. The
    -- local part of the address is a better first guess than "User".
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  );

  insert into public.user_settings (user_id) values (new.id);

  insert into public.auth_events (user_id, kind, outcome, detail)
  values (new.id, 'sign_up', 'success', jsonb_build_object('provider', new.raw_app_meta_data ->> 'provider'));

  return new;
end;
$$;

comment on function public.handle_new_user is
  'AFTER INSERT on auth.users: profile, default settings and the sign-up event, in one transaction.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Keeping the mirrored email honest
--
-- GoTrue is the authority on the address. When it changes there, it must change
-- here, or `profiles.email` becomes a stale copy that the account screen shows
-- with confidence.
-- ---------------------------------------------------------------------------

create or replace function public.handle_user_email_changed()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;

    insert into public.auth_events (user_id, kind, outcome)
    values (new.id, 'email_changed', 'success');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_changed();
