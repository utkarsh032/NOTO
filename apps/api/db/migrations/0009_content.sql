-- `folders` and `documents` — the cloud twin of the device's tables.
--
-- Audit plan phase 4, step 1; Backend_Plan §5.2. Written only by sync
-- (POST /v1/sync/push); there is no REST CRUD for content (Node plan §6.3).
-- Hosted `document_versions` arrive with plan limits in audit Phase 7.
--
-- The timestamps are the device's: last-writer-wins compares `updated_at`,
-- so the server keeps what the device said rather than stamping its own.
--
-- `folder_id` and `parent_id` are not foreign keys. Devices push in batches
-- and in the order changes happened; a document can reach the server before
-- the folder it was filed in, and a folder deleted on one device can still be
-- named by a document edited offline on another. The server stores what was
-- pushed and lets every device converge; `workspace_id` is the reference that
-- security depends on, and that one is enforced.

create type public.document_status as enum ('draft', 'active', 'archived');

create table public.folders (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  parent_id uuid,
  name text not null,
  position integer not null default 0,
  color text,
  icon text,
  version integer not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,

  constraint folders_name_length check (char_length(name) between 1 and 200)
);

create index folders_workspace_idx on public.folders (workspace_id, deleted_at);

create table public.documents (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  folder_id uuid,
  title text not null,
  -- Tiptap/ProseMirror JSON, canonical, exactly as on the device.
  content jsonb not null,
  status public.document_status not null default 'draft',
  excerpt text not null default '',
  word_count integer not null default 0,
  is_favorite boolean not null default false,
  tags text[] not null default '{}',
  version integer not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,

  constraint documents_title_length check (char_length(title) <= 1000)
);

create index documents_workspace_idx
  on public.documents (workspace_id, deleted_at, updated_at desc);
create index documents_folder_idx on public.documents (folder_id, deleted_at);
create index documents_tags_idx on public.documents using gin (tags);

create trigger folders_bump_version
  before insert or update on public.folders
  for each row execute function public.bump_version();

create trigger documents_bump_version
  before insert or update on public.documents
  for each row execute function public.bump_version();

-- ---------------------------------------------------------------------------
-- Grants and policies: members read, editors write. Nobody deletes a row —
-- a delete is a tombstone (`deleted_at`), which is what other devices pull.
-- ---------------------------------------------------------------------------

alter table public.folders enable row level security;
alter table public.documents enable row level security;

grant select on public.folders, public.documents to noto_api;
grant insert (
  id, workspace_id, parent_id, name, position, color, icon, created_at, updated_at, deleted_at
) on public.folders to noto_api;
grant update (parent_id, name, position, color, icon, updated_at, deleted_at)
  on public.folders to noto_api;
grant insert (
  id, workspace_id, folder_id, title, content, status, excerpt, word_count, is_favorite, tags,
  created_at, updated_at, deleted_at
) on public.documents to noto_api;
grant update (
  folder_id, title, content, status, excerpt, word_count, is_favorite, tags, updated_at, deleted_at
) on public.documents to noto_api;

grant select, insert, update, delete on public.folders, public.documents to noto_service;

create policy "folders are readable by members"
  on public.folders for select to noto_api
  using (public.is_member(workspace_id));
create policy "folders are insertable by editors"
  on public.folders for insert to noto_api
  with check (public.can_edit(workspace_id));
create policy "folders are updatable by editors"
  on public.folders for update to noto_api
  using (public.can_edit(workspace_id))
  with check (public.can_edit(workspace_id));

create policy "documents are readable by members"
  on public.documents for select to noto_api
  using (public.is_member(workspace_id));
create policy "documents are insertable by editors"
  on public.documents for insert to noto_api
  with check (public.can_edit(workspace_id));
create policy "documents are updatable by editors"
  on public.documents for update to noto_api
  using (public.can_edit(workspace_id))
  with check (public.can_edit(workspace_id));
