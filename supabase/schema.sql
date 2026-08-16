-- Expense tracker — v1 schema
-- Run this in the Supabase SQL editor (or `supabase db push` if using the CLI).

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists categories (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  keywords       text[] not null default '{}',
  color          text,                -- hex used by dashboard charts
  monthly_budget numeric              -- used in v3
);

create table if not exists expenses (
  id           uuid primary key default gen_random_uuid(),
  amount       numeric not null check (amount > 0),
  category     text not null default 'Uncategorized' references categories (name),
  merchant     text,
  raw_message  text,                  -- original message, for debugging parser misses
  source       text not null default 'telegram_text',   -- telegram_text / telegram_voice / telegram_photo
  parsed_by    text not null default 'rules',           -- 'rules' or 'llm'
  expense_date date not null default current_date,      -- when the money was spent
  logged_at    timestamptz not null default now()       -- when the message arrived
);

create index if not exists expenses_expense_date_idx on expenses (expense_date desc);
create index if not exists expenses_category_idx on expenses (category);

-- ── Row-level security ───────────────────────────────────────────────────────
-- The dashboard reads with the anon key (select only). The webhook writes with
-- the service role key, which bypasses RLS.

alter table categories enable row level security;
alter table expenses enable row level security;

drop policy if exists "anon can read categories" on categories;
create policy "anon can read categories"
  on categories for select to anon using (true);

drop policy if exists "anon can read expenses" on expenses;
create policy "anon can read expenses"
  on expenses for select to anon using (true);

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Push INSERTs to the dashboard so new expenses appear without a refresh.
alter publication supabase_realtime add table expenses;

-- ── Seed categories ──────────────────────────────────────────────────────────
-- Colors are the validated categorical palette used by the dashboard.
insert into categories (name, keywords, color) values
  ('Food delivery',  '{zomato,swiggy,dominos,"pizza hut",kfc,mcdonalds,"eatsure",faasos}', '#2a78d6'),
  ('Groceries',      '{zepto,blinkit,bigbasket,instamart,jiomart,dmart,grocery,groceries,sabzi,vegetables}', '#eb6834'),
  ('Transport',      '{metro,"metro card",uber,ola,rapido,auto,rickshaw,bus,train,cab,taxi,petrol,diesel,fuel,fastag,parking}', '#1baf7a'),
  ('Shopping',       '{amazon,flipkart,myntra,ajio,meesho,nykaa,decathlon,ikea,clothes,shoes}', '#eda100'),
  ('Entertainment',  '{netflix,spotify,hotstar,"prime video",bookmyshow,movie,movies,concert,game,steam}', '#e87ba4'),
  ('Utilities & bills', '{electricity,water,gas,cylinder,recharge,jio,airtel,vi,wifi,broadband,rent,maintenance,bill}', '#008300'),
  ('Health',         '{medicine,medicines,pharmacy,pharmeasy,1mg,apollo,doctor,hospital,gym,protein}', '#4a3aa7'),
  ('Dining out',     '{restaurant,cafe,coffee,starbucks,chai,lunch,dinner,breakfast,snacks,"street food",juice}', '#e34948'),
  ('Uncategorized',  '{}', '#898781')
on conflict (name) do nothing;
