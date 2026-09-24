-- `workspaces` and `workspace_members` — who owns content and who may see it.
--
-- Audit plan phase 4, step 1; Backend_Plan §5.2. A workspace is created on a
-- device, offline, and reaches the server when its owner claims it
-- (POST /v1/workspaces/:id/claim), keeping the id the device gave it. After
-- that its name and icon change through sync like any other entity.
--
-- `is_local` does not cross the wire: a local workspace is by definition one
-- the server has never seen.

create type public.member_role as enum ('owner', 'editor', 'commenter', 'viewer');

create table public.workspaces (
  id uuid primary key,
  name text not null,
  owner_id uuid not null references public.users (id) on delete cascade,
  icon text,
  -- Bumped by trigger on every write; a push names the version it was made on.
  version integer not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,

  constraint workspaces_name_length check (char_length(name) between 1 and 200)
);

comment on table public.workspaces is
  'Top-level container. The id is the one the device generated when it was local.';
comment on column public.workspaces.updated_at is
  'The device''s time of the change, not the server''s: last-writer-wins compares it.';

create index workspaces_owner_idx on public.workspaces (owner_id);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.member_role not null,
  invited_by uuid references public.users (id) on delete set null,
  invited_at timestamptz,
  accepted_at timestamptz,

  primary key (workspace_id, user_id)
);

comment on table public.workspace_members is
  'Who may see a workspace. Every content policy goes through it.';

create index workspace_members_user_idx on public.workspace_members (user_id);

-- ---------------------------------------------------------------------------
-- Membership helpers
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER, so a policy can ask about membership without the question
-- itself being filtered by workspace_members' own policies — which would
-- recurse. They answer only for the transaction's caller, so they reveal
-- nothing a caller could not already see.

create or replace function public.is_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target and m.user_id = public.current_user_id()
  );
$$;

comment on function public.is_member is
  'True when the caller belongs to workspace `target`, in any role.';

create or replace function public.can_edit(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target
      and m.user_id = public.current_user_id()
      and m.role in ('owner', 'editor')
  );
$$;

comment on function public.can_edit is
  'True when the caller may change content in workspace `target`.';

-- ---------------------------------------------------------------------------
-- Versions
-- ---------------------------------------------------------------------------
--
-- Every synced table carries `version`, and nothing but this trigger sets it:
-- 1 on insert, one more on each update. A push's version check compares
-- against it, so it must not be writable by anything that could skip a step.

create or replace function public.bump_version()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
  else
    new.version := old.version + 1;
  end if;
  return new;
end;
$$;

comment on function public.bump_version is
  'BEFORE INSERT OR UPDATE on synced tables: version is 1, then one more per write.';

create trigger workspaces_bump_version
  before insert or update on public.workspaces
  for each row execute function public.bump_version();

-- ---------------------------------------------------------------------------
-- Grants and policies
-- ---------------------------------------------------------------------------

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

grant select on public.workspaces, public.workspace_members to noto_api;
grant insert (id, name, owner_id, icon, created_at, updated_at, deleted_at)
  on public.workspaces to noto_api;
grant update (name, icon, updated_at, deleted_at) on public.workspaces to noto_api;
grant insert (workspace_id, user_id, role, accepted_at) on public.workspace_members to noto_api;

grant select, insert, update, delete on public.workspaces, public.workspace_members
  to noto_service;

-- The owner can read a workspace before its membership row exists, which is
-- what lets a claim's INSERT … RETURNING see what it just wrote.
create policy "workspaces are readable by members and their owner"
  on public.workspaces for select to noto_api
  using (public.is_member(id) or public.is_self(owner_id));

create policy "workspaces are claimed by their owner"
  on public.workspaces for insert to noto_api
  with check (public.is_self(owner_id));

create policy "workspaces are updatable by editors"
  on public.workspaces for update to noto_api
  using (public.can_edit(id))
  with check (public.can_edit(id));

create policy "members see who else is in their workspaces"
  on public.workspace_members for select to noto_api
  using (public.is_member(workspace_id) or public.is_self(user_id));

-- The only membership a caller can create is their own ownership of a
-- workspace they own. Invitations (Phase 9) will be a server flow.
create policy "owners add themselves"
  on public.workspace_members for insert to noto_api
  with check (
    public.is_self(user_id)
    and role = 'owner'
    and exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and public.is_self(w.owner_id)
    )
  );
