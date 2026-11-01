# Aaj Cards: UI/UX design brief

Research date: 2026-11-01. Method: web searches and page fetches of public docs, app-store listings and reviews. No sign-ups, no personal data entered. Read alongside `research_notes/Monzy and Indian card recommenders/` (regulation.md, competitors.md), which this brief builds on.

Codebase facts used: `mobile/App.tsx` has 4 hand-rolled tabs (`today | activity | plan | insights`) and no `BackHandler` usage was found. `mobile/lib/theme.ts` is the "Calm" palette: warm off-white page, white surfaces, one deep-teal accent (`#0f766e` / dark `#2bb3a3`), orange `warn` reserved for "over", muted text tuned to 4.5:1. No i18n layer was found.

---

## 1. What the research says (short)

### 1.1 Mini-app ("app inside an app") patterns

| Platform | What they do | Takeaway for Aaj |
|---|---|---|
| WeChat Mini Programs | Host owns a fixed "capsule" (more/close) at top-right on every page; developer keeps space clear for it. Back button top-left on secondary pages. 2-5 tabs, 4 or fewer recommended, one tab bar per page, native bottom tab bar only on the mini-program home. Custom nav must look different from the host's menu. Every error needs a way out; long waits get cancel + progress. Touch targets "roughly 7-9 mm". — [WeChat design guide](https://developers.weixin.qq.com/miniprogram/en/design/) | Host-owned close in a fixed place; mini-app owns back and content. Keep tabs to 3. |
| LINE MINI App | Host-controlled header that cannot be hidden: title, app name/verified badge (or domain), action button, close or minimize, return button, loading bar. — [LINE UI components](https://developers.line.biz/en/docs/line-mini-app/discover/ui-components/) | A consistent "frame" header tells users they are still inside the parent app. |
| Tawasal (UAE super-app) | Close button 44x44 touch target, 30x30 icon, close only from the mini-app's main page. — [Tawasal guidelines](https://platform.tawasal.ae/overview/guidelines) | Close on the Cards home; back (not close) on deeper screens. |
| PhonePe Switch | One-tap entry point grid of partner logos; partner PWAs open with single-tap login, no install. — [PhonePe press](https://www.phonepe.com/press/launching-phonepe-switch-your-shortcut-to-a-world-of-apps/) | Entry is a branded tile; identity is inherited, never re-asked. |
| Paytm Mini Apps | Login only through the host; no redirect out of the host; check-then-request each permission; "complete control of the UI is handed to you". — [Paytm guidelines](https://www.paytmpayments.com/docs/miniapps/guidelines), [overview](https://www.paytmpayments.com/docs/miniapps/overview) | Reuse Aaj session/data; ask for any new data use inside the mini-app, at the moment it is needed. |
| Google Pay Spot | Business-branded storefront in HTML/JS inside GPay. — [Spot docs](https://developers.google.com/pay/india/spot) | Branding can differ inside, but the host frame stays. |
| Revolut / Monzo | Revolut 8 put all products in one "Hub" screen, later a five-button bottom bar with "Lifestyle" — [Revolut blog](https://www.revolut.com/blog/post/simplified-app-infinite-possibilities/), [Presse-citron](https://www.presse-citron.net/revolut-fait-peau-neuve-les-plus-grosses-nouveautes-qui-debarquent/). Monzo moved products into a Discover card, later an Explore tab — [Monzo community](https://community.monzo.com/t/were-working-on-a-new-look-for-the-monzo-app/65333) (forum, unofficial). | Neo-banks surface sub-products as a card on home + a hub, not as extra top-level tabs. |
| CRED | Distinctive in-house design system (NeoPOP; earlier "Topaz" built for card payments/rewards), card management revamped several times — [CRED design](https://cred.club/design), [NeoPOP](https://cred.club/neopop), [UX Planet critique](https://uxplanet.org/thoughts-on-creds-ui-revamp-apr-2022-6d2b4dcfcfc6) | Strong look sells "premium" but CRED is also criticised for ornamental UI; Aaj should be distinct by a sub-accent, not a new system. |

Not found: public PhonePe Switch or Jupiter header specs. The pattern above is inferred from WeChat/LINE/Tawasal, which publish theirs.

### 1.2 Card-reward apps

- **CardPointers** (US): pick cards from a database, no bank linking; "best card" per merchant/category including bonus categories and offers; Safari extension, location "AutoPilot", Siri, Watch. — [App Store](https://apps.apple.com/us/app/cardpointers-for-credit-cards/id1472875808), [Points Party review](https://thepointsparty.com/articles/cardpointers-review-maximize-credit-card-rewards), [Wallet Hacks](https://wallethacks.com/cardpointers-app-review/)
- **Kudos** (US): checkout-time best-card pick plus "Boost" bonus; reviewers note recommendations of new cards earn it affiliate revenue. — [College Investor](https://thecollegeinvestor.com/46251/kudos-review/), [TechCrunch](https://techcrunch.com/2024/05/17/kudos-ai-smart-wallet-10m-credit-card)
- **MaxRewards** (US): linked accounts, a "rewards earned and missed" summary, best card per merchant; key features behind paid Gold. — [Yahoo/US News](https://www.yahoo.com/news/using-apps-manage-credit-card-170832537.html), [College Investor](https://thecollegeinvestor.com/maxrewards-review/)
- **Uthrive** (US): alerts when you use the wrong card; shows earned and missed rewards per transaction and overall. — [App Store](https://apps.apple.com/us/app/uthrive-rewards-cashback/id1593133342), [Yahoo](https://www.yahoo.com/news/using-apps-manage-credit-card-170832537.html)
- **Credit Karma**: approval odds in tiers (Outstanding, Excellent, Very Good, Good, Fair, Poor); "Approval Odds are not a guarantee of approval"; "the final approval decision always rests with the lender"; advertiser disclosure that compensation affects "how and where offers appear". — [Credit Karma](https://creditkarma.com/credit-cards/i/credit-karma-approval-odds). Users report odds that don't match outcomes — [myFICO forum](https://ficoforums.myfico.com/t5/Credit-Cards/Question-About-Apps-Like-Credit-Karma-and-Nerd-Wallet/td-p/6676507).
- **NerdWallet**: odds from "how similar your credit profile is to past applicants", needs a free TransUnion score; approval never guaranteed. — [NerdWallet approval odds](https://www.nerdwallet.com/best/credit-cards/approval-odds)
- **SaveSage** (India): spend-based best card + "which card for this purchase" chat; one App Store review complains of the same answer every time. — [App Store IN](https://apps.apple.com/in/app/id6736468204), [Tribune](https://www.tribuneindia.com/news/business/savesages-pan-india-survey-reveals-70-of-credit-card-users-fail-to-maximise-rewards/)
- **Great.Cards** (India, CashKaro): tool tiles ("Try Beat My Card", "Find Best Card for Brands"), card art without names/fees on home, a "₹3000 Gift Card ON APPLYING" banner, testimonials like "Saved ₹14,000 annually" (some repeated verbatim with different names). — [great.cards](https://great.cards) (fetched). Cautionary example of incentive-led UI.
- **Monzy** (India): no account, 6-question quiz, one "perfect match", no eligibility check, "We don't sell your data". — see `research_notes/Monzy and Indian card recommenders/monzy.md`, [monzy.co/about](https://monzy.co/about)
- **PointsFly, Scapia, CRED**: see competitors.md; no UI teardown sources found beyond listings.

Patterns worth copying: per-merchant "best card" with the rate shown (CardPointers); earned vs missed totals (MaxRewards, Uthrive); tiered approval labels with plain disclaimers (Credit Karma). Patterns to avoid: card art with no fee/name (Great.Cards), gift-card bait on applying, testimonial savings as social proof, paywalled core answer.

### 1.3 Explaining numbers and uncertainty

Google PAIR guidebook — [Explainability + Trust](https://pair.withgoogle.com/chapter/explainability-trust/):
- "Don't say 'what' without saying 'why' in a high stakes scenario."; "The best explanation is likely a partial one."
- "Numeric confidence indicators are risky"; for categories, "clearly indicate what action a user should take" at each level.
- "Data sources have to be part of your explanations"; "Tell the user when a lack of data might mean they'll need to use their own judgment."
- Let users "make corrections when the system doesn't behave as they expect".

### 1.4 Responsible design rules that bind the UI

RBI marketing/sales directions (in force 1 Jan 2027; Annex IIA lists 11 dark patterns) — summary at [CorpLawUpdates](https://www.corplawupdates.in/updates/rbi-tightens-rules-advertising-marketing-sale-financial-products-regulated-entities); see regulation.md for detail:
False urgency, basket sneaking, confirm shaming, forced action, subscription trap, interface interference (example given: default consent "Yes"), bait and switch, drip pricing, disguised advertisement (promo labelled "Important: Your account might benefit…"), nagging, trick wording (double negatives). Consent must be explicit, default "No / I do not agree"; no unsolicited promotional push; easy opt-out; UIs must be user-tested and audited for dark patterns; key fees prominently shown.

CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023 (13 patterns, Annexure 1) — [JSA](https://www.jsalaw.com/newsletters-and-updates/ccpa-issues-guidelines-for-prevention-and-regulation-of-dark-patterns-2023/), [Mondaq](https://mondaq.com/india/consumer-trading-unfair-trading/1398262/ccpa-issues-guidelines-for-prevention-and-regulation-of-dark-patterns-2023-effective-30-november-2023). The RBI 11 plus trick question, SaaS billing, rogue malware (list from secondary sources; verify against the official PDF on consumeraffairs.nic.in).

### 1.5 Indian context

- Devanagari needs more vertical room than Latin: matras clip in fixed-height boxes; one guide suggests 150-160% line height for body, 120-130% headlines; Hindi strings run 10-20% longer. — [indiafont.com](https://indiafont.com/blog/indian-typography-tips), [Articulate forum](https://community.articulate.com/discussions/discuss/hindi-text-clipping-in-player-ui---looking-for-a-devanagari-safe-font/1242062), [appscreenshotstudio](https://appscreenshotstudio.com/hindi-app-store-screenshots) (vendor/blog sources, test on device). Plus Jakarta Sans has no Devanagari glyphs; pair with Noto Sans Devanagari (or Mukta/Hind).
- Android hardware/gesture back must work inside nested flows (predictive back on Android 13+ needs `enableOnBackInvokedCallback`) — [Flutter PR #120385](https://dart.googlesource.com/monorepo//+/e4fb25a5e2fca3e3c82c132dde65b7fc48442d99) (the same principle applies to RN `BackHandler`).

---

## 2. Design principles for Aaj Cards

1. **Same app, own room.** Inherit Aaj's font, spacing, surfaces and dark mode. Give Cards a sub-identity via its header frame, a card-shaped hero and a secondary accent, not a new design system.
2. **Facts, not offers.** The first two screens are about money the user already spent. Ranking new cards comes third and never leads.
3. **Every ₹ has a "why".** Each number opens a breakdown: spend × rate − caps − fee = value, the data window, and the rule's last-verified date.
4. **Honest about not knowing.** If the product, rule or spend is uncertain, show a range or say "we don't know yet" and ask the user to help.
5. **Default to the user's interest.** No pre-ticks, no "Yes" defaults, no apply buttons for users under debt stress, no pushes without opt-in.

---

## 3. Information architecture

### 3.1 Entry points (from main Aaj)

- **Primary:** a "Cards" tile on the `insights` tab (or Today) — card-shaped, teal-to-hero gradient, one line of real value: "₹1,240 in rewards you could have earned last 90 days". Tap opens the mini-app.
- **Contextual:** on a credit-card transaction row/detail in Activity: "Earned ~₹18 · Card B would have earned ₹90 →" deep-links to that merchant in Missed rewards.
- **Settings:** "Cards" row (for privacy controls and turning the section off).
- Do **not** add a 5th main tab. Revolut/Monzo surface sub-products via a hub/card ([Revolut](https://www.revolut.com/blog/post/simplified-app-infinite-possibilities/)); WeChat recommends 4 or fewer tabs.

### 3.2 Container behaviour

- Opens as a **full-screen layer** above the main tab shell (slide up 250 ms; respect reduce-motion: fade). Main tab state is preserved underneath.
- **Header frame (always visible, host-owned look):**
  - Left: back chevron on sub-screens; nothing on Cards home.
  - Centre-left: "Aaj **Cards**" wordmark (Cards in the sub-accent) on home; screen title on sub-screens.
  - Right: close "✕" (48dp target) on **every** screen, which returns to exactly where the user was in Aaj. Overflow "⋯": How we calculate, Privacy & data, Feedback.
- **Android back:** pops one level inside Cards; on Cards home it closes Cards. Never exits the app from inside Cards and never shows "Are you sure?". Implement with `BackHandler` (none exists today).
- **Bottom tabs inside Cards: 3 tabs**, only on Cards root screens (the WeChat rule: tab bar only at the mini-app home level):
  1. **My cards** (wallet + missed rewards summary)
  2. **Missed** (full missed-rewards report)
  3. **Explore** (next-card top 3; later "best card now")
  Sub-screens (card detail, explain sheet, match flow) hide the tab bar.
  Alternative if tabs feel heavy at launch: a single scroll with three sections and sticky segment chips. Recommendation: **tabs**, because "Best card now", alerts and trackers will need homes later and tabs keep each screen short on small screens.
- **Later tab 4 (cap):** "Use now" (which card at this merchant) can replace a tab or live as a FAB on My cards. Never more than 4.

### 3.3 Screen list

| ID | Screen | Type |
|---|---|---|
| C0 | First-run intro (one screen) | full screen, once |
| C1 | My cards (wallet) | tab root |
| C2 | Card detail | push |
| C3 | "Which card is this?" matcher | bottom sheet (tall) |
| C4 | Missed rewards report | tab root |
| C5 | Merchant/category breakdown | push |
| C6 | Explain this number | bottom sheet |
| C7 | Explore: top 3 next cards | tab root |
| C8 | Card offer detail ("Why this card") | push |
| C9 | Leaving Aaj interstitial (to bank site) | bottom sheet |
| C10 | How we calculate / sources | push |
| C11 | Privacy & data | push |
| Later | Use now, Devaluation alerts, Fee-waiver/milestone tracker | |

---

## 4. Screen layouts (top to bottom)

### C0. First-run intro (shown once, skippable)

1. Header frame with close.
2. Illustration: stacked generic card shapes (no bank logos).
3. Title: "Get more from the cards you already have".
4. Three rows, icon + one line each:
   - "See rewards you missed on your real spends"
   - "Find the best card for where you spend most"
   - "Your SMS stay on this phone. We never apply for anything for you." (adjust to what is actually true about data handling)
5. Cards detected: "We found 3 credit cards in your messages: HDFC ••4521, SBI ••0083, ICICI ••7710."
6. Primary button: "Set up my cards" → C3 for the first unmatched card. Text button: "Not now" (closes, no penalty, no re-prompt for 30 days).
7. Notification opt-in is **not** on this screen. Ask later, in context (see 6.4).

### C1. My cards (wallet)

1. Header frame: "Aaj Cards" + ✕.
2. **Summary strip** (single line, muted): "Last 90 days · 3 cards · ₹48,200 spent on cards".
3. **Hero stat card** (surface, elevation 1):
   - Label: "Rewards you earned" → "₹612" (big, ink).
   - Second line: "You could have earned **₹1,850** with the cards you already own" (accent).
   - Link: "See where →" (to C4). "How is this worked out?" (C6).
4. **Card stack** (horizontal or vertical list, vertical preferred on small screens):
   Each card tile: generic card art tinted by bank colour family (not the issuer's real artwork; see 7.3), bank name, product name or "Unknown card", ••last4, small chips: "Best for: Swiggy, Zomato" / "1% everywhere". Spend this cycle. Tap → C2.
   - Unmatched tile: dashed border, "HDFC ••4521 — Which card is this?" button "Choose" → C3.
5. **"Use this card for…" quick table** (3-5 rows from user's top categories): "Food delivery → SBI Cashback (5%)", "Fuel → ICICI HPCL (4%)". Each row tappable for the why.
6. Footer note (muted): "Reward rules last checked 12 Oct 2026. Banks change rules; check your card terms." + "How we calculate".
7. Bottom tabs.

### C2. Card detail

1. Header: back, "SBI Cashback ••0083", ✕.
2. Card art + product name + "Change" (re-opens C3).
3. "This card in the last 90 days": spent ₹21,300 · earned ~₹640 · effective rate 3.0%.
4. Earn rules list (top 5, plain words): "5% online (cap ₹5,000/month)", "1% offline", "No rewards: fuel, rent, wallet loads". Each with "Last verified 12 Oct 2026 · source: bank MITC" link.
5. Fee & waiver: "Annual fee ₹999 + GST. Waived if you spend ₹2 lakh in the card year. You're at ₹1.4 lakh." (progress bar; this becomes the milestone tracker later).
6. "Best used for" chips derived from user's own spend.
7. Text link: "This doesn't look right" (feedback, prefilled with card + rule).

### C3. "Which card is this?" matcher (tall bottom sheet)

1. Drag handle, title: "Which HDFC card ends in 4521?"
2. Context line: "We saw it in 34 SMS since June. Picking the right card makes your numbers accurate."
3. Search field: "Search HDFC cards" (filtered to bank by default; "Not HDFC?" link changes bank).
4. List: thumbnail (generic art), product name, network badge (Visa/Mastercard/RuPay; pre-filter if SMS shows it), annual fee. Most-common products first; mark "Popular" only by usage count, never by commission.
5. Bottom options (always visible):
   - "I'm not sure" → stores as Unknown, uses a conservative 1%/0.5% baseline and labels all numbers "estimate".
   - "This is a debit card / not mine" → removes from Cards.
6. Selected state: radio + "Confirm" button (disabled until a choice). No auto-confirm.
7. After confirm: toast "Saved. Numbers updated." and move to the next unmatched card with "1 of 3" progress; "Skip" allowed.
8. Hints that help matching (optional, collapsed "Help me find it"): "Look at the card front for the name, e.g. 'Millennia', 'Regalia'. Or open your bank app → Cards."

### C4. Missed rewards report

1. Header: "Missed rewards" + ✕. Period chips: "30 days · 90 days · 12 months" (default 90 days).
2. **Headline card:**
   - "You earned **₹612**. You could have earned **₹1,850**."
   - Sub: "Using only the 3 cards you already have. That's about **₹5,000 a year**." (annualised, rounded, see 5.1).
   - Data badge: "Based on 142 card spends · 2 cards are estimates" (tappable to fix).
3. **Top opportunities list** (sorted by ₹ missed, max 5, then "See all"):
   Row: merchant logo or category icon · "Swiggy · ₹8,400 spent" · right side "+₹336" in accent. Second line (muted): "Paid with HDFC ••4521 (1%) · SBI ••0083 pays 5%". Tap → C5.
4. **Category view toggle** (segmented: Merchants | Categories).
5. **"Already optimal"** collapsed group: "Groceries, fuel: you used your best card. Nice." (reinforce, no streaks or badges).
6. Footer: assumptions line + "How we calculate".

### C5. Merchant/category breakdown

1. Header: back, "Swiggy", ✕.
2. Comparison table, one row per owned card: card · rate · would earn · notes ("cap ₹5,000/mo reached in Aug"). Current card marked "You used"; best marked "Best of yours".
3. Transactions list (last 10 with card used, amount, earned).
4. Tip block (plain): "Next time on Swiggy, pay with SBI Cashback ••0083."
5. "Something wrong?" → mark merchant as wrongly categorised.

### C6. Explain this number (bottom sheet, reused everywhere)

Layout: title "How we got ₹336", then a vertical equation:
```
Swiggy spend (90 days)        ₹8,400
× SBI Cashback online rate      5%      → ₹420
− Monthly cap / exclusions              → ₹0
− What HDFC ••4521 earned (1%)          → ₹84
= Extra you could have earned           ₹336
```
Then: "Assumptions" (bullets: "Swiggy counted as online", "Points valued at ₹0.25 each", "Rules checked 12 Oct 2026"), "Data used" ("Your SMS from these 2 cards; nothing leaves your phone" if true), and a "Fix something" link. PAIR: data sources in every explanation, and a correction path.

### C7. Explore: top 3 next cards

Shown only when eligibility rules for showing it pass (see 6.2). Otherwise show the debt-stress variant.

1. Header: "Explore" + ✕.
2. Intro line: "Cards that would pay you more on **your** spending, compared with your best current card (SBI Cashback)."
3. **Disclosure bar** (always visible, not a tooltip): "Ranked by extra ₹ a year for you. Aaj [earns / does not earn] money if you apply. Ranking is not affected by payments." (Whatever is true. If commission ever affects anything, say so here.)
4. **Three offer cards**, each:
   - Rank number, generic card art, product name, bank.
   - Big number: "**+₹3,200 a year**" with range "(₹2,600–₹3,800)" muted.
   - "after ₹500 annual fee" stated in the same line (no drip pricing).
   - Top driver: "Mostly from Swiggy and Zepto (₹2,900)".
   - Approval chip: **Likely / Stretch / Unlikely** (text + icon, never colour alone), with "Our guess from your spending, not the bank's decision".
   - Buttons: "Why this card" (primary outline) → C8. No apply button on the list.
5. If fewer than 3 cards beat the current best by a meaningful margin (e.g. +₹1,000/yr): show only those, then "Your current cards are already good for how you spend. No new card needed." This is a feature, not an empty state.
6. Footer: "Based on 12 months of your card spends. Rules checked 12 Oct 2026."

### C8. Card offer detail ("Why this card")

1. Header: back, product name, ✕.
2. Card art, name, bank, network, **joining fee, annual fee, waiver condition, interest rate (APR) and late fee** shown up front in a fee table (RBI: key fees prominent; no drip pricing).
3. "What you'd get": per-category table on the user's own spend: category · your spend · this card · your best current card · difference.
4. "What you'd give up / watch out for": caps, exclusions, devaluation history ("Rewards on rent cut in 2024"), point-to-₹ value assumption.
5. Approval section: chip + explanation of what drives it ("Based on card types you already hold and your typical monthly spend. We don't check your credit score.") and "Only the bank decides. Applying may lead to a credit enquiry."
6. Primary: "Go to bank website" (only if not in debt-stress). Secondary: "Not interested" (hides it, no reason required; optional "why" chips).
7. Last verified + source link.

### C9. Leaving Aaj interstitial (sheet)

"You're going to hdfcbank.com. Aaj doesn't fill in or send your details. The bank will run its own checks." Buttons: "Continue to bank" / "Stay in Aaj". Equal weight; no countdown.

### C10. How we calculate · C11. Privacy & data

C10: method in plain words, point valuations table, data window, rule sources and verification dates, ranking criteria, conflicts of interest. C11: what data Cards uses, where it is stored, "Turn off Cards" and "Delete card matches", notification toggles (all default off).

---

## 5. Money-number rules

### 5.1 Formatting

- Indian grouping: ₹1,23,456; use "₹1.2 lakh" above ₹1 lakh in headlines, full figure in tables (`Intl.NumberFormat('en-IN')`; Hindi uses the same digits, keep Latin numerals).
- Round headline yearly values to ₹100 (under ₹10k) or ₹500 (above); show exact rupees only in the explain sheet. Precision implies certainty we don't have.
- Always say the period: "a year", "in 90 days". Annualised numbers carry "about".
- Deltas: "+₹3,200 a year" in accent for gains; missed amounts are neutral ink or accent, **not** orange/red (orange in Aaj means "over budget", and missed rewards are not a mistake).
- Never mix points and rupees in one figure. Convert points at a stated value ("1 point = ₹0.25") and let users change it in C10.

### 5.2 Uncertainty

- Show a range when the input is uncertain (unknown product, under 60 days of data, ambiguous merchant category, points valuation): "+₹3,200 a year (₹2,600–₹3,800)".
- Data-quality badge on every report: "Good data" / "Some estimates" / "Early estimate (under 30 days)", tappable to see why.
- Under 30 days of card data: don't annualise; show "So far: ₹180 missed in 18 days".

### 5.3 "Last verified" dates

- Per rule: "Checked 12 Oct 2026". Older than 90 days: muted warning "May be out of date" and the number becomes a range. Older than 180 days: exclude from Explore ranking.
- Global footer on each screen: the oldest verification date among rules used.

### 5.4 Unknown product empty state

Card tile and any number involving it: "HDFC ••4521 · Card type unknown. Numbers for this card are rough." CTA: "Choose card". The report still works using a baseline rate, clearly labelled.

---

## 6. Responsible design

### 6.1 Approval chances

- Three labels only: **Likely**, **Stretch**, **Unlikely**. Never "pre-approved", "guaranteed", "instant approval", or percentages (PAIR: numeric confidence is risky; users distrust "pre-approved", see competitors.md).
- Each label has a defined action: Likely → "Worth a look"; Stretch → "You may be asked for income proof or get a lower limit"; Unlikely → "We'd suggest waiting".
- Unlikely cards are not in the top 3 by default; they appear in a collapsed "Cards you may not get yet".
- Always visible footnote: "Our guess, not the bank's decision."

### 6.2 Debt-stress mode (no apply button)

Trigger (from SMS): late-payment fee, minimum-due-only payments 2+ cycles, over-limit fee, EMI bounce, collection-like messages. Let the user see and dispute the trigger.

What changes:
- Explore tab still opens; no apply/"Go to bank" buttons anywhere in Cards, no "Explore" badge, no new-card push notifications.
- Explore top content becomes a calm card:
  - Title: "Let's make your current cards work first"
  - Body: "Your recent messages show a late fee on HDFC ••4521. Paying the full amount on time usually saves more than any new card earns. We'll show new cards again after 3 on-time payments."
  - Actions: "Set a due-date reminder" · "See which card to use for what" · text link "Why am I seeing this?"
- Never say "debt", "bad", "risky" about the user. Never use red. Use neutral surface + accent icon.
- Missed-rewards report still works; it helps without adding credit.
- "This is wrong" link (e.g. fee was reversed) restores normal mode after the user confirms; log it.

### 6.3 Dark-pattern checklist (RBI Annex IIA + CCPA 2023)

| Pattern | Rule in Cards |
|---|---|
| False urgency | No timers, "ends today", "only X left". Offer end dates only if the bank publishes them, as plain text. |
| Basket sneaking | Nothing pre-added (no add-on insurance, no "also check loan offers"). |
| Confirm shaming | Decline buttons are neutral: "Not now", "Not interested". Never "No, I like losing money". |
| Forced action | Cards works without granting notifications or contacts; ✕ always closes, never redirects. |
| Subscription trap | If a paid tier appears later, cancel is in C11 in one tap. |
| Interface interference | Yes/No buttons equal size and weight; consent defaults "No". |
| Bait and switch | Explore numbers on the list equal the numbers in C8. |
| Drip pricing | Fees shown on the list card and at the top of C8, before any bank link. |
| Disguised advertisement | Card suggestions never styled as alerts or "Important". Notifications about new cards are labelled "Suggestion". |
| Nagging | A dismissed card stays hidden 90 days; a declined permission is not asked again for 30 days. |
| Trick wording | No double negatives; toggles say what turning them on does. |

### 6.4 Consent and notifications

- All Cards notifications default off. Ask in context with an equal-weight choice: after the first Missed report: "Want a nudge when you pay with a lower-earning card?" [No thanks] [Yes, remind me]. Separate toggle for "Card suggestions (promotional)", default off, separate from "Missed-reward nudges" and "Rule-change alerts".
- No pre-ticked boxes anywhere.

---

## 7. Components

| Component | Notes |
|---|---|
| `CardsFrame` | Header (back/title/✕/⋯), BackHandler, slide-up container, tab bar slot. |
| `CardsTabBar` | 3 tabs, icon + label, 56dp tall, accent indicator. |
| `CardArt` | Generic gradient card (bank colour family + network mark + ••last4). Sizes S (40×26), M (120×76), L (full width 1.586 ratio). |
| `CardTile` | CardArt + name + chips + spend; variants: matched, unknown (dashed), removed. |
| `HeroStat` | Label, big ₹, sub-line, link. |
| `MoneyDelta` | "+₹3,200 a year" with optional range and "about". |
| `OpportunityRow` | Merchant icon, spend, current vs best line, delta. |
| `CompareTable` | Rows of cards × rate × value, "You used" / "Best of yours" tags. |
| `ExplainSheet` | Equation, assumptions, data used, fix link. |
| `ApprovalChip` | Likely/Stretch/Unlikely with icon (✓ / ~ / –) and text; no colour-only meaning. |
| `DisclosureBar` | Always-on ranking + money disclosure. |
| `VerifiedStamp` | "Checked 12 Oct 2026", stale variant. |
| `DataQualityBadge` | Good / Some estimates / Early estimate. |
| `MatcherSheet` | Search, filtered list, "I'm not sure", "Not a credit card", confirm. |
| `CalmNotice` | Debt-stress card: surface, accent icon, title, body, 2 actions. |
| `LeaveSheet` | External-link interstitial. |
| `Skeleton` | For hero, rows, card tiles. |

### 7.3 Card art

Use generic art, not issuer card images: avoids looking like a bank, keeps the APK small, and works when the product is unknown. Colour family per bank + product name text. If real art is added later, use it only with permission, and keep the name and fee text beside it (Great.Cards shows art alone).

---

## 8. States

| Situation | What the user sees |
|---|---|
| Loading (first compute, parsing history) | Skeletons for hero + 3 rows; "Reading 6 months of card messages… 40%". Cancel = close. Never a full-screen spinner over 2 s. |
| No credit cards detected | "We haven't seen any credit card messages yet." · "Add a card manually" · "Why might this be?" (SMS permission off, card SMS go to another phone). |
| Cards detected, none matched | Hero shows "Choose your cards to see your numbers" + list of unmatched tiles. Missed tab shows baseline estimates labelled "rough". |
| One card only | Missed tab: "With one card there's nothing to switch between. Explore shows cards that could pay more." |
| Already optimal | "You used your best card for 92% of spend. You missed only ₹40." (no confetti). |
| Under 30 days data | "Early look" badge; no annualising. |
| Rules stale / rule DB failed to update | Banner: "Reward rules couldn't update. Showing rules checked 12 Aug 2026." Numbers shown as ranges. Retry link. |
| Offline | Everything computed on device keeps working; Explore and rule refresh show "Offline, showing saved results from 2 Nov". |
| Error computing | "Something went wrong working this out." [Try again] [Report] — always a way back (✕). |
| Debt-stress | CalmNotice on Explore (6.2). |
| Explore: nothing beats current | "Your current cards already suit how you spend." |
| User turned Cards off | Tile on main app disappears; Settings → "Turn Cards back on". |

---

## 9. Copy bank (English · Hindi draft)

Hindi strings are drafts for a native reviewer. Keep sentences short; Hindi runs 10-20% longer.

| Key | English | Hindi (draft) |
|---|---|---|
| cards.title | Aaj Cards | आज कार्ड्स |
| hero.earned | Rewards you earned | आपने जो रिवॉर्ड कमाए |
| hero.could | You could have earned ₹1,850 with cards you already own | आपके अपने कार्ड से ₹1,850 मिल सकते थे |
| missed.row | Paid with HDFC ••4521 (1%) · SBI ••0083 pays 5% | HDFC ••4521 से भुगतान (1%) · SBI ••0083 पर 5% |
| tip | Next time on Swiggy, pay with SBI ••0083 | अगली बार Swiggy पर SBI ••0083 से भुगतान करें |
| match.title | Which HDFC card ends in 4521? | 4521 पर ख़त्म होने वाला कौन-सा HDFC कार्ड है? |
| match.unsure | I'm not sure | मुझे पक्का नहीं पता |
| explore.intro | Cards that would pay you more on your spending | आपके ख़र्च पर ज़्यादा फ़ायदा देने वाले कार्ड |
| approval.likely | Likely | संभावना अच्छी |
| approval.stretch | Stretch | थोड़ा मुश्किल |
| approval.unlikely | Unlikely | संभावना कम |
| approval.note | Our guess, not the bank's decision | यह हमारा अंदाज़ा है, बैंक का फ़ैसला नहीं |
| calm.title | Let's make your current cards work first | पहले अपने मौजूदा कार्ड का पूरा फ़ायदा लें |
| calm.body | Paying the full amount on time usually saves more than any new card earns. | समय पर पूरा बिल भरना अक्सर किसी नए कार्ड से ज़्यादा बचाता है। |
| verified | Rules checked 12 Oct 2026 | नियम 12 अक्टूबर 2026 को जाँचे गए |
| no.thanks | No thanks | नहीं, धन्यवाद |
| leave | You're going to the bank's website. Aaj doesn't send your details. | आप बैंक की वेबसाइट पर जा रहे हैं। आज आपकी जानकारी नहीं भेजता। |

Keep bank/product names, merchant names and ₹ figures in Latin script in both languages.

---

## 10. Visual style

- **Inherit:** Plus Jakarta Sans, `palettes` from `mobile/lib/theme.ts`, `elevation()`, existing sheet component, radius and spacing scale.
- **Distinct but consistent:** one Cards sub-accent used only inside Cards (header wordmark, tab indicator, card-art accents), e.g. a deep indigo `#3730a3` light / `#a5b4fc` dark. Check 4.5:1 on `surface` and `page` in both modes. Gains/deltas stay in Aaj teal so money semantics don't change between the main app and Cards.
- **Header frame** uses `heroFrom → heroTo` gradient on Cards home only (sense of "entering"), plain surface on sub-screens.
- **Orange (`warn`)** only for genuinely negative things the user controls (stale rules warning is muted ink, not orange). No red in Cards except actual errors.
- **Type:** headline ₹ 32/40 semibold with tabular numerals; body 15/22; muted 13/18. Devanagari: Noto Sans Devanagari, line height ≥ 1.5× for body, no fixed-height text containers, test with `fontScale` 1.3.
- **Motion:** slide-up open, 150-250 ms transitions, no number count-up animations on money (they read as hype and cost frames on low-end phones). Respect `AccessibilityInfo.isReduceMotionEnabled`.

## 11. Accessibility and low-end Android

- Touch targets ≥ 48dp (WeChat suggests 7-9 mm; Tawasal 44 px). ✕ and back in the frame are 48dp.
- Every number has an accessible label in words: "Plus three thousand two hundred rupees a year, range two thousand six hundred to three thousand eight hundred".
- Approval and status use icon + text, never colour alone.
- Support font scale up to 1.3 without truncating ₹ values (wrap, don't ellipsize numbers).
- Small screens (360×640 dp): hero + 3 rows visible above the fold on C4; card tiles in a vertical list, not a carousel.
- Performance: compute reports in a background task and cache per period; `FlatList` for transactions; card art drawn with gradients/SVG, no large PNGs; skeletons over spinners; work fully offline from local SMS-derived data.
- TalkBack order: header → hero → list → footer; bottom sheet traps focus and restores it on close.

## 12. Do not

- Don't add a 5th main-app tab or more than 4 Cards tabs.
- Don't show "pre-approved", "guaranteed", "instant approval", approval percentages or credit-score-style gauges.
- Don't show any apply/bank button in debt-stress mode, or new-card pushes to those users.
- Don't put the next-card list first; facts about owned cards come first.
- Don't style suggestions as alerts, or use urgency, countdowns, scarcity or gift-card bait ("₹3,000 on applying").
- Don't show card art without name and fees, or hide fees until the bank page.
- Don't show precise-looking numbers without period, assumptions and "last verified" date.
- Don't default any consent or notification to on; don't pre-tick.
- Don't use shame copy ("You lost ₹5,000!") or red/orange for missed rewards.
- Don't reuse savings testimonials as social proof.
- Don't trap the user: ✕ always closes, Android back always works, no exit confirmation.
- Don't gate the core answer (which of my cards to use) behind a paywall or sign-up.
- Don't rank by commission. If any payment affects order or inclusion, disclose it on the list.
- Don't use issuer logos/card images in a way that looks like the bank's own app.

## 13. Open questions / not verified

- PhonePe Switch, Jupiter and CRED in-app header specs: not public; patterns inferred from WeChat/LINE/Tawasal.
- Exact CCPA 13-pattern list: from secondary sources; check Annexure 1 on consumeraffairs.nic.in.
- Whether Aaj Cards counts as a DSA/DMA if it ever earns per application (see regulation.md): affects the disclosure bar and C9 wording. LAWYER.
- Hindi copy needs a native-speaker pass and on-device clipping test.
- Debt-stress thresholds (how many min-due cycles) need product decision and user testing.
