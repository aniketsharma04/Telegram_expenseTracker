# Play Console: Data safety, permissions and policy answers

Answers for the Play Console forms, written from what the code does on 2026-10-24. If a data flow changes,
update this file and `src/app/privacy/page.tsx` together.

Links Play asks for:

- **Privacy policy:** `https://telegram-expense-tracker-nu.vercel.app/privacy`
- **Account deletion (web):** `https://telegram-expense-tracker-nu.vercel.app/delete-account`
- In-app deletion: Settings → Your data → Delete account.

Set `NEXT_PUBLIC_SUPPORT_EMAIL` in Vercel so the privacy page shows a contact address (Play requires a
developer email anyway).

## Data safety form

General:

| Question | Answer |
|---|---|
| Does the app collect or share user data? | Yes, collects. Does not share. Supabase, Vercel, Google Gemini, Groq, Expo/Firebase and the email provider act as service providers, which Play doesn't count as sharing. |
| Is all data encrypted in transit? | Yes (HTTPS only). |
| Can users request deletion? | Yes: in app, and at the web URL above. |

Data types:

| Play data type | Collected | Required? | Purpose | Notes |
|---|---|---|---|---|
| Personal info → Email address | Yes | Required for email sign-in | Account management | |
| Personal info → Name | Yes | Optional | Account management | Display name / Telegram name |
| Financial info → Purchase history | Yes | Required | App functionality | Expenses: amount, merchant, date |
| Financial info → Other financial info | Yes | Required | App functionality | Income, budgets, plan, goals, balances the bank reports, account last digits |
| Messages → SMS or MMS | Yes | Optional (notification access) | App functionality | Only notifications from SMS/bank/UPI apps that mention money moving; text stored up to 2,000 characters; OTP messages are dropped on the device |
| Messages → Emails | Yes | Optional (Gmail connect) | App functionality | Bill and payment emails only |
| Photos and videos → Photos | Yes, processed ephemerally | Optional | App functionality | Receipt photos are read and not stored |
| Audio → Voice or sound recordings | Yes, processed ephemerally | Optional | App functionality | Voice notes are transcribed and not stored |
| Device or other IDs | Yes | Required for notifications | App functionality | Expo push token |

Not collected: location, contacts, calendar, call logs, web history, installed apps, health, files, ads IDs.
No ads SDKs and no analytics SDKs.

## Sensitive permissions and APIs

- **Notification access** (`BIND_NOTIFICATION_LISTENER_SERVICE`): core feature, automatic expense tracking.
  - Prominent disclosure: the "Track spending automatically" card on Home (`mobile/components/CaptureSetupCard.tsx`). It's shown before the user is sent to the system screen, says what's read and where it goes, and needs an explicit "Agree & turn on" tap.
  - Only a fixed list of SMS, bank and UPI apps is read (`CaptureStore.DEFAULT_PACKAGES`).
- **SMS permissions:** not requested. The app never asks for `READ_SMS` or `RECEIVE_SMS`, so the Call log & SMS declaration form doesn't apply.
- **Battery optimisation:** the app opens the system settings list (`ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS`). It doesn't request `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, which Play restricts.
- **Notifications** (`POST_NOTIFICATIONS`): requested from the "Get your daily number" card, after the reason is shown.
- **Camera / microphone:** receipts and voice entry, requested at the moment of use.

## Financial features declaration

The app is a personal finance tracker and budgeting tool. It doesn't offer loans, credit, payments, banking,
investment advice or crypto. Declare "None of the above" for the regulated financial products. If a
"Personal finance management" option is listed, choose it.

## Still to do before submitting

- Gmail: `gmail.readonly` is a restricted scope. Production use by the public needs Google OAuth verification plus a
  CASA Tier 2 assessment (about US$540/yr through the self-serve labs). Until then, keep Gmail connect off in the public
  build, or limit it to test users.
- Store listing: screenshots, short and full descriptions, feature graphic.
- Target the latest required API level (EAS SDK 57 builds do this by default).
