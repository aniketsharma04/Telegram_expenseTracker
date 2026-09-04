-- v12: accounts that don't require Telegram.
--
-- Until now `users.id` WAS the Telegram chat id, so "having an account" and
-- "having Telegram" were the same fact. That's fine for one person and fatal
-- for a product: no Telegram, no way in.
--
-- The fix keeps the internal id as it is — every table in the schema
-- references users(id), and rewriting that would touch everything — and
-- instead separates *identity* from *the Telegram channel*:
--
--   users.email            → sign in with an email code
--   users.telegram_id → where to send Telegram messages, if linked at all
--
-- Existing rows are Telegram users, so their chat id is backfilled from the
-- id they already have. Nothing about their setup changes.

-- ── Identity ────────────────────────────────────────────────────────────────
alter table users add column if not exists email            text;
alter table users add column if not exists telegram_id bigint;
alter table users add column if not exists display_name     text;
-- DPDP: record that the person agreed, and when.
alter table users add column if not exists consent_at       timestamptz;
-- Soft delete so an erasure request is auditable before the purge runs.
alter table users add column if not exists deleted_at       timestamptz;

create unique index if not exists users_email_idx
  on users (lower(email)) where email is not null;
create unique index if not exists users_telegram_idx
  on users (telegram_id) where telegram_id is not null;

-- Everyone who exists today arrived through Telegram.
update users set telegram_id = id where telegram_id is null;

-- New accounts get ids from a range Telegram will never occupy, so the two
-- kinds of user can never collide.
create sequence if not exists app_user_id_seq
  as bigint start with 9000000000000 increment by 1;

-- ── Email sign-in codes ─────────────────────────────────────────────────────
-- Codes are stored hashed: a leaked table must not be a set of live logins.
create table if not exists auth_codes (
  id          uuid primary key default gen_random_uuid(),
  email       text        not null,
  code_hash   text        not null,
  expires_at  timestamptz not null,
  attempts    smallint    not null default 0,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists auth_codes_email_idx on auth_codes (lower(email), created_at desc);

-- ── Linking Telegram to an existing account ─────────────────────────────────
-- The app shows a short code; sending it to the bot attaches that chat to
-- the account, so notifications work without Telegram being the login.
create table if not exists link_codes (
  code       text primary key,
  user_id    bigint not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ── Per-user usage, for cost control ────────────────────────────────────────
-- One row per user per day per kind. Cheap to increment, trivial to read,
-- and self-limiting in size.
create table if not exists usage_counters (
  user_id bigint not null references users (id) on delete cascade,
  day     date   not null,
  kind    text   not null,            -- llm_text | llm_vision | voice | ingest
  count   integer not null default 0,
  primary key (user_id, day, kind)
);

alter table auth_codes     enable row level security;
alter table link_codes     enable row level security;
alter table usage_counters enable row level security;
