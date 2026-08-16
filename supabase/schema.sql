-- Expense tracker — v1 schema
-- Run this in the Supabase SQL editor (or `supabase db push` if using the CLI).

-- For an existing installation, also run migrations/v3-multiuser.sql.
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
  ('Food delivery',  '{zomato,swiggy,dominos,"pizza hut",kfc,mcdonalds,"burger king","eatsure",faasos}', '#2a78d6'),
  ('Groceries',      '{zepto,blinkit,bigbasket,instamart,jiomart,dmart,grocery,groceries,sabzi,vegetables,fruits,milk,kirana,ration}', '#eb6834'),
  ('Transport',      '{metro,"metro card",uber,ola,rapido,auto,rickshaw,bus,train,cab,taxi,petrol,diesel,fuel,fastag,parking,toll}', '#1baf7a'),
  ('Shopping',       '{amazon,flipkart,myntra,ajio,meesho,nykaa,decathlon,ikea,croma,clothes,shoes,jeans,tshirt,electronics}', '#eda100'),
  ('Entertainment',  '{netflix,spotify,hotstar,"prime video",bookmyshow,movie,movies,concert,game,games,steam,"youtube premium"}', '#e87ba4'),
  ('Utilities & bills', '{electricity,"water bill",gas,cylinder,recharge,jio,airtel,wifi,broadband,rent,maintenance,bill,dth,postpaid,insurance,premium,lic,mediclaim}', '#008300'),
  ('Health',         '{medicine,medicines,pharmacy,pharmeasy,1mg,apollo,doctor,hospital,dentist,clinic,"lab test",gym,protein}', '#4a3aa7'),
  ('Dining out',     '{restaurant,cafe,coffee,starbucks,chai,tea,lunch,dinner,breakfast,snacks,"street food",juice,dhaba,"ice cream",icecream}', '#e34948'),
  ('Personal care',  '{barber,haircut,salon,spa,grooming,shave,facial,parlour,cosmetics,shampoo,soap,skincare,laundry}', '#d55181'),
  ('Investments',    '{invest,invested,investment,sip,"mutual fund",stocks,shares,zerodha,groww,upstox,etf,gold,sgb,fd,rd,ppf,nps,crypto,bitcoin}', '#104281'),
  ('Loans & EMI',    '{emi,loan,"credit card",cred,repayment,interest,borrowed,udhaar}', '#86b6ef'),
  ('Travel',         '{flight,flights,hotel,irctc,makemytrip,goibibo,airbnb,oyo,trip,vacation,holiday,visa,indigo,"air india","train ticket"}', '#199e70'),
  ('Education',      '{course,udemy,coursera,book,books,tuition,exam,fees,certification,stationery}', '#9085e9'),
  ('Gifts & donations', '{gift,gifts,donation,charity,temple,wedding,birthday}', '#c98500'),
  ('Uncategorized',  '{}', '#898781')
on conflict (name) do nothing;
