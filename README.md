# Telegram Expense Tracker

Log expenses by texting a Telegram bot — `300 zomato`, `400 metro card`, `spent 1.2k on groceries yesterday` — and watch them appear on a live web dashboard within seconds.

This is **v2** of the [three-week project plan](./expense-tracker-project-plan.md): the full text/voice → parse → store → visualize pipeline, with an LLM fallback for messy phrasing and in-chat correction commands.

## How it works

```
Telegram message → webhook (/api/telegram on Vercel) → rules parser
      → row in Supabase (Postgres) → realtime push → Next.js dashboard
```

- **Rules parser** (`src/lib/parser.ts`) — pulls the first number as the amount (handles `₹300`, `rs 300`, `1,250`, `1.5k`), matches remaining words against a keyword table in the `categories` table, understands `yesterday`, and falls back to _Uncategorized_ rather than guessing. All dates are computed in IST.
- **Webhook** (`src/app/api/telegram/route.ts`) — verifies Telegram's secret token, ignores chats other than yours, writes the expense, and replies in-chat with a confirmation so bad parses are caught immediately.
- **Dashboard** (`src/components/`) — stat tiles, this-month category breakdown, 30-day daily-spend chart, and a recent-transactions table. Subscribes to Supabase realtime, so new expenses appear without a refresh. Light and dark mode.

## Setup

### 1. Telegram bot

1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the bot token.
2. Message [@userinfobot](https://t.me/userinfobot) to get your numeric chat id (used to lock the bot to you).

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run [`supabase/schema.sql`](./supabase/schema.sql) — it creates the `expenses` and `categories` tables, read-only RLS policies for the dashboard, the realtime publication, and seeds the starter keyword list (Zomato/Swiggy → Food delivery, Zepto/Blinkit → Groceries, metro/Uber/Ola → Transport, …).
3. From **Settings → API**, copy the project URL, the anon key, and the service role key.

### 3. Deploy

1. Copy `.env.example` to `.env.local` and fill in every value.
2. Push to GitHub and import the repo in [Vercel](https://vercel.com); add the same environment variables in the Vercel project settings.
3. Register the webhook against the deployed URL:

   ```bash
   npm run set-webhook
   ```

Text the bot `300 zomato` — it should reply `✅ Logged ₹300 · Food delivery (Zomato)` and the row should appear on the dashboard within a couple of seconds.

## Local development

```bash
npm install
npm run dev        # dashboard at http://localhost:3000
npm test           # parser unit tests
```

The dashboard works locally against the real Supabase project. The webhook needs a public URL, so test it on the Vercel deployment (or a tunnel like `ngrok`).

## Notes

- The service role key is server-only (used by the webhook); the browser only ever sees the anon key, which RLS restricts to `SELECT`.
- The webhook always answers `200` so Telegram doesn't re-deliver messages that were already processed; real errors are logged to the Vercel function logs and reported back in-chat.
- The dashboard URL is unlisted but not yet locked — the access lock ships in v3 per the plan. Don't share the URL until then.

## v2 features

- **LLM fallback** — anything the rules parser can't confidently handle goes to an LLM with a strict JSON schema (`src/lib/llm.ts`). Provider picked from the environment: `GEMINI_API_KEY` (Gemini, default `gemini-2.5-flash`) or `ANTHROPIC_API_KEY` (Claude, default `claude-opus-5`); override the model with `LLM_MODEL`.
- **Clarifying questions** — if even the LLM can't find an amount, the bot asks instead of guessing; uncertain categories get logged with a "reply /category to fix" nudge.
- **Self-improving keywords** — confident LLM categorizations and manual `/category` corrections write the merchant back into the keyword table, so the free rules path handles more over time.
- **Voice notes** — transcribed via Groq Whisper (`GROQ_API_KEY`, free tier) and routed through the same parser.
- **Correction commands** — `/undo`, `/category <name>`, `/amount <n>`, `/last` act on the most recent entry.
- **Dashboard analysis** — date-range presets (this month / 30 / 90 days), category filter with chart emphasis, top-merchants view, and period-over-period comparison. Realtime now reflects updates and deletes too.

## Daily budget (v14)

A monthly income is too big a number to feel, so the app turns it into one number to spend each day:

```
everyday money = income − fixed costs − savings goal
today's budget = (everyday money − everyday spending so far) ÷ days left, today included
```

It's recalculated every morning, so a big day trims the days after it a little and a quiet day gives them more. Fixed costs you list (rent, EMI, SIP, subscriptions), Loans & EMI, Investments, and anything marked **from savings** never touch the daily number. If a fixed cost comes in above its planned amount, only the extra counts as everyday spending.

- **Messages (Telegram):** a morning brief (~7:00 IST), a ping with "₹X left today" on every auto-captured spend, and a night report (~21:30 IST). Only users who set up a plan get them; each can be turned off.
- **Bot:** `/plan 100000` (or `/plan 1 lakh`), `/plan save 15000`, `/fixed rent 25000`, `/fixed remove rent`, `/today`, `/fromsavings`, `/countdaily`, `/plan morning off`.
- **App:** a daily-budget card at the top of Home with the plan editor, and a _Paid from savings_ switch on each expense. The web dashboard shows the same card, read-only.
- **Setup:** run `supabase/migrations/v14-daily-budget.sql`, deploy (adds the `/api/cron/morning` and `/api/cron/evening` crons in `vercel.json`), then `npm run set-commands`.
- Logic: `src/lib/daily-budget.ts` (pure, tested), `src/lib/plan.ts` (DB), `src/lib/briefs.ts` (messages).

## App-first: push, background capture, planning (v15–v17)

The app is becoming the product and the Telegram bot is being retired (plan: [`docs/superpowers/specs/2026-10-24-app-first-roadmap-design.md`](./docs/superpowers/specs/2026-10-24-app-first-roadmap-design.md)).

- **Push + inbox (v15):** every notice is stored in an in-app inbox, then pushed to the user's phones through Expo's push service (Firebase on Android, APNs on iOS). Telegram keeps a copy while the bot exists. `src/lib/notify.ts`, `src/lib/push.ts`, `/api/push`, `/api/notifications`.
- **Background capture:** captured bank/UPI/SMS notifications upload from native code via WorkManager as they happen, not when the app is next opened. OTP messages with a code are dropped on the phone. A setup card on Home walks through notification access, the battery exemption and Autostart (Xiaomi/Oppo/Vivo/OnePlus), and is also the Play "prominent disclosure".
- **Salary-cycle months (v16):** with a payday set, the budget month runs salary to salary.
- **Goals (v17):** each goal's monthly share comes off the top; on the first morning of a budget month goals are credited automatically, minus any overspend.

### One-time setup for push

1. Firebase console → new project → add an Android app with package `com.aniketsharma.expensetracker` → download `google-services.json` into `mobile/` (picked up by `mobile/app.config.js`).
2. Firebase → Project settings → Service accounts → generate a key, then `cd mobile && eas credentials` → Android → _FCM V1 service account key_ → upload it.
3. Rebuild the app with EAS. Migrations v14–v17 must be applied (`supabase db query --linked -f supabase/migrations/<file>`).

## Roadmap

- **v3** — receipt OCR, budgets and proactive alerts, monthly auto-summary, dashboard access lock.
- **Post-v3** — multi-user support (per-user expenses + Telegram-login dashboard).

See the [full project plan](./expense-tracker-project-plan.md) for details.
