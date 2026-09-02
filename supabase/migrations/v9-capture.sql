-- v9: auto-capture from bank messages.
--
-- Bank SMS and push notifications are the closest thing to a live feed of
-- your account without an Account Aggregator licence. Two things come out of
-- every message:
--
--   1. the transaction itself      → an expense or an income row
--   2. the balance the bank states → the truth to reconcile against
--
-- (2) is the important half. Inferring a balance by subtracting our own
-- records drifts the moment one message is missed; reading the bank's own
-- number turns that drift into something visible and fixable.

-- ── Raw message log ─────────────────────────────────────────────────────────
-- Kept verbatim so any detection can be explained ("why did you log this?")
-- and so a parser improvement can be replayed over old messages.
create table if not exists bank_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      bigint not null references users (id) on delete cascade,
  source       text   not null,                  -- notification | sms | telegram | email
  external_id  text,                             -- notification key / sms id; null when forwarded by hand
  received_at  timestamptz not null default now(),
  body         text   not null,

  -- Parse result, flattened for querying.
  direction    text,                             -- debit | credit
  amount       numeric,
  account_hint text,
  balance      numeric,                          -- balance the bank reported after the txn
  counterparty text,
  reference    text,
  channel      text,                             -- upi | card | atm | netbanking | unknown
  confidence   text,                             -- high | low

  status       text   not null default 'pending', -- logged | duplicate | ignored | needs_review
  note         text,                              -- why it was skipped, when it was

  account_id   uuid references accounts (id) on delete set null,
  expense_id   uuid references expenses (id) on delete set null,
  income_id    uuid references incomes (id) on delete set null,

  created_at   timestamptz not null default now()
);

-- Re-delivering the same notification must not log the same rupee twice.
-- (Postgres treats NULLs as distinct, so hand-forwarded messages are exempt.)
create unique index if not exists bank_messages_external_idx
  on bank_messages (user_id, source, external_id)
  where external_id is not null;

-- The window query that catches the same txn arriving by two channels.
create index if not exists bank_messages_dedupe_idx
  on bank_messages (user_id, amount, received_at desc);

-- ── The bank's own balance, held next to ours ───────────────────────────────
-- `reported_balance` is what the bank last told us; the computed balance is
-- what our rows add up to. The difference between them is the reconciliation
-- backlog, and showing it is the point.
alter table accounts add column if not exists reported_balance numeric;
alter table accounts add column if not exists reported_at      timestamptz;

-- Which message a row came from, so an auto-captured entry can be traced
-- back to the SMS that created it.
alter table expenses add column if not exists captured_from uuid references bank_messages (id) on delete set null;
alter table incomes  add column if not exists captured_from uuid references bank_messages (id) on delete set null;

alter table bank_messages enable row level security;
