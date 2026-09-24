-- `memory_items` — Noto Memory, synced like any other entity.
--
-- Audit plan phase 4, step 1; Backend_Plan §5.2. Which plans sync Memory
-- (Backend_Plan open question 2) is an entitlement, enforced in Phase 7; the
-- table does not decide it.

create type public.memory_kind as enum ('note', 'clipboard', 'screenshot', 'image', 'link', 'file');

create table public.memory_items (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind public.memory_kind not null,
  title text not null,
  content text not null default '',
  source text,
  -- A link's address. Captured assets get a storage path with R2 (Phase 7).
  url text,
  tags text[] not null default '{}',
  is_pinned boolean not null default false,
  size_bytes bigint,
  version integer not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,

  constraint memory_items_title_length check (char_length(title) <= 1000)
);

create index memory_items_workspace_idx
  on public.memory_items (workspace_id, deleted_at, updated_at desc);

create trigger memory_items_bump_version
  before insert or update on public.memory_items
  for each row execute function public.bump_version();

create trigger memory_items_log_change
  after insert or update on public.memory_items
  for each row execute function public.log_change('memory');

alter table public.memory_items enable row level security;

grant select on public.memory_items to noto_api;
grant insert (
  id, workspace_id, kind, title, content, source, url, tags, is_pinned, size_bytes, created_at,
  updated_at, deleted_at
) on public.memory_items to noto_api;
grant update (kind, title, content, source, url, tags, is_pinned, size_bytes, updated_at, deleted_at)
  on public.memory_items to noto_api;
grant select, insert, update, delete on public.memory_items to noto_service;

create policy "memory is readable by members"
  on public.memory_items for select to noto_api
  using (public.is_member(workspace_id));
create policy "memory is insertable by editors"
  on public.memory_items for insert to noto_api
  with check (public.can_edit(workspace_id));
create policy "memory is updatable by editors"
  on public.memory_items for update to noto_api
  using (public.can_edit(workspace_id))
  with check (public.can_edit(workspace_id));
