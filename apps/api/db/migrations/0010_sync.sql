-- `change_log`, `sync_state` and the triggers that feed the log.
--
-- Audit plan phase 4, step 1; Backend_Plan §5.3; Node plan §9.6. The log is
-- the pull feed: every write to a synced table appends a row, and a device
-- pulls the rows after its cursor. The client never writes here.

create type public.sync_entity_kind as enum ('workspace', 'folder', 'document', 'file', 'memory');
create type public.sync_operation as enum ('create', 'update', 'delete');

create table public.change_log (
  -- Monotonic across the database, and so within every workspace. The cursor.
  seq bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entity_kind public.sync_entity_kind not null,
  entity_id uuid not null,
  operation public.sync_operation not null,
  version integer not null,
  -- So a device is not sent its own changes back.
  actor_device_id uuid,
  created_at timestamptz not null default now()
);

comment on table public.change_log is
  'One row per write to a synced table. Pulled by cursor (seq); compacted after 30 days.';

create index change_log_workspace_idx on public.change_log (workspace_id, seq);
create index change_log_entity_idx
  on public.change_log (workspace_id, entity_kind, entity_id, seq desc);

create table public.sync_state (
  device_id uuid not null references public.devices (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  last_pulled_seq bigint not null default 0,
  last_pushed_at timestamptz,
  last_pulled_at timestamptz,
  -- Set by compaction when the log is trimmed past this device's cursor.
  full_resync_required boolean not null default false,

  primary key (device_id, workspace_id)
);

comment on table public.sync_state is
  'One row per device per workspace: where its pulls have reached.';

-- ---------------------------------------------------------------------------
-- The log trigger
-- ---------------------------------------------------------------------------
--
-- AFTER INSERT OR UPDATE on every synced table; the kind is the trigger's
-- argument. The acting device comes from `app.device_id`, which the sync
-- controller sets transaction-locally beside `app.user_id`. SECURITY DEFINER:
-- the log is written for the caller, never by them, so `noto_api` has no
-- insert grant on it.

create or replace function public.log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace uuid;
  change public.sync_operation;
begin
  if tg_argv[0] = 'workspace' then
    target_workspace := new.id;
  else
    target_workspace := new.workspace_id;
  end if;

  if new.deleted_at is not null then
    change := 'delete';
  elsif tg_op = 'INSERT' then
    change := 'create';
  else
    change := 'update';
  end if;

  insert into public.change_log
    (workspace_id, entity_kind, entity_id, operation, version, actor_device_id)
  values (
    target_workspace,
    tg_argv[0]::public.sync_entity_kind,
    new.id,
    change,
    new.version,
    nullif(current_setting('app.device_id', true), '')::uuid
  );

  return null;
end;
$$;

comment on function public.log_change is
  'AFTER INSERT OR UPDATE on synced tables: appends the change to change_log.';

create trigger workspaces_log_change
  after insert or update on public.workspaces
  for each row execute function public.log_change('workspace');

create trigger folders_log_change
  after insert or update on public.folders
  for each row execute function public.log_change('folder');

create trigger documents_log_change
  after insert or update on public.documents
  for each row execute function public.log_change('document');

-- ---------------------------------------------------------------------------
-- Grants and policies
-- ---------------------------------------------------------------------------

alter table public.change_log enable row level security;
alter table public.sync_state enable row level security;

grant select on public.change_log to noto_api;
grant select on public.sync_state to noto_api;
grant insert (device_id, workspace_id, last_pulled_seq, last_pushed_at, last_pulled_at)
  on public.sync_state to noto_api;
grant update (last_pulled_seq, last_pushed_at, last_pulled_at, full_resync_required)
  on public.sync_state to noto_api;

grant select, insert, update, delete on public.change_log, public.sync_state to noto_service;

create policy "the change log is readable by members"
  on public.change_log for select to noto_api
  using (public.is_member(workspace_id));

-- A device's cursor belongs to the device's owner, and only for workspaces
-- they are in.
create policy "sync state is the device owner's"
  on public.sync_state for all to noto_api
  using (
    public.is_member(workspace_id)
    and exists (
      select 1 from public.devices d
      where d.id = device_id and public.is_self(d.user_id)
    )
  )
  with check (
    public.is_member(workspace_id)
    and exists (
      select 1 from public.devices d
      where d.id = device_id and public.is_self(d.user_id) and d.revoked_at is null
    )
  );
