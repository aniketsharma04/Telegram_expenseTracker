# Personal Expense Tracker — End-to-End Project Plan

A Telegram bot for logging expenses in plain text ("300 zomato", "400 metro card"), paired with a web dashboard for reports. Built as a 3-week, three-phase project: v1 → v2 → v3.

---

## 1. Overview

Telegram is the input surface — always open, zero friction, nothing to install. The dashboard is the analysis surface — a proper UI for tables, charts, and trends that a chat window can't do well. The two are connected through a shared database but stay separate, so each one is good at its own job instead of compromising on both.

## 2. Goals

- Logging an expense should take under 5 seconds, from anywhere, without opening an app or a browser.
- No rigid formatting required — free text should parse correctly almost all the time.
- Turn logged expenses into an actual picture of spending: by category, by month, by merchant.
- Ship something usable in week 1, not just infrastructure — motivation dies if there's nothing to show for two weeks of plumbing.
- End up as a project worth linking on LinkedIn or in a portfolio, the same way MetroSaathi is.

## 3. Scope

**In scope**

- Text-based expense logging via Telegram (v1)
- Rules-based parsing with an LLM fallback for messy phrasing (v1–v2)
- Voice-note logging (v2)
- Receipt photo logging via OCR (v3)
- A web dashboard: transaction list, category breakdown, trends, filtering (v1–v2)
- Budgets and proactive alerts (v3)
- Single-user only, with a basic access lock on the dashboard — no full auth system

**Out of scope, for now**

- Multi-user or shared/family budgets
- Direct bank statement or UPI auto-import
- Investment or net-worth tracking
- A native mobile app — Telegram already is the mobile surface
- Public launch, monetization, or supporting other users — this is a personal tool and portfolio piece first; anything beyond that is a separate future decision

## 4. System Architecture

**Components**

1. **Telegram bot** — the only interface actively typed into. Text first, then voice and photos.
2. **Webhook (serverless function)** — receives every Telegram update; the single entry point into the backend.
3. **Parser** — turns a raw message into structured data: amount, category, merchant, date. Rules-based first, LLM fallback second.
4. **Database (Supabase/Postgres)** — the single source of truth, and pushes realtime updates.
5. **Dashboard (Next.js)** — reads from the database, renders tables and charts, and subscribes to realtime updates so it reflects new expenses without a refresh.

**Data flow**
Telegram message → webhook receives it → parser extracts structured fields → row written to the database → database pushes a realtime update → dashboard reflects it instantly. The bot also replies in-chat with a short confirmation of what it logged, so mistakes are caught immediately instead of discovered later on the dashboard.

**Why this shape**
Telegram is already open on the phone throughout the day, which removes the single biggest reason expense trackers get abandoned: logging friction. A separate dashboard exists because reporting genuinely needs a proper UI with charts and filters — something no chat window does well, regardless of platform. A full comparison against the alternatives considered is in the appendix.

## 5. Tech Stack

| Layer             | Choice                                         | Why                                                                           |
| ----------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| Bot platform      | Telegram Bot API                               | Free at any volume, no approval process, native text/voice/photo support      |
| Backend / webhook | Serverless function on Vercel                  | Nothing to run as a server, same platform as the dashboard and portfolio site |
| Parsing           | Keyword/regex fast path + LLM fallback         | Instant and free for the common case, robust for anything messier             |
| Database          | Supabase (Postgres)                            | Generous free tier for personal use, built-in realtime subscriptions          |
| Dashboard         | Next.js on Vercel                              | Matches the existing deployment setup, large charting ecosystem               |
| Charts            | A React charting library (e.g. Recharts)       | Clean defaults, integrates directly with Next.js                              |
| Dashboard access  | A single shared password / simple session lock | Single-user tool — no need for full auth infrastructure yet                   |

## 6. Data Model

Field-level shape only — no implementation.

**`expenses`**

| Field        | Type       | Notes                                               |
| ------------ | ---------- | --------------------------------------------------- |
| id           | identifier | primary key                                         |
| amount       | number     | the logged amount                                   |
| category     | text       | links to a category name                            |
| merchant     | text       | e.g. "Zomato", "Metro card"                         |
| raw_message  | text       | original message, kept for debugging parser misses  |
| source       | text       | telegram_text / telegram_voice / telegram_photo     |
| parsed_by    | text       | "rules" or "llm" — tracks parser accuracy over time |
| expense_date | date       | the date the money was actually spent               |
| logged_at    | timestamp  | when the message was received                       |

**`categories`**

| Field          | Type             | Notes                                           |
| -------------- | ---------------- | ----------------------------------------------- |
| id             | identifier       | primary key                                     |
| name           | text             | e.g. Food delivery, Groceries, Transport        |
| keywords       | list of text     | merchant names/keywords mapped to this category |
| color          | text             | for dashboard charts                            |
| monthly_budget | number, nullable | added in v3                                     |

**`budget_alerts`** (v3)

| Field             | Type       | Notes                         |
| ----------------- | ---------- | ----------------------------- |
| id                | identifier | primary key                   |
| category_id       | reference  | links to categories           |
| month             | date       | which month this alert covers |
| threshold_crossed | number     | e.g. 80, 100                  |
| notified_at       | timestamp  | when the bot sent the alert   |

## 7. Parsing Strategy

1. **Fast path (rules)** — pull the first number in the message as the amount, match the remaining words against the keyword table in `categories`. Covers clean messages like "300 zomato" instantly, with no external calls.
2. **Fallback (LLM)** — anything the fast path can't confidently match gets sent to a small, cheap model that returns amount, category, and merchant as structured fields. Handles free-form phrasing like "spent maybe 500 on stuff for the trip yesterday."
3. **Self-improving keyword table** — whenever the LLM fallback confidently categorizes a merchant that isn't in the keyword table yet, that mapping gets saved back to `categories`. Over time the fast path handles more messages and the LLM fallback gets rarer.
4. **Low-confidence handling** — if neither the rules nor the LLM are confident, the bot asks a one-line clarifying question instead of guessing silently.
5. **Correction commands** — the bot supports undoing or editing the most recent entry from the chat itself, so a bad parse is fixed in seconds without touching the dashboard.

## 8. Three-Week Build Plan

### Week 1 — v1: Foundation & MVP

**Goal:** a complete, working pipeline — text an expense, see it appear on a live dashboard.

| Day | Focus                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Accounts and plumbing: create the Telegram bot, set up the Supabase project and the Vercel project, confirm a message sent to the bot reaches a webhook and writes a row to the database. |
| 2   | Data model: create the `expenses` and `categories` tables, seed an initial keyword list (Zomato/Swiggy → food delivery, Zepto/Blinkit → groceries, metro/Uber/Ola → transport, etc.).     |
| 3   | Rules-based parser: amount extraction plus keyword-to-category matching, with an "uncategorized" fallback.                                                                                |
| 4   | Wire the parser into the webhook end to end; bot replies with a short confirmation of what it logged.                                                                                     |
| 5   | Dashboard skeleton: a Next.js app connected to Supabase, showing a recent-transactions table.                                                                                             |
| 6   | First two charts: spend by category, and spend over time.                                                                                                                                 |
| 7   | Real-world test for a day. Fix whatever the parser gets wrong, tidy up the bot's replies and the dashboard's styling.                                                                     |

**Definition of done:** a message sent to the bot shows up, correctly categorized, on the dashboard within seconds — no manual steps in between.

### Week 2 — v2: Smarter logging

**Goal:** handle messy phrasing and add more ways to log an expense.

| Day | Focus                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------- |
| 8   | LLM fallback for anything the rules parser can't confidently handle.                                      |
| 9   | Low-confidence handling: the bot asks a quick clarifying question instead of silently guessing.           |
| 10  | Self-improving keyword table: confident LLM categorizations get written back into `categories`.           |
| 11  | Voice-note support: transcribe incoming voice messages and route the text through the same parser.        |
| 12  | Correction commands: undo the last entry, or edit its category/amount, directly from the chat.            |
| 13  | Extend the dashboard: date-range and category filters, a top-merchants view, month-over-month comparison. |
| 14  | Stress-test with deliberately messy or ambiguous messages, tune the parser and prompts.                   |

**Definition of done:** the bot handles natural, imperfect phrasing and voice notes without babysitting, and the dashboard supports actually analyzing spending, not just viewing a log.

### Week 3 — v3: Receipts, budgets, and polish

**Goal:** round out the feature set and get it into daily-use, presentable shape.

| Day | Focus                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15  | Receipt photo logging: accept a photo, extract merchant and total through the same parsing pipeline.                                                              |
| 16  | Budgets: a monthly limit per category, tracked against actual spend.                                                                                              |
| 17  | Budget alerts: the bot proactively messages when a category crosses 80% or 100% of its limit.                                                                     |
| 18  | Monthly summary: the bot sends a short recap automatically at the start of each month.                                                                            |
| 19  | Dashboard polish: empty states, loading states, mobile responsiveness, the access lock.                                                                           |
| 20  | Spike the Telegram Mini App idea — decide whether an in-Telegram version of the dashboard is worth building now or later; build a minimal version if time allows. |
| 21  | Final QA, deployment hardening, and a short write-up of how it was built.                                                                                         |

**Definition of done:** the tool handles text, voice, and photos; proactively nudges on budgets; and is stable enough to run unattended day to day and to show someone else.

## 9. Feature Matrix

| Feature                          | v1  | v2  |     v3     |
| -------------------------------- | :-: | :-: | :--------: |
| Text logging                     |  Y  |  Y  |     Y      |
| Rules-based parsing              |  Y  |  Y  |     Y      |
| LLM fallback parsing             |     |  Y  |     Y      |
| Self-improving keyword table     |     |  Y  |     Y      |
| Voice-note logging               |     |  Y  |     Y      |
| Correction / undo commands       |     |  Y  |     Y      |
| Dashboard: table + basic charts  |  Y  |  Y  |     Y      |
| Dashboard: filters + comparisons |     |  Y  |     Y      |
| Receipt photo (OCR) logging      |     |     |     Y      |
| Budgets                          |     |     |     Y      |
| Proactive budget alerts          |     |     |     Y      |
| Monthly auto-summary             |     |     |     Y      |
| Dashboard access lock            |     |     |     Y      |
| Telegram Mini App                |     |     | spike only |

## 10. Testing & Quality Checklist

- A batch of real, varied test messages — clean and messy — run through the parser before trusting it with real data.
- Every bot reply double-checked against the intended amount/category before moving to the next feature.
- Dashboard checked at both desktop and phone browser widths.
- Realtime updates confirmed to reflect within a couple of seconds of a message being sent.
- Voice and photo inputs tested with genuinely poor-quality audio/lighting, not just clean examples.
- A full week of real personal use before calling v1 "done," not just synthetic test messages.

## 11. Deployment Checklist

- Environment variables and API keys stored securely, never committed to the repository.
- Telegram webhook URL registered and verified against the live Vercel deployment.
- Supabase row-level security reviewed even for a single-user setup.
- Dashboard access lock in place before the URL is ever shared or linked publicly.
- Basic error logging in place so a failed parse or webhook error is visible instead of silent.
- A backup/export path for the data — even something as simple as a periodic CSV export.

## 12. Risks & Mitigations

| Risk                                      | Mitigation                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Parser misclassifies an expense           | Bot confirms every log in-chat; correction commands make fixing it a 5-second job                         |
| LLM costs creep up as usage grows         | Rules fast-path keeps LLM calls rare by design; keyword table keeps improving over time                   |
| Motivation drops mid-build                | v1 ships a genuinely usable tool in week 1, not just plumbing                                             |
| Missed Telegram webhook deliveries        | Telegram retries failed deliveries automatically; basic logging catches anything that still slips through |
| Dashboard exposes personal financial data | Access lock added before any link is ever shared, even informally                                         |
| Scope creep into v3 before v1 is solid    | Each week's definition of done is a hard gate before the next week's features start                       |

## 13. Success Metrics

- Expenses get logged the same day they happen, consistently, for at least a few weeks straight — the real test of whether friction was actually solved.
- The rules-based fast path handles the large majority of messages, with the LLM fallback staying the exception.
- The dashboard gets checked at least weekly, not just built and forgotten.
- The project ends up in a state worth linking publicly — clean enough to hold up next to MetroSaathi.

## 14. Future Roadmap (Post-v3)

- Telegram Mini App as the primary dashboard surface, if the week 3 spike goes well.
- Shared or family expense tracking, if the tool proves useful enough that others want in.
- Careful, opt-in bank SMS/email parsing for auto-import, with extra attention to privacy.
- Year-end and tax-season summaries.
- Open-sourcing the project as a template others can self-host.

## 15. Appendix: Why Telegram Bot + Standalone Dashboard

Three shapes were considered:

- **Telegram bot + separate web dashboard (chosen)** — input and output live on the surfaces best suited to each. Telegram removes almost all logging friction; the dashboard does one thing well, which is showing reports.
- **A single web app with a built-in chat box, no Telegram** — looks simpler on paper, but doesn't reduce what actually needs to be built — a parser, a database, and a UI are all still required — while losing Telegram's always-open, zero-install convenience. Opening a browser tab to log a ₹300 expense is real friction with no offsetting benefit.
- **Telegram bot + Telegram Mini App as the dashboard** — genuinely appealing longer-term, since the whole experience would live inside one app with no browser needed at all. Set aside for v1 mainly because it's more upfront work, and because a standalone dashboard on its own domain is far easier to link and show off publicly than something only reachable by opening Telegram first.

WhatsApp was also considered as the input surface instead of Telegram, and ruled out for a personal project: its Business API requires a verified business account and a dedicated phone number, with an approval process that can take up to two weeks — versus a Telegram bot that's live in minutes with no approval step at all. The per-message cost difference turned out to be minor; the real gap is setup friction, which matters a lot for a solo side project and barely at all once it's running.
