-- v7: bill auto-detection without BBPS.
--
-- Two sources feed one inbox of "detected bills" the user confirms or
-- dismisses: Gmail (this phase) and the Android notification listener
-- (next phase). Confirming a detection creates or updates a real `bills`
-- row, so everything downstream — reminders, mark-paid, the Bills tab —
-- works unchanged.

-- ── Gmail connection (one per user) ─────────────────────────────────────────
-- The refresh token is a long-lived credential: service-role only, never
-- exposed through /api/data or any client-readable payload.
create table if not exists gmail_accounts (
  user_id       bigint primary key references users (id) on delete cascade,
  email         text not null,
  refresh_token text not null,
  scope         text,
  connected_at  timestamptz not null default now(),
  last_sync_at  timestamptz,
  last_error    text
);

-- ── Detected bills (the confirm/dismiss inbox) ──────────────────────────────
create table if not exists detected_bills (
  id           uuid primary key default gen_random_uuid(),
  user_id      bigint not null references users (id) on delete cascade,
  source       text   not null,                  -- gmail | notification
  external_id  text   not null,                  -- gmail message id / notification key
  biller_name  text   not null,                  -- "BSES Rajdhani", "HDFC Bank Credit Card"
  kind         text   not null default 'other',  -- same vocabulary as bills.kind
  amount       numeric check (amount > 0),
  due_date     date,
  bill_date    date,
  account_hint text,                             -- masked card/consumer no. ("••4321")
  subject      text,
  snippet      text,                             -- short excerpt, for "why did you think this?"
  confidence   text not null default 'low',      -- high | low
  status       text not null default 'pending',  -- pending | linked | dismissed
  bill_id      uuid references bills (id) on delete set null,
  detected_at  timestamptz not null default now(),
  -- Re-syncing the same message must not create a second row.
  unique (user_id, source, external_id)
);
create index if not exists detected_bills_pending_idx
  on detected_bills (user_id, detected_at desc)
  where status = 'pending';

-- Which detection a bill came from (null for manually created bills).
alter table bills add column if not exists detected_from text;   -- gmail | notification

alter table gmail_accounts enable row level security;
alter table detected_bills enable row level security;
