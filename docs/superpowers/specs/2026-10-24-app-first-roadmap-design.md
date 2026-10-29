# App-first finance tracker: roadmap and push notifications

Date: 2026-10-24 · Status: agreed in conversation; the user opted out of further review ("start working, I won't interfere")

## Intent

A ₹1,00,000 salary feels like plenty; ₹200 coffee + ₹400 Blinkit + ₹600 Swiggy + ₹600 Amazon quietly says otherwise.
The product makes money feel real at the size it's spent — a day — and helps plan the month and what's ahead.
It is a public app (Play Store first, iOS after), for everyone, and **everything is automatic**: nobody types expenses in.
The Telegram bot goes away; the app is the product.

## Goals

- One number every morning: what you can spend today (built in v14 — `src/lib/daily-budget.ts`).
- Every payment captured automatically after a one-time setup, and reflected in that number within seconds.
- Morning brief, live per-spend tally, night report — as push notifications, with an in-app inbox.
- Planning: the month by salary cycle (every rupee gets a job), goals, net worth.

## Non-goals / anti-goals

- Manual entry as a feature. Typing/voice/receipt stay only as _corrections_.
- Reading SMS directly (Play policy: default-SMS-app only). Account Aggregator before there's a company + regulated partner.
- Being a bank, giving investment advice, or anything that needs a licence.
- Failure even if it "works": a daily number built on missed payments; notification spam; a privacy story that fails Play review.

## Capture (decided)

| Route                                                                                        | Platform | Status                                |
| -------------------------------------------------------------------------------------------- | -------- | ------------------------------------- |
| Notification listener — bank/UPI apps **and the SMS app's own notifications** (no READ_SMS)  | Android  | exists; harden                        |
| Gmail one-tap connect (`gmail.readonly`) — needs CASA Tier 2 (~$540/yr) before public launch | both     | exists                                |
| Shortcuts "message received" automation → `/api/ingest`                                      | iOS      | to build                              |
| Account Aggregator via a regulated partner                                                   | both     | later, once the product proves itself |

## Order of work

1. **Push notifications + in-app inbox (Firebase via Expo push)** — this doc. ✅ built (v15)
2. Android capture reliability ✅ background upload, setup/disclosure card, OEM guidance, more bank formats, OTP-safe.
   Still open: categorisation quality, missed-payment detection from balance drift.
3. Retire Telegram: Google sign-in, migrate Telegram-only users, delete the bot.
4. Planning ✅ salary-cycle months (v16), goals with automatic credits (v17). Still open: net worth view.
5. Play Store readiness: privacy policy, Data Safety, prominent disclosure, CASA, hosting.
6. iOS build + Shortcuts capture.
7. Account Aggregator (later).

## 1. Push notifications + inbox

### Approaches considered

- **Expo push service backed by FCM (chosen).** `expo-notifications` gives an Expo push token; the server POSTs to
  `exp.host`; Expo delivers through the project's Firebase (FCM v1) on Android and APNs on iOS. Free, one server code
  path for both platforms, no service-account key on the server.
- Direct FCM HTTP v1 from the server. Needs a Firebase service-account key on Vercel and, for iOS, either the Firebase
  iOS SDK or a separate APNs path. More moving parts for no user-visible gain.
- Keep Telegram. Rejected — the bot is being removed.

### Design

- **Every notice is stored, then delivered.** `notifications` table = the inbox. Push is the doorbell; the inbox is
  the record, so a missed or disabled push loses nothing.
- **One entry point.** `notify(supabase, userId, notice)` → insert inbox row → push to every active token → (while it
  exists) Telegram. Chat replies inside the bot use a separate Telegram-only path and never hit the inbox.
- **Structured notices**: `{ kind, title, body, data }`. Kinds map to Android channels:
  `daily` (morning brief, night report), `spend` (live per-spend), `alerts` (budget crossed, bills due, recurring,
  detected bills, reauth), `digest` (monthly review).
- **Tokens**: `push_tokens(user_id, token, platform, active, last_seen)`. Disabled on `DeviceNotRegistered`.
  One token can belong to one user — re-registering after a different login moves it (shared phones, logouts).
- **App**: permission asked after login with a reason, channels created first (Android 13 requirement), token
  registered on every launch (cheap upsert), bell with unread count in the header opens the inbox, tapping a push
  opens the inbox.
- **Pre-migration tolerant**, like every other table.

### Left to the user

- Create the Firebase project, add Android app `com.aniketsharma.expensetracker`, put `google-services.json` in
  `mobile/`, upload the FCM v1 service-account key to EAS (`eas credentials`). The app config picks the file up
  automatically when present.
