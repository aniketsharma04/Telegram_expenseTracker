-- v20: Aaj Cards — the credit cards a user holds, and what we may assume
-- about them, for the missed-rewards report and next-card suggestions.
--
-- Cards are found in the bank messages ("SBI Credit Card ending 0543") and
-- confirmed by the user, who says which product it is. Kept apart from the
-- ledger's accounts on purpose: naming a card must never move a balance.
create table if not exists user_cards (
  id           uuid primary key default gen_random_uuid(),
  user_id      bigint not null references users (id) on delete cascade,
  bank         text   not null,
  last4        text   check (last4 ~ '^\d{4}$'),
  -- A key into the card catalogue (src/lib/cards/catalog.ts); null until the
  -- user says which card it is, or when it isn't in the catalogue.
  product_key  text,
  added_by     text   not null default 'detected'
               check (added_by in ('detected', 'manual')),
  -- The user said "not mine" / "closed": keep the row so it isn't re-suggested.
  hidden       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- One row per detected card. Cards added by hand have no last4, and
  -- NULLs never collide, so any number of those is fine.
  constraint user_cards_bank_last4_key unique (user_id, bank, last4)
);
create index if not exists user_cards_user_idx on user_cards (user_id);

-- What the user chose to tell us for approval chances. Both optional; the
-- app estimates income from salary credits when monthly_income is null.
create table if not exists card_profiles (
  user_id        bigint primary key references users (id) on delete cascade,
  score_band     text not null default 'unknown'
                 check (score_band in ('750+', '700-749', '650-699', 'below-650', 'unknown')),
  monthly_income numeric check (monthly_income is null or monthly_income >= 0),
  -- "That late fee was reversed": signals up to this moment are set aside.
  stress_cleared_at timestamptz,
  updated_at     timestamptz not null default now()
);

alter table user_cards    enable row level security;
alter table card_profiles enable row level security;
grant select, insert, update, delete on user_cards    to service_role;
grant select, insert, update, delete on card_profiles to service_role;
-- Only the server (service role) touches these. RLS with no policies already
-- blocks the public roles; revoking their default grants says so outright.
revoke all on user_cards    from anon, authenticated;
revoke all on card_profiles from anon, authenticated;
