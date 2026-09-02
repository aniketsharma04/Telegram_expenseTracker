-- v8: the ledger foundation.
--
-- Until now a rupee had an amount, a category and a date — but no pocket.
-- This migration gives every money row an account, and introduces the two
-- row types that were previously (and wrongly) recorded as spending:
--
--   • transfers      — moving your own money between your own accounts
--   • card payments  — paying a credit card bill; the spending already
--                      happened when the card was swiped
--
-- Everything downstream (net worth, reconciliation, forecasting) needs
-- account-level truth, so this lands before any of it.

-- ── Accounts ────────────────────────────────────────────────────────────────
-- `opening_balance` is the balance on the day you start tracking the account;
-- the live balance is opening + incomes + transfers in − expenses − transfers out.
-- A credit card's balance runs negative — that negative is what you owe.
create table if not exists accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         bigint not null references users (id) on delete cascade,
  name            text   not null,
  kind            text   not null default 'bank',   -- bank | cash | wallet | credit_card
  identifier      text,                             -- "••4321", a UPI handle — display only
  opening_balance numeric not null default 0,
  credit_limit    numeric,                          -- credit_card only
  statement_day   smallint check (statement_day between 1 and 31),
  due_day         smallint check (due_day between 1 and 31),
  is_default      boolean not null default false,
  archived        boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists accounts_user_idx
  on accounts (user_id) where not archived;

-- Exactly one default account per user, so an untagged expense always has
-- somewhere obvious to land.
create unique index if not exists accounts_one_default_idx
  on accounts (user_id) where is_default and not archived;

-- ── Which pocket did it come from / land in ─────────────────────────────────
-- Nullable on purpose: eight months of history has no account, and a null
-- reads as "unassigned" rather than forcing a guess.
alter table expenses add column if not exists account_id uuid references accounts (id) on delete set null;
alter table incomes  add column if not exists account_id uuid references accounts (id) on delete set null;

create index if not exists expenses_account_idx on expenses (account_id) where account_id is not null;
create index if not exists incomes_account_idx  on incomes  (account_id) where account_id is not null;

-- ── Transfers ───────────────────────────────────────────────────────────────
-- Self-transfers are not spending. Recording them explicitly is what stops
-- "moved ₹20,000 to the wallet" from showing up as a ₹20,000 expense.
--
-- kind:
--   transfer     — ordinary movement between two of your own accounts
--   card_payment — paying a credit card bill (to_account_id is the card)
create table if not exists transfers (
  id              uuid primary key default gen_random_uuid(),
  user_id         bigint not null references users (id) on delete cascade,
  from_account_id uuid references accounts (id) on delete set null,
  to_account_id   uuid references accounts (id) on delete set null,
  amount          numeric not null check (amount > 0),
  transfer_date   date   not null,
  kind            text   not null default 'transfer',
  note            text,
  -- Set when this transfer settles a bill, so undoing the payment removes it.
  bill_payment_id uuid references bill_payments (id) on delete cascade,
  created_at      timestamptz not null default now(),
  -- Money has to come from somewhere or go somewhere.
  check (from_account_id is not null or to_account_id is not null),
  check (from_account_id is distinct from to_account_id)
);

create index if not exists transfers_user_date_idx
  on transfers (user_id, transfer_date desc);

-- ── Merchant normalisation ──────────────────────────────────────────────────
-- "SWIGGY*ORDER8823", "Swiggy Ltd" and "swiggy" are one merchant. Rows with
-- user_id null are shared defaults; a user's own row wins over a default.
create table if not exists merchants (
  id         uuid primary key default gen_random_uuid(),
  user_id    bigint references users (id) on delete cascade,
  pattern    text not null,        -- lowercase substring to look for
  canonical  text not null,        -- the display name it maps to
  category   text,                 -- optional category hint
  created_at timestamptz not null default now()
);

create unique index if not exists merchants_pattern_idx
  on merchants (coalesce(user_id, 0), pattern);

-- Seed the merchants that show up in almost every Indian statement.
insert into merchants (user_id, pattern, canonical, category) values
  (null, 'swiggy',     'Swiggy',      'Food & dining'),
  (null, 'zomato',     'Zomato',      'Food & dining'),
  (null, 'blinkit',    'Blinkit',     'Groceries'),
  (null, 'zepto',      'Zepto',       'Groceries'),
  (null, 'bigbasket',  'BigBasket',   'Groceries'),
  (null, 'dmart',      'DMart',       'Groceries'),
  (null, 'amazon',     'Amazon',      'Shopping'),
  (null, 'flipkart',   'Flipkart',    'Shopping'),
  (null, 'myntra',     'Myntra',      'Shopping'),
  (null, 'uber',       'Uber',        'Transport'),
  (null, 'ola',        'Ola',         'Transport'),
  (null, 'rapido',     'Rapido',      'Transport'),
  (null, 'irctc',      'IRCTC',       'Travel'),
  (null, 'indigo',     'IndiGo',      'Travel'),
  (null, 'makemytrip', 'MakeMyTrip',  'Travel'),
  (null, 'netflix',    'Netflix',     'Entertainment'),
  (null, 'spotify',    'Spotify',     'Entertainment'),
  (null, 'hotstar',    'Hotstar',     'Entertainment'),
  (null, 'jio',        'Jio',         'Utilities & bills'),
  (null, 'airtel',     'Airtel',      'Utilities & bills'),
  (null, 'apollo',     'Apollo Pharmacy', 'Health'),
  (null, 'pharmeasy',  'PharmEasy',   'Health'),
  (null, 'cred',       'CRED',        'Loans & EMI')
on conflict do nothing;

-- ── Row-level security ──────────────────────────────────────────────────────
-- Same posture as every table since v3: RLS on, no anon policies. The API
-- reaches these through the service role after checking the session.
alter table accounts  enable row level security;
alter table transfers enable row level security;
alter table merchants enable row level security;
