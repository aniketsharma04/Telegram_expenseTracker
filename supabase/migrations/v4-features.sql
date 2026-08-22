-- v4: budgets + alerts, income tracking, split expenses.
-- Run in the Supabase SQL editor (or via the management API).

-- ── Budgets (per user; category null = overall monthly cap) ─────────────────
create table if not exists budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     bigint not null references users (id) on delete cascade,
  category    text,                    -- null = overall spending cap
  monthly_cap numeric not null check (monthly_cap > 0),
  created_at  timestamptz not null default now()
);
-- Nulls are distinct in plain UNIQUE, so enforce one-overall-per-user via coalesce.
create unique index if not exists budgets_user_cat_uidx
  on budgets (user_id, coalesce(category, '__overall__'));

-- One row per alert actually sent, so crossing 80%/100% only pings once a month.
create table if not exists budget_alerts (
  budget_id uuid   not null references budgets (id) on delete cascade,
  month     text   not null,  -- YYYY-MM
  level     int    not null,  -- 80 or 100
  sent_at   timestamptz not null default now(),
  primary key (budget_id, month, level)
);

-- ── Income (per user; family sees only expenses, income stays personal) ─────
create table if not exists incomes (
  id          uuid primary key default gen_random_uuid(),
  user_id     bigint not null references users (id) on delete cascade,
  amount      numeric not null check (amount > 0),
  source      text,               -- "Salary", "Freelance", …
  income_date date not null,
  raw_message text,
  channel     text,               -- telegram / app_form
  logged_at   timestamptz not null default now()
);
create index if not exists incomes_user_idx on incomes (user_id, income_date);

-- ── Split expenses ──────────────────────────────────────────────────────────
-- A split creates one expense row per participant (their share). paid_by
-- records who fronted the money; split_id groups the rows.
alter table expenses add column if not exists paid_by  bigint references users (id);
alter table expenses add column if not exists split_id uuid;
create index if not exists expenses_split_idx on expenses (split_id) where split_id is not null;

-- ── Row-level security: same posture as v3 — no anon policies at all. ───────
alter table budgets       enable row level security;
alter table budget_alerts enable row level security;
alter table incomes       enable row level security;
