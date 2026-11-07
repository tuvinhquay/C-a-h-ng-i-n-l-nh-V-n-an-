create table if not exists workspaces (
  id text primary key,
  name text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on workspace_members(user_id);
create unique index if not exists workspace_single_membership_user_idx on workspace_members(user_id);

create table if not exists workspace_devices (
  workspace_id text not null,
  user_id text not null,
  device_id text not null,
  name text not null,
  last_seen_at timestamptz not null default now(),
  primary key (workspace_id, user_id, device_id),
  foreign key (workspace_id, user_id) references workspace_members(workspace_id, user_id) on delete cascade
);

create table if not exists workspace_invites (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  token_hash text not null unique,
  created_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  uses_remaining integer not null check (uses_remaining >= 0)
);

create table if not exists workspace_state (
  workspace_id text primary key references workspaces(id) on delete cascade,
  revision bigint not null default 0,
  snapshot jsonb not null,
  tombstones jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists workspace_history (
  workspace_id text not null references workspaces(id) on delete cascade,
  revision bigint not null,
  snapshot jsonb not null,
  tombstones jsonb not null,
  actor_user_id text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, revision)
);
