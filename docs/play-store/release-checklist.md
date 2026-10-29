# Google Play release checklist

The steps from "developer account approved" to "live on the Play Store", in order. The answers for the Data safety
form, permissions and financial-features declaration are in [`data-safety.md`](./data-safety.md); the store text
is in [`listing.md`](./listing.md).

## 0. Before anything: the 12-tester rule

New **personal** developer accounts must run a **closed test with at least 12 testers, opted in for 14 days in a
row**, before production access is granted. Start recruiting testers (friends, family, the MetroDiaries audience)
as soon as the account is approved; the 14 days are the critical path. Organisation accounts are exempt.

## 1. Server settings (Vercel → Project → Settings → Environment Variables)

| Variable                    | Value                        | Why                                                |
| --------------------------- | ---------------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | your support address         | shown on the privacy policy; Play needs a contact  |
| `REVIEW_EMAIL`              | e.g. `playreview@yourdomain` | the account Google's reviewers sign in with        |
| `REVIEW_CODE`               | 8+ random characters         | the fixed code for that account (no email is sent) |

Redeploy after adding them. Then sign in once with the review account and set a plan (income ₹50,000, rent ₹15,000),
so reviewers see a working app rather than an empty one.

## 2. Create the app in Play Console

- App name: **Aaj: Daily Budget & Expenses** (see listing.md). Default language: English (India). App, Free.
- Declarations: follows Play policies, US export laws.

## 3. App content (Policy → App content)

| Section            | Answer                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Privacy policy     | `https://telegram-expense-tracker-nu.vercel.app/privacy`                                                                                                                                                                                                                                   |
| App access         | "All or some functionality is restricted" → add instructions: open app, Email, enter `REVIEW_EMAIL`, tap Send code, enter `REVIEW_CODE`. Note that automatic capture needs notification access, which reviewers can grant from the Home card.                                              |
| Ads                | No ads                                                                                                                                                                                                                                                                                     |
| Content rating     | Questionnaire, category "Utility, Productivity, Communication or Other": answer No to violence, sexual content, language, controlled substances and gambling. "Users can interact or exchange content": No (family members only see each other's expenses). Expected rating: Everyone / 3+ |
| Target audience    | 18 and over only                                                                                                                                                                                                                                                                           |
| News app           | No                                                                                                                                                                                                                                                                                         |
| Data safety        | Copy from data-safety.md                                                                                                                                                                                                                                                                   |
| Government app     | No                                                                                                                                                                                                                                                                                         |
| Financial features | Personal finance management / budgeting; none of the regulated products (no loans, payments, banking, investment advice)                                                                                                                                                                   |
| Health             | No                                                                                                                                                                                                                                                                                         |

## 4. Store listing (Grow → Store presence → Main store listing)

- Text: listing.md.
- App icon 512×512 PNG: `docs/play-store/assets/icon-512.png`.
- Feature graphic 1024×500: `docs/play-store/assets/feature-graphic.png`.
- Phone screenshots (2–8, 1080×1920): `docs/play-store/assets/screenshot-*.png`.
- Category: Finance. Contact email: same as `NEXT_PUBLIC_SUPPORT_EMAIL`.

## 5. Upload access for EAS (one time)

1. Google Cloud console → the project linked to Play Console → IAM → Service accounts → create one → Keys → JSON.
2. Play Console → Users and permissions → invite that service-account email → grant "Release apps to testing tracks" (and production later).
3. Save the JSON as `mobile/play-service-account.json` (already git-ignored; never commit it).

## 6. Build and upload

```bash
cd mobile
# app.json → expo.version: bump if native code changed since the last store build
EAS_NO_VCS=1 npx eas-cli@latest build -p android --profile production   # .aab, versionCode auto-increments
EAS_NO_VCS=1 npx eas-cli@latest submit -p android --profile production  # goes to Internal testing as a draft
```

The first upload of an app may need to be done by hand in Play Console (download the .aab from the EAS build
page). After that, `eas submit` works.

## 7. Testing tracks → production

1. Internal testing: you and a couple of devices; check capture, push, login.
2. Closed testing: the 12+ testers, 14 days (step 0). Fix what they find; ship fixes over the air
   (`eas update --channel production`), native fixes as new builds.
3. Apply for production access (Dashboard), then promote the release.

## 8. After launch

- Over-the-air updates go to channel `production`; never test on it. Test on `preview` first.
- Gmail connect stays hidden in production until Google OAuth verification + CASA Tier 2 is done (data-safety.md).
