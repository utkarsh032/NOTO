-- `files` — attachment metadata, synced like any other entity.
--
-- Audit plan phase 4, step 1 ("files (metadata)"). The bytes and the R2
-- grant/complete routes are audit Phase 7; until then a file row says that an
-- attachment exists and what it is. `local_path` stays on the device, and no
-- URL is ever stored: one is signed on demand once R2 is in.

create table public.files (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Not a foreign key, for the reason folders.parent_id is not (0009).
  document_id uuid,
  name text not null,
  mime_type text not null,
  size bigint not null default 0,
  checksum text,
  version integer not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,

  constraint files_name_length check (char_length(name) between 1 and 255),
  constraint files_size_nonnegative check (size >= 0)
);

create index files_workspace_idx on public.files (workspace_id, deleted_at);
create index files_document_idx on public.files (document_id, deleted_at);

create trigger files_bump_version
  before insert or update on public.files
  for each row execute function public.bump_version();

create trigger files_log_change
  after insert or update on public.files
  for each row execute function public.log_change('file');

alter table public.files enable row level security;

grant select on public.files to noto_api;
grant insert (
  id, workspace_id, document_id, name, mime_type, size, checksum, created_at, updated_at,
  deleted_at
) on public.files to noto_api;
grant update (document_id, name, mime_type, size, checksum, updated_at, deleted_at)
  on public.files to noto_api;
grant select, insert, update, delete on public.files to noto_service;

create policy "files are readable by members"
  on public.files for select to noto_api
  using (public.is_member(workspace_id));
create policy "files are insertable by editors"
  on public.files for insert to noto_api
  with check (public.can_edit(workspace_id));
create policy "files are updatable by editors"
  on public.files for update to noto_api
  using (public.can_edit(workspace_id))
  with check (public.can_edit(workspace_id));
