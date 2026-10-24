-- v17: goals — the "ahead" part of planning.
--
-- A goal's monthly amount comes off the top of the budget month (like the
-- savings goal), so the daily number already leaves room for it. When a
-- budget month closes, goals are credited automatically; an overspent month
-- takes its overspend out of those credits.
create table if not exists goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       bigint  not null references users (id) on delete cascade,
  name          text    not null,
  target_amount numeric not null check (target_amount > 0),
  monthly       numeric not null default 0 check (monthly >= 0),
  saved         numeric not null default 0 check (saved >= 0),
  target_date   date,
  active        boolean not null default true,
  achieved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists goals_user_idx on goals (user_id) where active;

-- One credit per goal per budget month: re-running the cron can't double-count.
create table if not exists goal_credits (
  goal_id     uuid    not null references goals (id) on delete cascade,
  cycle_start date    not null,
  amount      numeric not null check (amount >= 0),
  credited_at timestamptz not null default now(),
  primary key (goal_id, cycle_start)
);

alter table goals        enable row level security;
alter table goal_credits enable row level security;
