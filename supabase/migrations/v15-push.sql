-- v15: the app talks to you directly — push notifications and an inbox.
--
-- Until now every message (reminders, alerts, the daily brief) went out over
-- Telegram, which is on its way out. Now every notice is stored first (the
-- inbox), then pushed to the user's devices. A blocked or missed push loses
-- nothing — the app shows it next time it opens.

-- ── Device push tokens (Expo push tokens, delivered via FCM / APNs) ─────────
create table if not exists push_tokens (
  token      text primary key,               -- one device = one token = one user
  user_id    bigint not null references users (id) on delete cascade,
  platform   text   not null check (platform in ('android', 'ios')),
  active     boolean not null default true,  -- false after DeviceNotRegistered
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on push_tokens (user_id) where active;

-- ── The inbox ───────────────────────────────────────────────────────────────
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    bigint not null references users (id) on delete cascade,
  kind       text   not null,                -- daily | spend | alerts | digest
  title      text   not null,
  body       text   not null,
  data       jsonb  not null default '{}',
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on notifications (user_id) where read_at is null;

-- Service role only, as everywhere since v3.
alter table push_tokens   enable row level security;
alter table notifications enable row level security;
