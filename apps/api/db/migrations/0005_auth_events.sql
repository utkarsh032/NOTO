-- `auth_events` — the security log, and `auth_attempts` — the rate-limit counter.
--
-- Ported from supabase/migrations/20260901120300_auth_events.sql. The two
-- `security definer` functions that fronted `auth_attempts` are gone: the table
-- is written and counted only through `noto_service`, which is the whole of
-- what those functions were protecting.
--
-- Two tables with opposite lifetimes. Events are kept for six months and shown
-- to the user on the account screen: they are how somebody notices a sign-in
-- they did not make. Attempts are kept for an hour and shown to nobody.

create table public.auth_events (
  id bigint primary key generated always as identity,
  user_id uuid references public.users (id) on delete set null,
  device_id uuid references public.devices (id) on delete set null,
  kind public.auth_event_kind not null,
  outcome text not null,
  ip inet,
  user_agent text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint auth_events_outcome check (outcome in ('success', 'failure'))
);

comment on table public.auth_events is
  'Append-only security log. Retained 180 days. Readable by its own user, writable only by the server.';
comment on column public.auth_events.user_id is
  'Null for a failed attempt against an address with no account — which is not a hint that none exists.';
comment on column public.auth_events.detail is
  'Reason codes only. Never a token, a password, an email body or a document title.';

create index auth_events_user_idx on public.auth_events (user_id, created_at desc);
create index auth_events_created_idx on public.auth_events (created_at);

-- ---------------------------------------------------------------------------

create table public.auth_attempts (
  id bigint primary key generated always as identity,
  key text not null,
  kind text not null,
  attempted_at timestamptz not null default now(),

  constraint auth_attempts_kind check (kind in ('sign_in', 'sign_up', 'reset', 'verify_resend', 'mfa'))
);

comment on table public.auth_attempts is
  'Rate-limit counters. Swept hourly; never read by the application, only counted.';
comment on column public.auth_attempts.key is
  'A hashed subject: "email:<sha256>" or "ip:<addr>". Never a plain address.';

create index auth_attempts_lookup_idx on public.auth_attempts (key, kind, attempted_at desc);
