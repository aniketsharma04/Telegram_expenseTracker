-- v6: BBPS (Bharat Connect) auto-fetch for bills.
-- A bill linked to a biller stores the customer identifiers and the last
-- fetched amount/due date. Provider = Setu when keys exist, else a built-in
-- mock with realistic billers so the flow works end-to-end before onboarding.

alter table bills add column if not exists biller_name           text;
alter table bills add column if not exists fetch_params          jsonb;        -- {"Consumer Number": "1234…"}
alter table bills add column if not exists fetched_amount        numeric;      -- rupees
alter table bills add column if not exists fetched_due_date      date;
alter table bills add column if not exists fetched_bill_date     date;
alter table bills add column if not exists fetched_bill_number   text;
alter table bills add column if not exists fetched_customer_name text;
alter table bills add column if not exists fetched_ref_id        text;         -- BBPS refId of the last fetch (needed to pay via BBPS)
alter table bills add column if not exists fetched_at            timestamptz;
alter table bills add column if not exists fetch_error           text;

-- Biller directory cache (Setu lists ~21k billers; synced by the daily cron).
create table if not exists bbps_billers (
  id         text primary key,
  name       text not null,
  category   text not null,
  params     jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists bbps_billers_name_idx on bbps_billers (lower(name));
create index if not exists bbps_billers_category_idx on bbps_billers (category);

alter table bbps_billers enable row level security;
