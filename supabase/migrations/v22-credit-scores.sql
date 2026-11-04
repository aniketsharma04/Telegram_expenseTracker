-- v22: credit scores the user saw (on Google Pay, PhonePe, Paytm, CRED or a
-- bureau's site) and saved in Aaj, to track over time and to set the card
-- finder's score band. Aaj does not pull credit reports: an app that isn't a
-- lender may only do that under a bureau contract (RBI CIC Directions 2025,
-- para 24). See research_notes/Credit score/research.md.
create table if not exists credit_scores (
  id          uuid primary key default gen_random_uuid(),
  user_id     bigint not null references users (id) on delete cascade,
  bureau      text   not null check (bureau in ('cibil', 'experian', 'equifax', 'crif')),
  score       int    not null check (score between 300 and 900),
  checked_on  date   not null,
  -- Where they saw it: gpay, phonepe, paytm, cred, bureau, bank, other.
  via         text,
  created_at  timestamptz not null default now()
);
create index if not exists credit_scores_user_idx
  on credit_scores (user_id, checked_on desc);

alter table credit_scores enable row level security;
grant select, insert, update, delete on credit_scores to service_role;
-- Server only, like the other card tables.
revoke all on credit_scores from anon, authenticated;
