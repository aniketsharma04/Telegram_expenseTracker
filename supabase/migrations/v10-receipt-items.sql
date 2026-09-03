-- v10: keep the whole bill, not just the total.
--
-- A restaurant bill is ten decisions, not one. Storing only "₹2,400 at Barbeque
-- Nation" throws away everything that makes the number explainable: what was
-- ordered, what each thing cost, how much was tax and how much was tip.
--
-- Two tables, one row per bill and one per line:
--   receipts      — the bill's own header (totals, tax, bill number)
--   receipt_items — every line on it
--
-- Both hang off the expense, so nothing about existing spend queries changes:
-- an expense with no receipt behaves exactly as it always has.

-- ── The bill header ─────────────────────────────────────────────────────────
create table if not exists receipts (
  expense_id  uuid primary key references expenses (id) on delete cascade,
  user_id     bigint not null references users (id) on delete cascade,
  merchant    text,
  bill_number text,
  bill_date   date,

  -- Kept separately because they answer different questions: subtotal is what
  -- you chose to buy, tax and tip are what the situation added.
  subtotal    numeric,
  tax         numeric,
  discount    numeric,
  tip         numeric,
  total       numeric,
  currency    text not null default 'INR',

  /*
   * Whether the lines add up. Set once at parse time so the app can show
   * "read 9 of 10 lines" instead of quietly presenting a wrong breakdown.
   */
  items_total numeric,
  reconciled  boolean not null default false,

  source      text,          -- app_photo | telegram_photo
  created_at  timestamptz not null default now()
);

create index if not exists receipts_user_idx on receipts (user_id, bill_date desc);

-- ── The lines ───────────────────────────────────────────────────────────────
create table if not exists receipt_items (
  id         uuid primary key default gen_random_uuid(),
  expense_id uuid   not null references expenses (id) on delete cascade,
  user_id    bigint not null references users (id) on delete cascade,
  line_no    smallint not null,        -- order on the printed bill
  name       text   not null,
  quantity   numeric,                  -- 2, or 0.5 for weighed goods
  unit_price numeric,
  amount     numeric not null,         -- the line total as printed
  created_at timestamptz not null default now()
);

create index if not exists receipt_items_expense_idx on receipt_items (expense_id, line_no);
-- Supports "what do I actually order?" across every bill.
create index if not exists receipt_items_user_name_idx on receipt_items (user_id, name);

alter table receipts      enable row level security;
alter table receipt_items enable row level security;
