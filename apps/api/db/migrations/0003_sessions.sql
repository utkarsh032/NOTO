-- `sessions` — one row per live refresh token, and `email_tokens` — the
-- single-use keys sent by mail (plan §4.2, §4.3).
--
-- Neither table is reachable by `noto_api` at all (0007): only the server's
-- own identity code reads or writes them, through `noto_service`.

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- Not a foreign key. The device row is written after the password is checked,
  -- in the same sign-in, but by a different port; and devices are only ever
  -- soft-deleted, so a reference could never dangle anyway.
  device_id uuid,
  refresh_token_hash text not null,
  previous_token_hash text,
  user_agent text,
  ip inet,
  expires_at timestamptz not null,
  rotated_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now(),

  constraint sessions_revoked_reason check (
    revoked_reason is null or revoked_reason in (
      'signout', 'signout_all', 'reuse_detected', 'password_changed', 'device_revoked', 'admin'
    )
  )
);

comment on table public.sessions is
  'One row per refresh token. Holds its SHA-256, never the token: a dump must not be a set of keys.';
comment on column public.sessions.previous_token_hash is
  'The hash this token replaced. Presenting it again means the token was copied: every session is revoked.';

create unique index sessions_refresh_token_key on public.sessions (refresh_token_hash);
create index sessions_previous_token_idx on public.sessions (previous_token_hash)
  where previous_token_hash is not null;
create index sessions_user_idx on public.sessions (user_id, revoked_at);
create index sessions_device_idx on public.sessions (device_id) where device_id is not null;

-- ---------------------------------------------------------------------------

create table public.email_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null,
  token_hash text not null,
  new_email citext,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint email_tokens_kind check (kind in ('verify_email', 'reset_password', 'change_email')),
  constraint email_tokens_new_email check ((kind = 'change_email') = (new_email is not null))
);

comment on table public.email_tokens is
  'Verification, reset and email-change keys. SHA-256 only; single use, enforced by UPDATE … WHERE consumed_at IS NULL.';

create unique index email_tokens_token_key on public.email_tokens (token_hash);
create index email_tokens_user_idx on public.email_tokens (user_id, kind) where consumed_at is null;
