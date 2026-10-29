-- v16: budget months run from salary to salary.
--
-- Paid on the 30th, your month starts on the 30th — not three days later on
-- the 1st, after the daily number has already reset against money you don't
-- have yet. Null keeps calendar months.
alter table budget_plans add column if not exists payday int
  check (payday between 1 and 31);
