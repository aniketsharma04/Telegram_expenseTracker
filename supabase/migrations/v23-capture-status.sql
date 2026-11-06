-- v23: what each phone last reported about capture, so a broken reader can be
-- diagnosed without the phone in hand. One row per user, overwritten on each
-- app open. Status only (permission, timestamps, versions): never message text.
create table if not exists capture_status (
  user_id     bigint primary key references users (id) on delete cascade,
  reported_at timestamptz not null default now(),
  report      jsonb not null default '{}'::jsonb
);

alter table capture_status enable row level security;
grant select, insert, update, delete on capture_status to service_role;
revoke all on capture_status from anon, authenticated;
