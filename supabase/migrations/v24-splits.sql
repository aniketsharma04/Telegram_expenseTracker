-- v24: split payments with friends who may not use Aaj.
--
-- Ledger model borrowed from Splitwise: every split lists each person's
-- paid and owed amounts (paise), and a balance is just Σ(paid − owed).
-- A settle-up is a split of kind 'payment' (Rahul paid 750, you owed 750),
-- so payments and expenses share one table and one balance formula.
--
-- The cash/spend view stays in expenses/incomes:
--  * you paid ₹3,000 and split it: your row becomes your share (₹750, real
--    category) plus a linked "Lent" row for the rest (₹2,250) — same account,
--    same split_id — so the account still shows ₹3,000 out but every spend
--    total sees ₹750
--  * a friend paid: one row for your share, no account
--  * a friend pays you back: the bank credit is income with source
--    'Settle up' (counts in the account, not as earnings); paying a friend
--    back is an expense in 'Settle up' (not spending)

-- Non-spend categories for the split rows.
insert into categories (name, keywords, color)
values ('Lent', '{}', '#94a3b8'), ('Settle up', '{}', '#94a3b8')
on conflict (name) do nothing;

-- Your UPI ID, for "pay me back" links (asked once, optional).
alter table users add column if not exists upi_id text
  check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,64}$');

-- People you split with. Third parties under DPDP: keep it minimal.
create table if not exists people (
  id              uuid primary key default gen_random_uuid(),
  owner_id        bigint not null references users (id) on delete cascade,
  name            text   not null check (length(trim(name)) between 1 and 60),
  upi_id          text check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,64}$'),
  phone           text check (phone is null or phone ~ '^\+?[0-9]{10,13}$'),
  -- Names the bank used for this person ("RAHUL K SHARMA"), learned when a
  -- repayment is confirmed, so the next one matches without asking twice.
  bank_names      text[] not null default '{}',
  -- A family member (or friend) who also uses Aaj.
  linked_user_id  bigint references users (id) on delete set null,
  archived        boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists people_owner_idx on people (owner_id) where not archived;

-- Groups (trips, flats). Phase 2 UI; the column exists so splits can carry it.
create table if not exists split_groups (
  id         uuid primary key default gen_random_uuid(),
  owner_id   bigint not null references users (id) on delete cascade,
  name       text   not null check (length(trim(name)) between 1 and 60),
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists splits (
  id          uuid primary key default gen_random_uuid(),
  owner_id    bigint not null references users (id) on delete cascade,
  kind        text   not null default 'expense' check (kind in ('expense', 'payment')),
  total       bigint not null check (total > 0),            -- paise
  description text,
  category    text,
  split_date  date   not null,
  method      text   not null default 'equal'
              check (method in ('equal', 'exact', 'shares', 'percent', 'payment')),
  group_id    uuid references split_groups (id) on delete set null,
  -- The bank/cash rows this split explains (any may be null).
  expense_id  uuid references expenses (id) on delete set null,  -- your share row
  lent_id     uuid references expenses (id) on delete set null,  -- the "Lent" row
  income_id   uuid references incomes  (id) on delete set null,  -- a repayment credit
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists splits_owner_idx on splits (owner_id, split_date desc);

-- One row per participant. person_id null = the owner ("you").
create table if not exists split_members (
  split_id  uuid   not null references splits (id) on delete cascade,
  person_id uuid   references people (id) on delete restrict,
  paid      bigint not null default 0 check (paid >= 0),    -- paise
  owed      bigint not null default 0 check (owed >= 0),    -- paise
  weight    numeric check (weight is null or weight > 0),   -- shares / percent input
  unique nulls not distinct (split_id, person_id)
);
create index if not exists split_members_person_idx on split_members (person_id);

-- A repayment credit is still money in the account (balances keep it) but
-- not earnings: income totals skip rows linked to a payment split.
alter table incomes add column if not exists split_id uuid references splits (id) on delete set null;
-- "Is this Rahul paying you back?" answered No: don't ask about it again.
alter table incomes add column if not exists repayment_checked boolean not null default false;

alter table people        enable row level security;
alter table split_groups  enable row level security;
alter table splits        enable row level security;
alter table split_members enable row level security;
grant select, insert, update, delete on people, split_groups, splits, split_members to service_role;
revoke all on people, split_groups, splits, split_members from anon, authenticated;
