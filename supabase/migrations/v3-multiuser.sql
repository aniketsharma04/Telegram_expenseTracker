-- v3: multi-user + families. Run this in the Supabase SQL editor.

-- ── Users (telegram chat id is the primary key) ─────────────────────────────
create table if not exists users (
  id         bigint primary key,
  first_name text,
  username   text,
  joined_at  timestamptz not null default now()
);

-- ── Families ─────────────────────────────────────────────────────────────────
create table if not exists families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    bigint references users (id),
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

-- One family per person for now: user_id is globally unique.
create table if not exists family_members (
  family_id uuid   not null references families (id) on delete cascade,
  user_id   bigint not null references users (id) unique,
  role      text   not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- ── Ownership on expenses ────────────────────────────────────────────────────
alter table expenses add column if not exists user_id bigint references users (id);
create index if not exists expenses_user_id_idx on expenses (user_id);

-- Existing data belongs to the original (owner) account.
insert into users (id, first_name) values (5709542930, 'Aniket')
on conflict (id) do nothing;
update expenses set user_id = 5709542930 where user_id is null;

-- ── Row-level security ───────────────────────────────────────────────────────
-- RLS on, and deliberately NO anon policies: the browser (anon key) cannot
-- read users/families/invite codes. The webhook uses the service role, which
-- bypasses RLS. Scoped dashboard access arrives with Phase C auth.
alter table users enable row level security;
alter table families enable row level security;
alter table family_members enable row level security;
