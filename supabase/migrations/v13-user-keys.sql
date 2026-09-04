-- v13: let a user bring their own AI key.
--
-- Google's Gemini quota is per project, so the operator's single free tier is
-- shared by everyone using the app — which stops working the moment there is
-- more than a handful of people.
--
-- The fix that actually scales is for each person to supply their own key:
-- their receipts and their messages then run on their own project's quota,
-- as that quota is meant to be used. The operator's key stays as the fallback
-- for people who don't want to bother.
--
-- Keys are credentials, so this table is service-role only and its contents
-- never appear in any client payload — the same posture as gmail_accounts.
create table if not exists user_api_keys (
  user_id    bigint not null references users (id) on delete cascade,
  provider   text   not null,          -- gemini (groq/anthropic later)
  api_key    text   not null,
  created_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table user_api_keys enable row level security;
