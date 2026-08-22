-- v5: bills module — registered recurring bills, due tracking, pay-now via UPI,
-- mark-paid → expense. consumer_number / biller_id are reserved for a future
-- BBPS (Bharat BillPay) live-fetch integration; nothing reads them yet.

create table if not exists bills (
  id              uuid primary key default gen_random_uuid(),
  user_id         bigint not null references users (id) on delete cascade,
  name            text not null,                 -- "BSES Electricity"
  kind            text not null,                 -- electricity | water | gas | credit_card | rent | internet | mobile | insurance | other
  category        text not null,                 -- expense category used when marked paid
  due_day         int  not null check (due_day between 1 and 31),
  amount          numeric check (amount > 0),    -- usual amount; null = varies
  upi_id          text,                          -- payee VPA for Pay now (optional)
  payee_name      text,
  consumer_number text,                          -- BBPS: customer/consumer id (future)
  biller_id       text,                          -- BBPS: biller id (future)
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists bills_user_idx on bills (user_id) where active;

-- One payment per bill per billing month; links to the expense it created.
create table if not exists bill_payments (
  id         uuid primary key default gen_random_uuid(),
  bill_id    uuid   not null references bills (id) on delete cascade,
  user_id    bigint not null references users (id) on delete cascade,
  month      text   not null,                    -- YYYY-MM billing cycle
  amount     numeric not null check (amount > 0),
  paid_on    date   not null,
  expense_id uuid   references expenses (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bill_id, month)
);

alter table bills         enable row level security;
alter table bill_payments enable row level security;
