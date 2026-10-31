-- v19: subscriptions — repeat charges the user decides to keep or cancel.
--
-- Rows come from the daily scan of expenses (known services, or a charge that
-- repeats monthly in a discretionary category). `status` is the user's
-- decision: 'new' until they answer, then 'keep' or 'cancel'. A 'cancel' row
-- becomes 'cancelled' once a renewal date passes with no charge, which is
-- when the app counts the money as saved.
create table if not exists subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       bigint  not null references users (id) on delete cascade,
  merchant_key  text    not null,
  merchant      text    not null,
  category      text,
  amount        numeric not null check (amount >= 0),
  last_charged  date,
  next_date     date,
  status        text    not null default 'new'
                check (status in ('new', 'keep', 'cancel', 'cancelled')),
  decided_at    timestamptz,
  cancelled_at  timestamptz,
  -- Last time the user was told about this row, so the cron says it once.
  notified      text,
  created_at    timestamptz not null default now(),
  unique (user_id, merchant_key)
);
create index if not exists subscriptions_user_idx on subscriptions (user_id);

alter table subscriptions enable row level security;
-- Server only. Newer Supabase projects no longer grant new tables to the API
-- roles by default, so say it outright; anon and authenticated get nothing.
grant select, insert, update, delete on subscriptions to service_role;
