-- v25: how a settle-up was paid. 'upi' = started from Aaj's Pay button; its
-- bank alert gets linked to the payment automatically (so paying a friend
-- back never shows up as spending). 'cash' and null are never auto-linked:
-- no bank alert is coming, and guessing would grab an unrelated payment.
alter table splits add column if not exists via text
  check (via is null or via in ('upi', 'cash'));
create index if not exists splits_pending_upi_idx on splits (owner_id, split_date)
  where kind = 'payment' and via = 'upi' and expense_id is null and income_id is null;
