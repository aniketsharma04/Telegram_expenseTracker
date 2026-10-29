-- v14: the daily budget.
--
-- "1 lakh a month" feels like a lot; "₹1,667 today" is a number you can
-- actually spend against. The daily number is
--
--     (income − fixed costs − savings goal − everyday spending so far)
--     ÷ days left in the month
--
-- recomputed every morning, so a big day trims the days after it a little
-- and a quiet day gives them a little more.
--
-- Fixed costs (rent, EMI, SIP, subscriptions) come off the top and never
-- touch the daily number, and a one-off can be marked "from savings".

-- ── The plan: one row per user ──────────────────────────────────────────────
create table if not exists budget_plans (
  user_id        bigint primary key references users (id) on delete cascade,
  monthly_income numeric check (monthly_income > 0),  -- null = use last month's logged income
  savings_goal   numeric not null default 0 check (savings_goal >= 0),
  morning_brief  boolean not null default true,       -- "good morning, ₹1,667 today"
  evening_report boolean not null default true,       -- the end-of-day report
  live_updates   boolean not null default true,       -- a ping per auto-captured spend
  updated_at     timestamptz not null default now()
);

-- ── Fixed monthly costs, taken off the top ──────────────────────────────────
-- `match` is a word that identifies the payment when it's captured
-- ("rent", "hdfc emi", "netflix"); without one, the category + an amount
-- within ±30% does the matching.
create table if not exists commitments (
  id         uuid primary key default gen_random_uuid(),
  user_id    bigint not null references users (id) on delete cascade,
  name       text    not null,
  amount     numeric not null check (amount > 0),
  category   text,
  match      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists commitments_user_idx on commitments (user_id) where active;

-- ── Per-expense override ────────────────────────────────────────────────────
-- null    = decide automatically
-- daily   = counts against the daily budget, whatever it looks like
-- fixed   = a planned fixed cost
-- savings = paid from savings; doesn't touch the daily number
alter table expenses add column if not exists budget_scope text
  check (budget_scope in ('daily', 'fixed', 'savings'));

-- Same posture as every other table since v3: service role only.
alter table budget_plans enable row level security;
alter table commitments  enable row level security;
