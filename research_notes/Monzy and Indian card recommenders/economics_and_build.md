# Economics, demand and build feasibility of a spend-data-driven credit-card recommender in India (as of Nov 2026)

Scope note: about 18 search/fetch calls. Many affiliate figures come from affiliate networks' own marketing blogs (EarnKaro, Cuelinks). These are self-interested sources with inconsistent dates (pages titled "2026" carry 2024/2025 bylines). Treat the rupee figures as indicative, not contractual. Nothing was signed up for.

## Affiliate economics and other monetisation

### Takeaway

Through Indian affiliate networks (EarnKaro/BankKaro, Cuelinks, GroMo and similar), one approved and activated card typically pays the referrer about INR 350 to 3,000. Mass-market cards cluster around INR 1,500 to 2,400. Payout is usually triggered by activation or dispatch, not by the application, and gets confirmed 30 to 90 days later. An indie developer can join these networks for free. A bank's own refer-and-earn pays much less.

### Cited Findings

- EarnKaro rate card (byline 22 May 2025; the title claims 2026). Axis Magnus/Atlas up to INR 2,975. Axis MyZone, Flipkart, Airtel, Indian Oil and IOCL RuPay a flat INR 2,380. Axis Privilege up to INR 1,275. Axis LIC Signature INR 976, LIC Platinum INR 424. SBI Card (Cashback, SimplyCLICK, SimplySAVE, Prime, BPCL, Miles, Elite) a flat INR 2,240. ICICI up to INR 2,400. HDFC (Pixel Play, IRCTC, Swiggy, RuPay, Marriott, Shoppers Stop) a flat INR 1,500. IDFC FIRST Ashwa up to INR 1,750, SWYP/Power Plus up to INR 1,400, Power/Mayura/FIRST up to INR 1,050, WOW/Earn INR 350. IndusInd (Tiger, Platinum, Legend and others) up to INR 1,600. RBL up to INR 1,280. AU LIT/Altura up to INR 1,540, NOMO INR 350. Yes Pop-Club INR 1,540. Federal Scapia INR 770. Kiwi (UPI credit card) INR 1,500. The FAQ on the same page says Axis pays "up to INR 3,500", which contradicts the INR 2,975 above. — [EarnKaro](https://earnkaro.com/blog/credit-card-affiliate-programs)
- Same EarnKaro page, conditions: most payouts are triggered "on card activation", 72-hour tracking, confirmation within 75 days of activation. Joining is free through the EarnKaro app. — [EarnKaro](https://earnkaro.com/blog/credit-card-affiliate-programs)
- EarnKaro SBI page (byline 16 Jan 2025). SimplyCLICK and IRCTC pay up to INR 1,750 "per successful card disbursal". 30-day cookie. Commission confirmed 30 days after disbursal, then paid by NEFT in 6 to 10 days, minimum withdrawal INR 10. Cancelled or returned transactions void the commission. Listed applicant eligibility: SimplyCLICK needs age 21 to 60, score 700+ and INR 20k/month income; IRCTC needs score 650+. — [EarnKaro SBI](https://earnkaro.com/blog/sbi-affiliate-program)
- EarnKaro also quotes ICICI as "up to INR 430" on approval in one place and up to INR 2,400 on activation in another, so the rate depends on the trigger event. — [EarnKaro ICICI](https://earnkaro.com/blog/icici-bank-affiliate-program); [EarnKaro listing](https://earnkaro.com/blog/credit-card-affiliate-programs)
- Cuelinks lists about INR 1,890 per card for several SBI variants. It claims banks' official refer-and-earn pays only about INR 250 to 500, against up to about INR 4,000 through affiliate programmes (an unverified marketing claim). It also notes that validation can take 60 to 90 days and that some campaigns don't pay when a user takes several cards in the same period. — [Cuelinks](https://www.cuelinks.com/blog/best-credit-card-affiliate-programs/)
- A DSA/aggregator site (RuLoans) gives sub-DSA ranges: SBI entry-level cards INR 500 to 1,200, ICICI entry-level cards INR 700 to 1,500. — [RuLoans](https://www.ruloans.com/blog/?p=13575)
- An affiliate directory lists HDFC at INR 1,200 to 2,200 per approved card. Generic guides put the typical range at INR 500 to 3,000 per approved application. — [UpPromote HDFC](https://uppromote.com/affiliate-directory/hdfc-bank/); [Gromo](https://gromo.in/blog/15-best-credit-card-affiliate-programs-in-india)
- GroMo (byline 25 Nov 2024) lists GroMo, BankBazaar, Cuelinks, vCommission, Admitad and EarnKaro as networks, with bank offers (SBI, HDFC, ICICI, Axis, SC, Kotak, IndusInd, RBL, OneCard) available "via networks". Its payout models are CPL, CPA (approval/dispatch/activation), CPS (first transaction) and rarely CPC. Its illustrative maths: INR 2,500 at 10% approval versus INR 900 at 40% approval. — [GroMo](https://gromo.in/blog/15-best-credit-card-affiliate-programs-in-india)
- AU listing: validation is "successful credit card dispatch". — [web summary of affiliate listings](https://earnkaro.com/blog/credit-card-affiliate-programs)
- Scale of the incumbent: CashKaro (parent of BankKaro and EarnKaro) had FY25 revenue of INR 350 crore (up about 16% from INR 302 crore), with finance "almost 20%" of revenue. BankKaro recommends cards, insurance and loans. — [Ascendants, Aug 2025](https://ascendants.in/business-stories/cashkaro-fy25-revenue-growth-cashback-affiliate/)
- US analogues: Kudos earns affiliate fees on completed card applications plus a share of merchant cashback ("Kudos Boost"). CardPointers+ costs USD 60/yr and MaxRewards Gold USD 84/yr, so subscriptions are a proven model for "which card to use" optimisers in the US. — [College Investor](https://thecollegeinvestor.com/46251/kudos-review/); [TechCrunch, Oct 2022](https://techcrunch.com/2022/10/20/kudos-7m-credit-card-rewards/amp/)

### Inferences

- A blended payout of about INR 1,500 per activated card is a reasonable planning number for a mass-market mix (SBI, Axis co-brands, HDFC co-brands, ICICI). Premium cards (Magnus/Atlas) pay about INR 3,000, but few users qualify for them.
- Revenue model per 1,000 MAU, for illustration only (no published Indian conversion data was found). Assume 30% already hold or are open to cards and would view a recommendation, 5 to 10% of viewers click "apply", and 25 to 40% of applications approve and activate. That gives about 4 to 12 activated cards per 1,000 MAU per year, or INR 6k to 18k a year at INR 1,500. Since Aaj knows its users' spend, conversion could beat quiz products, but the absolute revenue is small until MAU reaches the tens of thousands. At 50k MAU it would be roughly INR 3 to 9 lakh/yr. These are inferences, not sourced numbers.
- Network fees sit between the bank and the indie developer: the bank pays the network more than the developer receives. Going to a bank directly (DSA/partner) needs an entity, volume and compliance. That is not realistic for an indie at first.
- A subscription at INR 49 to 99/month for "which card to use" alerts and devaluation alerts may be more robust than affiliate income, since the CardPointers/MaxRewards precedent exists. Indian willingness to pay is unproven (no source found).
- Payout timing of 30 to 90 days plus activation-dependent clawbacks means cash flow lags conversions by about 2 to 3 months.

### Gaps

- No public BankKaro partner rate card or CardPe/sub-DSA terms were found. Rates for Amex, Tata Neu HDFC and Amazon Pay ICICI were not found specifically; Amazon Pay ICICI is often not on affiliate lists because it is issued in-app.
- No published approval or conversion rates for Indian affiliate card applications were found. Paisabazaar's partner programme terms were not found.
- Sponsored placement pricing was not found.

## Demand: market size, search and pain points

### Takeaway

India had about 12.4 crore (124 million) credit cards outstanding in Aug 2026, growing a slow about 6 to 8% YoY, with only about 0.9 million net additions a month. The market is concentrated: HDFC holds about 30% of spends and SBI Card about 19%. RuPay-on-UPI is the main growth vector. The main user pain points are devaluations, spam calls after using aggregators, and false "pre-approved" offers.

### Cited Findings

- RBI-derived data: 124.05 million cards outstanding in Aug 2026, against 122.85 million in Jul 2026 and 112.34 million in Aug 2025. Card spends were INR 2.02 lakh crore in Aug 2026 (INR 2.08 lakh crore in Jul). Outstanding cards grew about 8% YoY in FY26, against 19% in Mar 2024. Sources disagree slightly on monthly counts. — [Angel One, Aug 2026 data](https://www.angelone.in/news/economy/credit-card-spending-declines-by-2-8-to-2-02-trillion-in-august-2026); [Whalesbook](https://www.whalesbook.com/news/English/bankingfinance/RBI-Norms-Slow-India-Credit-Card-Growth-Prioritize-Quality/69f24e4808235f0c2a1c493b)
- March 2026: 118 million cards (+8% YoY), about 0.9 million monthly additions, spends INR 2.19 lakh crore, 574 million transactions (+25.4% YoY). HDFC had about 30% spend share (a record) and SBI Card 19.3% (spends +31% YoY). IDFC FIRST cards in force grew 28% YoY. — [Business Today, 28 Apr 2026](https://www.businesstoday.in/personal-finance/banking/story/credit-card-spends-jump-to-rs219-lakh-crore-in-march-hdfc-hits-record-share-sbi-outperforms-527779-2026-04-28)
- FY26 card spends were reportedly about INR 23.6 trillion. — [StartupTalky](https://startuptalky.com/news/india-credit-card-spending-fy2026-trends-risks-rbi-changes/)
- TransUnion CIBIL put outstanding card balances at about INR 3.1 lakh crore in Mar 2026. — [Angel One/CIBIL via search summary](https://www.angelone.in/news/economy/credit-card-spending-declines-by-2-8-to-2-02-trillion-in-august-2026)
- RuPay credit on UPI: NPCI said about INR 10,000 crore a month in Aug 2024. A Mint headline says credit-card UPI lifted RuPay's volume share to 38%. A low-confidence 2026 claim says RuPay is near 40% of new issuances. NPCI's headline UPI totals exclude credit-card-on-UPI. Transactions up to INR 2,000 carry no MDR. — [Mint via Magzter](https://www.magzter.com/en/stories/newspaper/Mint-Mumbai/CREDIT-CARD-UPI-LIFTS-RUPAY-VOLUME-MKT-SHARE-TO-38); [LoansJagat](https://www.loansjagat.com/news/rupay-credit-cards-ride-upi-growth-approach-nearly-40-share-in-new-issuances); [Outlook Business](https://www.outlookbusiness.com/news/no-charge-for-rupay-credit-card-use-on-upi-for-transaction-up-to-rs-2-000-npci-news-227737)
- r/CreditCardsIndia has about 376k to 403k members (third-party trackers). — [HiveIndex](https://thehiveindex.com/communities/r-creditcardsindia/); [GummySearch](https://gummysearch.com/r/CreditCardsIndia/)
- Pain point, spam calls: users report a flood of lender calls after checking CIBIL on Paisabazaar or Bajaj. One TechnoFino user still got weekly marketing SMS after closing a Paisabazaar account in 2022. — [Lokmat Times](https://www.lokmattimes.com/technology/cibils-role-under-scanner-users-complain-of-spam-calls-after-credit-checks-on-bajaj-finance-1/amp); [Inventiva](https://www.inventiva.co.in/?p=374065); [TechnoFino thread](https://technofino.in/community/threads/paisabazaar-unauthorised-activity-sms.7978/latest)
- Pain point, false "pre-approved" offers: TechnoFino warns that aggregator "pre-approved" offers aren't real, and that applying through them risks rejection plus a hard enquiry. Only the issuer can pre-approve. — [TechnoFino](https://technofino.in/community/goto/post?id=52451)
- Competitive set: Monzy is positioned as "India's first credit card discovery platform designed around the user", quiz-based (spend habits, values, travel), with the tagline "5 minutes, spam free". It placed #33 on Product Hunt's daily list with 8 upvotes. Other Indian tools: CardMasters, Card Insider, Credeem, Multiply, BankTalky. — [Product Hunt](https://www.producthunt.com/p/monzy); [hunted.space](https://hunted.space/product/monzy); [Credeem](https://www.producthunt.com/p/credeem-credit-cards-rewards-for-india/credeem-launching-v2); [Card Insider](https://yourstory.com/companies/card-insider)

### Inferences

- With only about 0.9 million net new cards a month, a recommender earns from a small flow. The larger audience is the roughly 124 million existing cards: optimising which card to use, alerting on devaluations, and second-card upgrades.
- "Spam-free, no phone number" is already Monzy's pitch. Aaj's edge is real spend data, not privacy alone.

### Gaps

- No free source gave India search volume for "best credit card" (the free Google Keyword Planner gives ranges after login, which wasn't done). Subscriber counts for TechnoFino, CA Rachana Ranade and similar creators were not retrieved.
- Issuer card-share percentages for Aug 2026 were not found (only spend shares). There is no verified 2026 monthly value for RuPay-credit-on-UPI.

## Recommendation methodology, data sources and devaluation burden

### Takeaway

Net annual value per card can be computed from the user's spend profile, but the rule base changes several times a year per major issuer. Notable changes: Axis moved from MCC to internal categories in Jun 2025, SBI Cashback got sub-caps and new exclusions in Apr 2026, and HDFC Infinia got a voucher sub-cap in Jul 2026. A hand-curated database of about 30 to 50 cards with a change log is the realistic MVP.

### Cited Findings

- Axis changed Flipkart Axis dining rewards on 20 Jun 2025: classification moved from MCC to Axis-internal categories. — [CardTrail](https://www.cardtrail.in/rewards/reward-devaluation-hdfc-axis-icici-2025/); [CardTrail Axis](https://cardtrail.pages.dev/india-rules/axis-bank-reward-devaluation-2025)
- Axis Vistara cards lost milestone benefits, welcome tickets and Maharaja Club after 18 Apr 2025. Magnus had its fee raised and its monthly milestone removed. — [EaseMoney, Apr 2025](https://easemoney.in/news/credit-card-changes-india-april-2025)
- HDFC added fees on rent, wallets, gaming and utilities from 1 Jul (2025), with tighter caps. Regalia lounge access now needs a quarterly spend. — [Business Standard topic page](https://www.business-standard.com/topic/credit-card/page-2); [NewsBytes](https://www.newsbytesapp.com/news/business/major-banks-revise-credit-card-fees-and-rules/story)
- SBI SimplyCLICK Swiggy rewards went from 10X to 5X, and Air India SBI Platinum from 15 to 5 points per INR 100. — [Business Today, 7 Apr 2026](https://www.businesstoday.in/amp/personal-finance/banking/story/credit-card-rewards-reset-hdfc-sbi-axis-tighten-benefits-spend-linked-perks-take-centre-stage-524485-2026-04-07)
- CardAdvisor devaluation log (a secondary tracker with internal inconsistencies). Axis Atlas revamp on 20 Apr 2024: welcome bonus halved, travel accelerator capped at INR 2L/month, seven categories excluded. Atlas transfer partners changed again on 2 Apr 2026, about 5 Aug 2026 and 25 Sep 2026. SBI Cashback in Apr 2026: gaming, toll and government payments excluded, and online/offline sub-caps of INR 2,000 each with a combined ceiling cut from INR 5,000 to 4,000. HDFC Infinia on 1 Jul 2026: voucher sub-cap of 3,000 RP/month. A 16 Jan 2026 Infinia voucher cut to 3X was rolled back. Its count: 2 dated major changes in 2024, 0 dated in 2025 (an under-count against the press items above), and 7 dated in 2026 up to Sep. — [CardAdvisor](https://cardadvisor.in/articles/credit-card-devaluation-tracker-india-2025-2026)
- Business Today (Apr 2026) says SBI Card, HDFC and ICICI all announced reward changes effective April 2026, driven by rising reward costs. — [Business Today](https://www.businesstoday.in/amp/personal-finance/banking/story/credit-card-rewards-reset-hdfc-sbi-axis-tighten-benefits-spend-linked-perks-take-centre-stage-524485-2026-04-07)
- Existing free trackers: InvestingPro devaluation tracker, CardAdvisor, CardTrail. — [InvestingPro](https://www.investingpro.in/credit-cards/devaluation-tracker)
- An open-source Indian cards project (sidhant947/cards) is listed on awesome.ecosyste.ms, but its GitHub URL returned 404 when fetched. — [ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Fsidhant947%2Fcards)

### Inferences

- Net annual value formula: sum over categories of (spend × reward rate × point value), each category capped at its cap. Subtract excluded categories (rent, wallet, fuel, insurance, gold, government, utilities over thresholds). Add milestone bonuses where projected spend crosses them. Add the fee waiver if annual spend is above the waiver threshold, otherwise subtract the fee plus 18% GST. Add the lounge value used (count × assumed INR 1,000 to 1,500). Subtract forex markup × foreign spend and fuel surcharge net of waiver. Rank by marginal value over the user's current best card, not by absolute value.
- Point redemption value needs a per-card, per-route table (cashback, voucher, airmiles) because devaluations often hit it (Infinia voucher cap, Atlas partner changes).
- Maintenance: at least about 10 meaningful rule changes a year across the top issuers. That points to monthly review of about 40 cards plus a "last verified" date shown in the UI. Scraping MITC/KFS PDFs helps with fees, but reward rules mostly live in T&C pages and notices.

### Gaps

- No public, licensed TechnoFino community sheet was verified. There is no machine-readable MITC source. I could not produce an exact devaluation count for 2024 to 2026 (trackers disagree).

## Eligibility and approval odds without a bureau pull

### Takeaway

Issuers publish income thresholds, not score cut-offs. Approval odds can be estimated from SMS-derived salary credits, existing cards and their limits, EMI/bounce signals and missed-payment SMS, plus stated income. Show these as bands, never as "pre-approved".

### Cited Findings

- HDFC Regalia Gold, official page: salaried applicants need gross monthly income above INR 1.5 lakh; self-employed need an ITR above INR 12 lakh/yr. Older HDFC material said INR 1.2 lakh/month and Paisabazaar says INR 1 lakh/month (they conflict). — [HDFC](https://www.hdfc.bank.in/credit-cards/regalia-gold-credit-card/eligibility); [HDFC Regalia](https://www.hdfc.bank.in/credit-cards/regalia-credit-card/eligibility); [Paisabazaar](https://www.paisabazaar.com/hdfc-bank/credit-card-eligibility/)
- Axis Magnus needs INR 24 lakh net annual (salaried). Atlas is about INR 6 lakh with a "760+" odds band (secondary source). — [InvestingPro Magnus](https://www.investingpro.in/articles/axis-magnus-credit-card-eligibility-2026); [InvestingPro Atlas](https://www.investingpro.in/credit-cards/axis-atlas-credit-card)
- SBI SimplyCLICK: score 700+ and INR 20k/month; IRCTC: 650+. — [EarnKaro SBI](https://earnkaro.com/blog/sbi-affiliate-program)
- Only issuers can truly pre-approve. — [TechnoFino](https://technofino.in/community/goto/post?id=52451)

### Inferences

- Most issuers approve existing customers more easily (based on the pre-approved offers banks send). SMS shows which banks the user already holds accounts with, so recommendations could favour cards from the user's salary bank.

### Gaps

- No source quantified approval rates by score band.

## Per-transaction "which card now" optimisation

### Takeaway

Kudos/CardPointers/MaxRewards prove the model in the US (subscriptions of USD 60 to 84/yr plus affiliate fees). In India, SMS carries merchant names but not MCCs. Axis's move to internal categories in 2025 makes even MCC unreliable, so merchant-to-category mapping has to be curated and confidence-scored.

### Cited Findings

- CardPointers can auto-activate merchant offers. MaxRewards is a dashboard; Kudos is a checkout wallet. — [College Investor](https://thecollegeinvestor.com/46251/kudos-review/); [CardStack](https://cardstack.money/articles/guides/maxrewards-vs-kudos)
- Axis Flipkart card dining now follows Axis-internal categorisation, not MCC (Jun 2025). — [CardTrail](https://www.cardtrail.in/rewards/reward-devaluation-hdfc-axis-icici-2025/)

### Inferences

- Use Aaj's existing merchant normalisation to suggest a card before recurring spends (Swiggy, Amazon, fuel, rent). A post-hoc "you lost INR X this month by using card A instead of B" report is feasible with SMS data alone, and it is a strong hook.
- UPI on a RuPay credit card shows up in SMS differently from a card swipe. Detecting it helps model which rewards apply, since many cards exclude UPI or reward it lower.

### Gaps

- No Indian per-transaction optimiser with public metrics was found.

## Risks and responsible design

### Takeaway

Bias toward high-payout cards, stale rules and pushing credit on stressed users are the core risks. RBI rules ban unsolicited cards and make issuers answerable for agents and partners, so partner terms will impose conduct rules.

### Cited Findings

- RBI 2022 Directions: no unsolicited cards; prior explicit consent is required; issuers must follow the outsourcing code of conduct and answer for their agents and partners. A newer 2025 direction for commercial banks exists (28 Nov 2025). — [RBI FAQ](https://website.rbi.org.in/documents/87730/71798953/FAQonMasterDirectionCreditCardandDebitCardIssuanceandConductDirections2022.pdf/8c1e1e27-0064-a371-254c-56d0646a7171); [RBI MD](https://rbi.org.in/scripts/BS_ViewMasDirections.aspx?id=12300); [Cyril Amarchand 2024 amendments](https://www.cyrilshroff.com/wp-content/uploads/2024/04/Recent-Amendments-to-Master-Directions-on-Credit-and-Debit-Card.pdf)
- Spam-call and data-sharing backlash against aggregators. — [Inventiva](https://www.inventiva.co.in/?p=374065)
- Outstanding balances were about INR 3.1 lakh crore in Mar 2026; the Mint headline "card debt rise dims but defaults worry". — [Magzter/Mint](https://www.magzter.com/es/stories/newspaper/Mint-New-Delhi/CARD-DEBT-RISE-DIMS-BUT-DEFAULTS-WORRY)

### Inferences

- Guardrails:
  - Hide "apply" if SMS shows minimum-due-only payments, late fees, high utilisation or EMI bounces.
  - Rank by user value, and disclose the commission and the ranking basis.
  - Never send user data to networks (plain deep links only).
  - Show a "rules verified on" date.

### Gaps

- I did not check whether the DPDP Act rules (2025) or RBI digital-lending guidelines apply to affiliate recommenders.

## MVP and realistic revenue

### Takeaway

The MVP is a curated database of about 30 to 40 cards, an NAV calculator over the user's last 3 to 12 months of SMS-categorised spend, a "missed rewards" report on cards the user already holds, a top-3 recommendation using affiliate deep links, and devaluation alerts. Revenue at small scale is modest: affiliate income is roughly INR 6k to 18k a year per 1,000 MAU (inferred).

### Cited Findings

- Per-card payouts of about INR 350 to 2,975, activation-triggered, confirmed in 30 to 75 days. — [EarnKaro](https://earnkaro.com/blog/credit-card-affiliate-programs); [EarnKaro SBI](https://earnkaro.com/blog/sbi-affiliate-program)
- US optimiser subscriptions cost USD 60 to 84/yr. — [College Investor](https://thecollegeinvestor.com/46251/kudos-review/)

### Inferences

- Steps:
  1. Build a cards table in Supabase: rules as JSON, plus `verified_at`.
  2. Map Aaj's spend categories to card categories.
  3. Write a server-side NAV function.
  4. Add an app screen and a Telegram "/bestcard" command.
  5. Add EarnKaro/Cuelinks links. Joining is free, but the user would have to sign up personally; that was not done here.
  6. Add a monthly manual devaluation review.
- Key metrics: recommendation views, apply clicks, approved/activated cards, INR per activated card, "missed rewards" surfaced per user, and rule staleness (days).

### Gaps

- No Indian benchmarks for MAU-to-card conversion or subscription willingness to pay were found.
