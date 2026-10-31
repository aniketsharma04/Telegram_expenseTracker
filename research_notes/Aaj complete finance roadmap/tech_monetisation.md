# Free-tier tech choices and monetisation for "Aaj" (solo-dev Indian personal finance app), as of Oct 2026

Researcher notes. Fetched 2026-10-30. Official pages were fetched where possible. Search snippets and third-party blogs are labelled as such. Anything marked "(unverified, from background knowledge)" did not come from a source fetched in this session. The report writer should treat those items as leads to check, not as facts.

## 1. Current (2026) free-tier limits for the Aaj stack and alternatives

### Takeaway

Vercel Hobby's hard blocker is the ban on commercial use, not capacity. The moment Aaj takes money (or shows ads or affiliate links), it must leave Hobby or pay for Pro. On capacity, the first things to bite are likely Supabase's 1-week inactivity pause and 500 MB database, EAS Update's 1,000 MAU cap, and Gemini's unpublished, shrinking free quotas. The Gemini free tier also carries a data-use problem: its terms say not to send personal information, and they let Google train on and human-review inputs.

### Cited Findings

**Vercel Hobby**

- Hobby monthly allotments: 1,000,000 function invocations, 4 hours Active CPU, 360 GB-hrs provisioned memory, 100 GB Fast Data Transfer, 10 GB Fast Origin Transfer, 5K image transformations — [Vercel Fair Use Guidelines (updated 2026-09-14)](https://vercel.com/docs/limits/fair-use-guidelines)
- Hobby functions run on Fluid compute: 300 s default and max duration, 2 GB / 1 vCPU. Pro can go to 800 s, or 30 min in beta, with 4 GB / 2 vCPU — [Vercel Limits (updated 2026-09-16)](https://vercel.com/docs/limits)
- Hobby: 100 deployments per day, 1 concurrent build, 45 min build time, 100 cron jobs per project (raised from the old limit of 2), runtime logs kept for only 1 hour. Hobby projects cannot connect to Git repos owned by a Git organisation — [Vercel Limits](https://vercel.com/docs/limits)
- Hobby cron: minimum interval once per day, with an expression that runs more often failing deployment. Precision is per-hour (a job set for 1:00 can fire any time from 1:00 to 1:59) — [Vercel Cron usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- **Commercial use:** "Hobby teams are restricted to non-commercial personal use only." Commercial use covers "any method of requesting or processing payment from visitors", advertising the sale of a product or service, sites whose main purpose is affiliate linking, and "the inclusion of advertisements". "Asking for Donations does not fall under commercial usage." — [Vercel Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)
- Pro overage rates: $0.60 per 1M invocations, Active CPU from $0.128/hr, memory from $0.0106/GB-hr — [Vercel Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines). Pro is $20/user/month (unverified, from background knowledge).

**Supabase Free**

- 500 MB database per project, 50,000 MAU, 5 GB egress plus 5 GB cached egress, 1 GB file storage, 500K Edge Function invocations, up to 2 active projects. **Projects pause after 1 week of inactivity.** **No automatic backups.** Pro starts at $25/month — [Supabase Pricing](https://supabase.com/pricing)

**Expo / EAS Free**

- Up to 15 Android and 15 iOS builds (the page does not state the reset period; previously this was per month). Low-priority queue, with waits that "can exceed 90 minutes" at peak. 45 min build timeout. **EAS Update: 1,000 MAU** with unlimited updates and no overage option on Free. 100 GiB bandwidth. Starter is $19/month plus usage — [Expo Pricing](https://expo.dev/pricing)
- Workaround (unverified, from background knowledge): local builds (`eas build --local`, or `npx expo run:android` / Gradle) don't use EAS build credits. That makes the 15-build cap soft. The Update MAU cap is the harder limit.

**Gemini API free tier**

- Google no longer lists free-tier RPM/RPD on the rate-limits doc page. It points to the AI Studio per-project rate-limit page, says limits are "not guaranteed", and says RPD resets at midnight Pacific. Limits are per project, not per key. The page was last updated 2026-10-28 and announces "Gemini 4 Argon" — [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- Third-party figures conflict. Flash-Lite is given as about 30 RPM and 1,000 or 1,500 RPD, and 2.5 Flash as about 10 RPM and 250 RPD. One source reports Reddit users saw 2.5 Flash fall to about 20 RPD in Dec 2025 — [yingtu.ai guide](https://yingtu.ai/en/blog/google-gemini-api-free-tier-limits-2026); [tinkerllm](https://tinkerllm.com/blog/gemini-api-free-tier-limits-rate-quotas/). These are low-reliability numbers. Check them in AI Studio.
- **Terms for Unpaid Services:** Google uses submitted content and responses to improve its products and ML technologies. "Human reviewers may read, annotate, and process your API input and output" (after Google disconnects the data from your account). **"Do not submit sensitive, confidential, or personal information to the Unpaid Services."** Only Paid Services may be offered to users in the EEA, UK or Switzerland — [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)

**Groq free (Developer base)**

- `whisper-large-v3`: 20 RPM, 2K RPD, 7.2K audio-seconds/hour (2 h of audio), 28.8K audio-seconds/day (8 h). `openai/gpt-oss-120b`: 30 RPM, 1K RPD, 8K TPM, 200K TPD. Limits apply per organisation. Going over returns 429 with a `retry-after` header — [Groq rate limits](https://console.groq.com/docs/rate-limits)
- The fetched page did not show Groq's data-retention or training terms (see Gaps).

**Cloudflare Workers Free**

- 100,000 requests/day (reset at midnight UTC, Error 1027 when exceeded), **10 ms CPU per request and per cron trigger**, 5 cron triggers per account, 50 subrequests per invocation, 128 MB memory, 64 MiB Worker size — [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- Workers Paid is $5/month (unverified, from background knowledge). Cloudflare's terms do not have a Vercel-style non-commercial clause on the free plan (unverified, from background knowledge; check the ToS).

**Oracle Cloud Always Free**

- Ampere A1: 2 OCPU and 12 GB RAM total (1,500 OCPU-hrs and 9,000 GB-hrs a month), plus 2 AMD micro VMs (1/8 OCPU, 1 GB). 200 GB block storage, 5 volume backups, **10 TB/month outbound**. **Idle instances may be reclaimed** when, over 7 days, p95 CPU, network and memory (A1 only) all stay below 20%. Signups often hit "out of host capacity" errors in the home region — [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

**Telegram Bot API**

- Free broadcasts are capped at about 30 messages/sec. Going over gives 429 errors. Paid broadcasts (up to 1,000/sec at 0.1 Stars per extra message) need 100K Stars and 100K MAU. The FAQ suggests spreading notifications over 8–12 hours — [Telegram Bots FAQ](https://core.telegram.org/bots/faq)
- Per-chat guidance of about 1 msg/sec per chat and 20/min per group comes from a community guide, not Telegram — [grammY flood limits](https://grammy.dev/advanced/flood.html)

**Push notifications**

- No source was fetched. From background knowledge (unverified): the Expo Push Service and FCM are both free with no per-message charge. Expo throttles at about 600 notifications/sec per project.

**Render / Fly / Railway / Netlify / Firebase Spark / Coolify**

- Not fetched in this session (tool budget). See Gaps.

### Inferences

- **What breaks first, for Aaj specifically:**
  1. **Commercial-use clause (Vercel):** this breaks on day 1 of charging, before any capacity limit is reached.
  2. **Gemini free-tier terms:** bank SMS and email text is personal financial data. Sending it to the Unpaid Gemini API conflicts with Google's own "do not submit ... personal information" instruction. Google may also train on it and have humans review it. That is both a trust problem and a terms problem. Volume limits (a few hundred to about 1,500 RPD per project) would cap Aaj at about 100–300 actively parsing users if each user's messages go through the LLM.
  3. **EAS Update 1,000 MAU:** past 1,000 monthly app users, OTA updates stop on Free. The fallback is to ship Play Store builds, which can be made locally for free.
  4. **Vercel Hobby once-a-day crons:** these are already limiting (no hourly Gmail sync). The 4 hours of Active CPU per month is small if each cron run fans out across every user's Gmail. Ingestion work should move to on-device processing or to a free scheduler such as GitHub Actions cron (see below).
  5. **Supabase 500 MB:** at about 1 KB per transaction row, that is very roughly 400–500K transactions, enough for a few thousand users. That estimate is an inference. The 1-week pause is unlikely to trigger while daily crons hit the DB, but **no backups on Free** is a real risk for a finance app.
- **Escape hatches that stay free:**
  - Cloudflare Workers for the API. The 10 ms CPU cap is fine for I/O-bound handlers but tight for heavy JSON or crypto work, and there are only 5 cron triggers per account.
  - Oracle A1 VM with Coolify or Docker. It is generous, but expect capacity errors at signup and the idle-reclaim rule, and you run the security patching yourself.
  - GitHub Actions scheduled workflows as a free cron runner. This is already used for CI per the repo's git log. (GitHub's free-minute and schedule-delay details are unverified.)

### Gaps

- Exact current Gemini free RPD and RPM per model: Google no longer publishes them, and third-party numbers conflict.
- Groq data-retention and training terms for the free tier were not fetched.
- Render, Fly, Railway, Netlify and Firebase Spark free limits, and the Cloudflare and Netlify terms on commercial use, were not fetched.
- Expo push and FCM limits come from background knowledge only.
- Whether the EAS "15 builds" figure is monthly is not stated on the pricing page.

## 2. Vercel Hobby "non-commercial" and alternatives if Aaj charges

### Takeaway

Under Vercel's own definition, any in-app payment, ads, or affiliate-led site makes the deployment commercial. Donations are explicitly allowed. So Aaj can stay on Hobby while it is free or tip-funded. Before it adds a paywall, it should move the API to Cloudflare Workers or a self-hosted VM, or budget for Vercel Pro.

### Cited Findings

- Commercial use is defined as financial gain for "anyone involved in any part of the production". It includes payment processing, ads and affiliate-primary sites. Donations are excluded — [Vercel Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)
- Cloudflare Workers Free is 100K req/day with 10 ms CPU and 5 crons per account — [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/)
- Oracle Always Free gives 4 OCPU-equivalent Arm capacity (2 OCPU / 12 GB in Always Free tenancies) and 10 TB egress, with idle reclamation — [Oracle docs](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

### Inferences

- **Practical sequencing:**
  1. Stay on Hobby while Aaj is free or donation-funded.
  2. Before launching paid features, port the Next.js API routes to Cloudflare Workers (Hono, or the OpenNext Cloudflare adapter), or to a Docker container on Oracle A1 managed by Coolify.
  3. If the app itself gets paid through Play Billing and the backend only serves the app, it is still arguably "processing payment from visitors" in spirit. Treat it as commercial.
- Payments from paying users, even at ₹99/month, would cover Vercel Pro ($20/mo, about ₹1,700) at about 20 paying users. That is a reasonable point to switch if porting costs too much developer time. This is an inference from the unverified Pro price.

### Gaps

- Not verified: whether Vercel enforces the clause proactively or only on report, and whether a backend for a paid mobile app (not a website) is treated as commercial. Their support page says to ask.
- Cloudflare free-plan commercial terms were not fetched.

## 3. On-device and privacy-preserving parsing

### Takeaway

Reading SMS on Android is allowed under Google Play's "SMS-based money management" exception, subject to review. Use regex rules first on-device (open-source parsers exist for Indian banks) and fall back to an LLM only for unmatched messages. On-device Gemini Nano through the ML Kit GenAI Prompt API exists, but it only runs on recent flagships (Pixel 9/10, Galaxy S26 and some others), so it cannot be the only path for budget Android phones in India.

### Cited Findings

- Google Play SMS/Call Log policy: "SMS-based money management" is a listed exception for READ_SMS/RECEIVE_SMS, with the example "apps that track and manage budget". Exceptions are granted only if no alternative method exists for the core function. "Personal loans or budgeting apps may not exfiltrate or share non-financial or personal SMS history of a user." — [Play Console Help: SMS & Call Log permissions](https://support.google.com/googleplay/android-developer/answer/10208820)
- ML Kit GenAI APIs run on AICore. The Prompt API is supported on nano-v2 devices (Pixel 9 series, some Xiaomi, OnePlus and Honor) and nano-v3 devices (Pixel 10 series, Honor Magic 8 Pro, vivo X200/X300; a later snapshot adds Galaxy S26, Sony Xperia 1 VIII and others). It "performs best on Pixel 10" — [ML Kit GenAI overview](https://developers.google.com/ml-kit/genai); [Android Developers blog: Prompt API](https://developer.android.com/blog/posts/ml-kit-s-prompt-api-unlock-custom-on-device-gemini-nano-experiences)
- Open-source Indian bank SMS parsers:
  - `transaction-sms-parser` (JS/npm, regex-based; tested on Axis, ICICI, Kotak, HDFC, cards and wallets) — [GitHub](https://github.com/saurabhgupta050890/transaction-sms-parser)
  - `upi_sms_parser` (Dart, MIT; extracts amount, merchant, UPI ref, account, balance and type; filters OTP and promo messages) — [pub.dev](https://pub.dev/packages/upi_sms_parser/example)
  - `transaction_sms_parser` (Dart, claims 30+ Indian banks, v0.0.1) — [pub mirror](https://pub-web-s1.flutter-io.cn/packages/transaction_sms_parser)
  - PennyWise AI, described as an open-source privacy-first Android tracker that parses Indian bank SMS — [Hashnode post](https://hashnode.com/posts/pennywise-ai-your-privacy-first-ai-powered-expense-tracker/689c93fa8d444ba9c368b06a)
- The Gemini Unpaid terms tell developers not to send personal information (see section 1) — [Gemini API terms](https://ai.google.dev/gemini-api/terms)

### Inferences

- **Recommended pipeline:**
  1. On-device sender-ID allowlist (bank DLT headers) and regex templates. The JS parser can run directly in the React Native / Expo app.
  2. Use on-device Gemini Nano when `checkStatus()` says it is available.
  3. Otherwise fall back to the server LLM only for unmatched messages, with PII masked (account numbers, names, phone numbers) before sending. Bank alert formats are highly templated, so regex covers most messages at zero cost. The LLM handles the long tail and merchant normalisation.
- To ship the SMS permission, Aaj needs a Play declaration form and a demo video, and must keep raw non-financial SMS off the server. Uploading only parsed financial fields fits the "may not exfiltrate non-financial SMS" rule.
- Expo note: READ_SMS and ML Kit GenAI need native modules, so a dev-client or prebuild change is needed, which means a native build, not OTA. (This fits the existing project memory rule "native change = bump version + build".)
- Moving parsing off Gemini's free tier, or onto the Paid tier for any raw user text, also removes the training and human-review concern.

### Gaps

- No published accuracy benchmark comparing regex and LLM parsing of Indian bank SMS was found.
- No public Indian transaction-categorisation dataset was found in this session.
- Maintenance status of the listed parsers is unknown; check commit history.

## 4. Security basics on free tiers

### Takeaway

Supabase Free has no automatic backups, so a finance app must run its own `pg_dump` backups. RLS, token encryption and secret hygiene are all free to do, but they are the developer's job.

### Cited Findings

- Supabase Free: "Automatic backups are not included". Projects pause after 1 week of inactivity — [Supabase Pricing](https://supabase.com/pricing)
- Oracle Always Free includes 5 volume backups — [Oracle docs](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- Vercel Hobby keeps runtime logs for only 1 hour, which limits incident forensics — [Vercel Limits](https://vercel.com/docs/limits)

### Inferences

These are standard practice, not sourced this session.

- Enable RLS on every table, keyed on `auth.uid()`, and never ship the `service_role` key to the app. The Supabase MCP `get_advisors` tool flags tables with RLS disabled.
- Encrypt Gmail OAuth refresh tokens and the Telegram chat link at rest, either with application-level AES-GCM using a key held only in env vars or with Supabase Vault / pgsodium. Request only the `gmail.readonly` scope. Note that Google classes gmail.readonly as a restricted scope: public apps with more than 100 users need verification and possibly a CASA security assessment (unverified, from background knowledge, and potentially a cost and timeline blocker).
- Run a nightly GitHub Actions `pg_dump`, encrypted with age or gpg, to a private repo artifact or Cloudflare R2's free tier. Rotate secrets. Turn on Vercel and GitHub secret scanning.

### Gaps

- Not fetched: Supabase Vault docs, Google OAuth restricted-scope verification and CASA cost, and India's DPDP Act obligations for a solo developer.

## 5. Monetisation models and payment rails in India

### Takeaway

Google Play takes 15% on subscriptions. India also allows user-choice or alternative billing at 4 points less (about 11%). Razorpay can onboard individuals and unregistered businesses through CKYC, though its GST rules are unclear. Affiliate income from mutual funds or insurance is a regulatory minefield under SEBI's finfluencer rules and IRDAI licensing. The cleanest models for trust are freemium subscriptions and one-time Pro unlocks. Evidence on how much Indian users will pay is thin and mostly from blogs.

### Cited Findings

- The Google Play subscription service fee has been 15% since Jan 2022. India (and South Korea) have alternative/user-choice billing at a fee 4 percentage points lower. A 2026 split into a 10% service fee plus 5% billing fee is reported for the US, UK and EEA, with no confirmation for India — [Inc42](https://inc42.com/?p=266985); [vmobify blog](https://vmobify.com/blog/google-play-service-fees-india); [Adapty](https://adapty.io/blog/markdown/google-play-billing-changes-subscriptions-fees.md). These are secondary sources; confirm in Play Console Help.
- Google said fewer than 60 of over 200,000 Indian Play developers pay more than 15% — [Sentinel Assam / IANS](https://www.sentinelassam.com/science-and-technology/less-than-60-of-2-lakh-indian-developers-pay-service-fee-above-15-google-649928)
- Razorpay: for individuals and unregistered businesses, identity and address are auto-fetched from CKYC, plus bank details. A Razorpay blog describes a no-GSTIN route that still needs verification. Other Razorpay setup docs list a GST certificate among the accepted documents, which is a conflict — [Razorpay business types & KYC](https://razorpay.com/docs/payments/business-types-kyc-documents/); [Razorpay blog: documents required](https://razorpay.com/blog/documents-required-for-payment-gateway); [Razorpay KYC onboarding blog](https://razorpay.com/blog/payment-gateway-kyc-onboarding-india/)
- SEBI has barred registered entities (MF houses, RAs, IAs, brokers) from tie-ups with unregistered finfluencers, and a referral fee tied to a purchase through such a link is not payable. It removed content from over 15,000 unregulated entities in Aug 2024. BFSI advice needs SEBI or IRDAI registration, or CA/CS status — [Khaitan & Co via Mondaq](https://www.mondaq.com/india/social-media/1376968/ergo-finfluencers-in-the-crosshairs-sebis-regulatory-clampdown); [Business Today, Aug 2024](https://www.businesstoday.in/amp/personal-finance/investment/story/sebi-tweaks-regulations-for-finfluencers-removes-content-of-over-15000-unregulated-entities-443789-2024-08-31); [Bar & Bench](https://www.barandbench.com/law-firms/view-point/cutting-the-cord-sebi-move-disrupt-unregistered-finfluencers-business-model)
- Willingness to pay: a blog cites Redseer 2025 as saying more than 35% of Indian fintech users have tried at least one paid feature, up from 12% in 2022. This is second-hand and unverified — [Billcut blog](https://www.billcut.com/blogs/fintech-subscription-models-in-india-how-they-monetise). ET Money's paid tier is "Genius", offering advice across MFs and stocks — [Wikipedia: ET Money](https://en.wikipedia.org/wiki/ET_Money). Kuvera "offered" a premium plan with tax-loss harvesting; its current status is unclear — [EquitiesIndia review](https://equitiesindia.com/tools-directory/kuvera-review)
- Vercel counts ads and affiliate-primary use as commercial, but not donations — [Vercel Fair Use](https://vercel.com/docs/limits/fair-use-guidelines)

### Inferences

- **Trust ranking, best to worst:**
  1. One-time Pro unlock (₹299–₹999) or a low annual plan. The ₹49–₹299/month range in the brief was not verified against sources.
  2. Freemium monthly subscription.
  3. Tips or donations. These are Vercel-safe, but Play policy may require Play Billing for digital goods (unverified).
  4. B2B or CA tie-ups: an export for ITR filing and a "share with my CA" feature.
  5. Affiliate offers for credit cards and loans. These are highest risk because they reward pushing debt, and lending tie-ups touch RBI digital-lending rules (not fetched).
  6. MF or insurance referrals. These effectively need ARN or IRDAI POSP registration and run into SEBI's finfluencer rules.
- **Payment rail:** Google Play Billing (15%) is the simplest compliant path for in-app digital subscriptions on Android, and it supports UPI as a payment method (unverified). Razorpay subscriptions or UPI Autopay suit web or Telegram payments. Whether Play allows directing Android users to external payment in India, via user-choice billing, needs checking.
- Any of these turns the Vercel deployment commercial (see section 2).

### Gaps

- Not fetched: official Play Console fee page for India, Play policy on donations, current Razorpay Subscriptions / UPI Autopay pricing and individual eligibility, NPCI e-mandate limits, RBI digital-lending rules on loan referral apps, IRDAI POSP rules, and current INDmoney, ET Money Genius and Kuvera prices or subscriber numbers.
- No reliable Indian indie case study (revenue of a solo-dev finance app) was found.
