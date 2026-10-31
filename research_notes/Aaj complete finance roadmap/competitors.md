# Competitor landscape for Aaj (Indian "all your finances in one place" app), as of Oct 2026

Research date: 2026-10-30. 16 search/fetch calls. Many pricing/feature sources are third-party aggregators or competitor-run blogs (flagged inline). Little first-hand Reddit or Play Store review text surfaced in search, so the review evidence is thin (see Gaps).

## India: who offers what (tracking source, net worth, investments, bills, credit, family), and current status

### Takeaway

India has consolidated around two models: (1) SMS-parsing trackers attached to a lender (axio/ex-Walnut, now owned by Amazon; Moneyview), and (2) Account Aggregator (AA) consolidators attached to an investing or credit business (INDmoney, CRED Money, Jupiter). Fi has left consumer banking. Google Pay launched a free, multilingual Gemini spending assistant in Aug 2026, which is now the default "free spend analysis" for UPI-heavy users. No incumbent is a neutral, chat-first, family-aware tracker.

### Cited Findings

**Fi Money: banking shut down, company pivoted (current)**

- Mint reported (Jul 2025) that Fi laid off staff and shut some features to stay afloat, and that some investors had written off their stake. — [Mint via Magzter](https://www.magzter.com/en/stories/newspaper/Mint-New-Delhi/FI-MONEY-SHUTS-SOME-FEATURES-LAYS-OFF-STAFF-TO-STAY-AFLOAT)
- On 11 Mar 2026 Fi told customers banking services "will soon be discontinued". The Federal Bank partnership is ending ("business re-alignment"), accounts stay active with Federal Bank (users moved to FedMobile), and no new accounts can be opened. Fi says it served 3.5M+ customers and raised about $169M (Tracxn). The co-founder says Fi is pivoting to deep tech/AI for enterprises and "some products will be sunset". No end date was given, and the article does not say whether Fi's expense-tracking features survive. — [TechCrunch](https://techcrunch.com/2026/03/11/india-neobank-fi-winds-down-banking-services-on-its-platform)
- A further roughly 10% layoff in Jul 2026 is reported only by a job-listing site (low reliability). — [simplify.jobs](https://simplify.jobs/c/Fi-Money)

**axio (ex-Walnut): SMS tracker inside an Amazon-owned lender (current)**

- Amazon closed its acquisition of axio (formerly Capital Float, an NBFC) in Sep 2025 after RBI approval. The deal was about $200M, axio is a 100% subsidiary, and existing leadership continues. — [Business Standard](https://www.business-standard.com/amp/industry/news/amazon-completes-acquisition-axio-rbi-approval-125090401170_1.html); [YourStory](https://yourstory.com/2025/09/amazon-acquires-nbfc-axio-nearly-200-million-deepen-embeded-finance)
- The app ("axio: Expense Tracker & Budget", previously "& BNPL") is still updated (v8.9.6, Jul 2026; the notes add fixed deposits). The tracker auto-detects from transactional SMS (says it does not read personal SMS), covers bank accounts, cards, wallets and bills, and supports receipt photos. Pay Later EMIs, personal loans and FDs sit in the same app. — [APKMirror](https://www.apkmirror.com/apk/axio-digital-pvt-ltd/axio-expense-tracker-bnpl/axio-expense-tracker-budget-8-9-6-release/)
- Tracking is free. A vendor blog (Finny, June 2026) lists it as SMS-based and Android-centric, with BNPL/credit insights. — [Finny blog](https://getfinny.app/blog/best-expense-tracker-apps-india-2026)

**Moneyview: SMS tracker as a funnel for personal loans**

- Free SMS-parsing tracker with spending reports, budgets and bill reminders. Described as "one of the most established names" in SMS tracking (vendor blog). — [Finny blog](https://getfinny.app/blog/best-expense-tracker-apps-india-2026)
- Public complaints are mostly about the lending side: an EMI auto-debited while the app showed the payment as failed, double debits, an approved loan not disbursed. A Probe investigation into loan-app harassment names Money View (anecdotal). — [Voxya](https://voxya.com/consumer-complaints/money-view-auto-debit-double-payment-in-month/219257); [The Probe](https://theprobe.in/economy/loan-apps-harassment-blackmail-and-suicides-amid-regulatory-inaction-4605677)

**INDmoney: AA plus depository net worth, monetised by investing**

- Net worth tracking is free. It pulls from depositories and Account Aggregators, bank linking uses an in-app AA flow, and access is read-only. — [INDmoney net worth](https://www.indmoney.com/networth); [Track bank accounts](https://www.indmoney.com/networth/track-bank-accounts)
- Family view works only if each member has their own INDmoney account and tracks their data there. — [INDmoney family accounts](https://www.indmoney.com/networth/family-accounts)
- Third-party summaries list auto-categorisation, MF/EPF tracking, credit score monitoring and subscription detection. — [equitiesindia review](https://equitiesindia.com/tools-directory/indmoney-review)
- A Play review digest says users broadly find it useful, with some reporting access/login difficulties. — [Kimola](https://kimola.com/reports/unlock-indmoney-user-insights-solutions-with-our-report-google-play-hi-144809)

**CRED Money: AA consolidation for CRED's affluent card-payer base**

- Launched Jul 2024 on the AA framework: a unified bank balance view across multiple banks, wallets and UPI IDs, spend analysis, and reminders for recurring payments (SIPs, EMIs, rent) beyond credit card bills. No credentials are shared. — [Business Standard](https://www.business-standard.com/amp/finance/news/cred-launches-product-to-track-expenses-view-total-bank-account-balances-124072400997_1.html); [Entrackr](https://entrackr.com/2024/07/cred-launches-financial-management-platform-cred-money); [Inc42](https://inc42.com/buzz/kunal-shah-led-cred-unveils-new-offering-to-help-customers-manage-bank-accounts-track-expenses); [TechCrunch](https://techcrunch.com/2024/07/24/cred-launches-personal-finance-manager-for-indias-affluent/)
- (No 2025–26 review of CRED Money's current feature set was found. Launch-era information only.)

**Jupiter**

- Self-described (llms.txt, Apr 2026): automatic expense tracking, categorisation, budgeting, spend insights. — [jupiter.money/llms.txt](https://jupiter.money/llms.txt)
- Vendor blog: linked-account (not SMS) data, free, monthly budgets, nudges. A 2022 community post covers an AA-based net-worth feature. — [Finny blog](https://getfinny.app/blog/best-expense-tracker-apps-india-2026); [Jupiter community](https://community.jupiter.money/top?page=1)

**ET Money**

- MF investing, tax-saving, insurance and retirement platform with SMS-based daily/weekly spend reports. Tracking is free. — [Finny blog](https://getfinny.app/blog/best-expense-tracker-apps-india-2026); [techlomedia](https://techlomedia.in/top-apps/apps-changing-the-way-india-manages-money/)
- Trustpilot shows 2.9/5 from only 2 reviews: "support… completely stopped responding" and "worthless unless you pay for their premium plan" (tiny sample). — [Trustpilot](https://uk.trustpilot.com/review/etmoney.com)

**Google Pay: free AI spend analysis (new, Aug 2026)**

- "Ask Google Pay" is a Gemini assistant that analyses the user's GPay transaction history by text or voice in 10 Indian languages, and also answers general finance questions (SIPs, compounding). It is free, opt-in (requires Personalisation), works on Android and iOS, and excludes full account numbers and IDs. It launched around 5 Aug 2026 with a staged rollout and was announced alongside the Google Pay Flex SBI credit card. — [APAC News Network](https://apacnewsnetwork.com/2026/07/google-pay-can-now-tell-you-where-your-money-goes-heres-how/); [Tech2](https://www.tech2.com/apps/google-pay-gets-a-gemini-powered-chatbot-for-spending-insights-in-india-text-10240689.html)
- UPI apps show their own history but don't combine it across providers. — [Finny blog](https://getfinny.app/blog/best-expense-tracker-apps-india-2026)

**Manual/offline and indie trackers**

- Money Manager (Realbyte), a manual tracker: free with ads on Android. The iOS "Remove Ads" edition costs $5.99, plus a $19.99/yr or $2.49/mo subscription for data sync (US App Store). — [App Store](https://apps.apple.com/us/app/id564730202?l=en-us)
- Wallet by BudgetBakers: mostly manual in India, with limited Indian bank sync. Premium costs about €4.49/mo. — [Finny blog](https://getfinny.app/blog/best-expense-tracker-apps-india-2026)
- A wave of small 2025–26 Indian indie apps (Finny, Needle, Vrid, Finledge, MandateVault, Paisa Track) markets "no SMS permission", "on-device parsing" or AI/voice entry as the differentiator. — [Finny SMS blog](https://getfinny.app/blog/sms-expense-tracking-app); [Needle Play listing](https://play.google.com/store/apps/details?id=com.needle); [Finledge on Product Hunt](https://www.producthunt.com/p/finledge-expense-tracker/finledge-expense-tracker)

### Inferences

- Feature grid (combining the above):

| App                  | Auto-tracking source | Net worth        | MF/stocks | Bills                               | Credit score      | Family                                 | Business model             |
| -------------------- | -------------------- | ---------------- | --------- | ----------------------------------- | ----------------- | -------------------------------------- | -------------------------- |
| axio                 | SMS                  | no evidence      | no        | bill tracking                       | credit insights   | no                                     | BNPL/loans/FD (Amazon)     |
| Moneyview            | SMS                  | no evidence      | no        | reminders                           | yes (loan funnel) | no                                     | Personal loans             |
| INDmoney             | AA + depository      | yes              | yes, EPF  | not confirmed                       | yes               | yes, but every member needs an account | Broking/investing          |
| CRED Money           | AA                   | balances         | separate  | recurring reminders + CRED bill pay | yes (CRED core)   | not found                              | Cards, bill pay, lending   |
| Jupiter              | linked account       | 2022 AA feature  | partial   | not confirmed                       | not confirmed     | not found                              | Banking/cards              |
| ET Money             | SMS                  | not confirmed    | yes       | not confirmed                       | not confirmed     | not found                              | MF/insurance, premium plan |
| Google Pay           | own UPI history      | no               | no        | GPay bill pay                       | not confirmed     | no                                     | Payments, credit cards     |
| Money Manager/Wallet | manual               | partial (assets) | no        | no                                  | no                | no                                     | Ads / premium              |

- "Free tracker plus monetisation through loans or investments" is the dominant Indian model. Nobody charges for tracking alone, so a pure subscription is a hard sell in India. Aaj's "no loan-pushing, no investment upsell" stance is a real differentiator, and a credible trust story.
- Google Pay's free, 10-language voice/chat assistant removes Hindi chat and voice as a unique feature on its own. Aaj's edge has to be cross-source coverage (all banks, cards, cash, Gmail, family) plus actions (budgets, goals, bills), not chat by itself.
- Fi's exit and Walnut's absorption into a lender, now owned by Amazon, are exactly the "the app I trusted changed or died" pattern. Data export and "your data stays yours" are marketable.
- AA consolidators handle balances well. SMS apps cover daily transactions on Android only. Aaj's mix of SMS, notifications, Gmail and chat covers cash and iOS-ish gaps that neither model handles alone.

### Gaps

- Not researched in depth: Kuvera, Groww, Zerodha (Console/Coin), Paytm or PhonePe money-management features, or Finarkein-powered AA trackers. The PhonePe search returned nothing on spend analysis.
- No 2026 Play Store rating or review counts were retrieved for axio, Moneyview, INDmoney, CRED or Jupiter.
- No confirmation of whether Fi's money-tracking features still run after the banking wind-down.
- CRED Money's monetisation beyond the core CRED business wasn't confirmed.

## Global: features, pricing and monetisation (for patterns)

### Takeaway

Paid budgeting apps in the US cost about $95–$110 a year, and Mint's 2024 shutdown pushed users toward these paid apps (Monarch first). AI chat (Cleo, Copilot) and couples/partner support (Monarch) are the growth levers. Cleo shows the "AI chat + cash advance" model, which Indian lender-trackers mirror.

### Cited Findings

- Mint shut down in March 2024. Intuit pointed users to Credit Karma, which lacks Mint's budgeting. Most users moved to paid apps, Monarch most popular, then Copilot and YNAB (secondary sources). — [Tiller](https://tiller.com/mint); [Rethinking65](https://rethinking65.com/?p=12962); [Rocket Money](https://www.rocketmoney.com/learn/personal-finance/mint-app-shutting-down)
- Monarch: about $99.99/yr or $14.99/mo. The Core plan includes a partner seat (aggregator). — [Costbench](https://www.costbench.com/software/personal-finance/monarch-money/); [Toolradar couples guide](https://toolradar.com/guides/best-budgeting-apps-for-couples)
- YNAB: about $109/yr or $14.99/mo (aggregator). Price went $84 → $99 → $109 over three years, with each hike drawing 1-star reviews and some renewals raised silently (competitor blog). Reddit backlash in 2021 was mostly about how the increase was communicated. — [Costbench](https://costbench.com/software/personal-finance/ynab); [Pocketclear](https://pocketclear.app/blog/ynab-complaints-problems.html); [r/ynab mirror](https://lr.in.psf.lt/r/ynab/comments/qkf8fl/jumping_ship_due_to_ynab_price_increase)
- Copilot Money: about $95/yr or $13/mo, no free tier, a one-month trial, Apple and web only. Android status is unclear (one source says a limited 2025 beta, unverified). — [Costbench](https://www.costbench.com/best/best-budgeting-apps/); [Unstar](https://unstar.app/blog/ynab-vs-rocket-money-vs-monarch-budgeting-apps-ranked-2026)
- Rocket Money: pay-what-you-want premium, about $72–$144/yr. Complaints cover paywalls and bill-negotiation/cancellation not living up to its marketing (competitor blog). — [Rocket Money vs Mint, Gerald](https://joingerald.com/learn/cash-advance/rocket-money-vs-mint); [Unstar](https://unstar.app/blog/ynab-vs-rocket-money-vs-monarch-budgeting-apps-ranked-2026)
- Cleo: free tier, Plus $5.99/mo (cash advance and credit score), Pro $8.99, Builder $14.99 (credit-builder card). Advances run $250–$500 (sources conflict) with no interest, but express fees apply. — [Cleo pricing](https://web.meetcleo.com/pricing); [Penny Hoarder](https://www.thepennyhoarder.com/budgeting/cleo-app-review/)
- Emma: the free plan connects 2 accounts. Paid pricing was found only from a Dec 2024 help article (flag: likely outdated). — [Emma help](https://intercom.help/emma-help-center/en/articles/10273884-how-much-does-emma-cost); [Orbitmoney](https://orbitmoney.io/compare/emma-app-review)
- Spendee: Premium about $2.99/mo or $22.99/yr with bank sync, plus a 7-day trial (review site, unconfirmed officially). — [Millennial Money](https://millennialmoney.com/spendee-review)
- Wallet by BudgetBakers: about €4.49/mo premium (see the India section). — [Finny blog](https://getfinny.app/blog/best-expense-tracker-apps-india-2026)

### Inferences

- Global willingness to pay ($8–15/mo) depends on reliable bank sync, which in India is AA plus SMS. A rough India price point for a premium tier would be far lower (a guess, not sourced).
- Partner seats (Monarch) and shared household budgets are a selling point in the West. Aaj's family split fits that pattern in an Indian joint-family form.
- Shutdowns (Mint, Fi) and price hikes (YNAB) are the top trust-breakers. Communicating price changes transparently and offering export are cheap wins.

### Gaps

- No official 2026 pricing pages were fetched for Monarch, YNAB or Copilot. Figures come from aggregators.
- Emma's current pricing wasn't verified.

## What users love and hate, and the unmet needs Aaj can win on

### Takeaway

Recurring complaints: SMS trackers need whole-inbox permission and parse unreliably across banks, tracker apps double as loan funnels, support is weak, prices rise, and apps shut down or pivot. Recurring unmet needs: privacy-first tracking, cash and UPI coverage across apps, family views that don't require every member to sign up, and a neutral app that doesn't push loans.

### Cited Findings

- SMS tracking needs "one of the broadest permissions an Android app can request: the ability to read all your text messages". SMS parsing accuracy "varies by bank and message format". — [Finny SMS blog](https://getfinny.app/blog/sms-expense-tracking-app); [Finny India 2026](https://getfinny.app/blog/best-expense-tracker-apps-india-2026)
- A 2026 roundup ranked a no-SMS, no-bank-link, on-device-encrypted tracker first, above Paisa Track, Money Manager, Wallet and Ivy Wallet. This shows privacy-first is a marketed axis. — [search summary of Redsider roundup, via Finny/pocketclear results](https://pocketclear.app/blog/best-expense-tracker-india.html)
- No tracker can automatically import UPI transactions across apps, so manual entry is the fallback (vendor claim). — [Pocketclear](https://pocketclear.app/blog/free-expense-tracker-india.html)
- Moneyview complaints centre on the loan product (auto-debit errors, disbursal failures), not tracking. — [Voxya](https://voxya.com/consumer-complaints/money-view-auto-debit-double-payment-in-month/219257)
- ET Money: support unresponsive, premium paywall (2 reviews). — [Trustpilot](https://uk.trustpilot.com/review/etmoney.com)
- INDmoney family net worth requires each member to hold an account. — [INDmoney](https://www.indmoney.com/networth/family-accounts)
- Fi's user reviews (Kimola digest) highlight "major service issues" before the wind-down. — [Kimola](https://kimola.com/reports/uncover-what-users-really-think-of-fi-money-app-app-store-in-155762)
- Mint refugees complain Credit Karma dropped budgeting. — [Plisio](https://plisio.net/tradfi/mint-vs-credit-karma)
- YNAB: price-hike anger, silent renewals. Copilot: high praise but no Android. — [Pocketclear](https://pocketclear.app/blog/ynab-complaints-problems.html); [Unstar](https://unstar.app/blog/ynab-vs-rocket-money-vs-monarch-budgeting-apps-ranked-2026)

### Inferences (opportunities for Aaj)

1. **Neutral and no loan-pushing.** axio (Amazon lender), Moneyview (loans), CRED (credit) and INDmoney (broking) all monetise through finance products. "We never sell you a loan" positions Aaj against all of them.
2. **Privacy story for SMS and notifications.** Parse on-device or only bank sender IDs, show what was read, and offer delete/export. Indie competitors already market this, so Aaj needs it to stay level.
3. **Cash and cross-UPI coverage via chat and voice.** Telegram and voice logging fills the gap SMS and AA miss (cash, split bills, other people's UPI). GPay only sees GPay.
4. **Family without forced sign-ups.** INDmoney needs each member's account. Aaj's family split can let one person track household or parents' spending, and invite others optionally.
5. **Hindi and vernacular.** GPay now offers 10 languages for analysis only. Aaj can match that for logging and budgets, so it must not be sold as unique.
6. **Continuity and trust.** Fi's shutdown and Walnut's absorption show the risk. Promise export (CSV/Sheets) and open, Telegram-based access.
7. **Bills and recurring payments.** CRED Money already does SIP/EMI/rent reminders. Aaj's BBPS fetch plus 50/30/20 and EMI-cap rules (the "keep EMIs under 40%" rule) is a coaching layer competitors don't advertise.
8. **Pricing.** Indian incumbents give tracking away free. Aaj likely needs a generous free tier and a small premium (family, Gmail, exports), or donations, rather than a US-style $100/yr subscription.

### Gaps

- Real Reddit (r/IndiaInvestments, r/personalfinanceindia) threads did not surface in search. Sentiment there is unverified.
- No systematic Play Store review mining (star distributions, top complaint themes) for Indian apps was done. Only anecdotal complaint sites were found.
- No data on Hindi or vernacular demand specifically for expense trackers, beyond GPay's 10-language launch.
