# Data access and payment rails in India for a solo developer (as of Oct 2026)

Context: "Aaj", a solo-developer personal finance app (Telegram bot + Expo Android + Next.js/Vercel + Supabase), free tools only, no company or revenue. It currently ingests bank SMS/notifications and Gmail; bill fetch is mocked (no BBPS access).

Research date: 2026-10-30. Many pricing figures come from vendor or third-party pages, not official price lists. They are flagged as such.

## 1. Account Aggregator (AA): FIU eligibility, TSPs, pricing, live FI types

### Takeaway

An FIU must be an entity regulated by RBI, SEBI, IRDAI or PFRDA. A TSP (Setu, Finvu, Finarkein, etc.) only builds and runs the FIU module _for_ a regulated entity and cannot act as the licensed FIU itself. So an unregistered individual or startup cannot legally pull AA data on its own. The only route is to partner with a regulated entity that acts as the FIU, or to get a licence (for example a SEBI Investment Adviser registration). Bank accounts, MF, equities and GST are live. EPF and PPF are not.

### Cited Findings

- Sahamati: an FIU "must be registered and regulated by at least one Financial Service Regulator (RBI, SEBI, IRDAI, PFRDA)". Onboarding takes 7 steps: (1) be regulated by an FSR; (2) implement ReBIT FIU API specs; (3) test against RBI-approved AA sandboxes; (4) enrol in the UAT Central Registry; (5) get certified by a Sahamati-empanelled auditor; (6) be added to the Central Registry; (7) go live. The page also says "every entity needs to be a FIP first and then an FIU" — [Sahamati FIU page](https://sahamati.org.in/?p=1224)
- A fintech with no NBFC, lending or investment-adviser licence "cannot directly become an FIU". Its options are to obtain a licence, or to partner with a regulated entity that acts as FIU while the fintech builds the product layer. A TSP "builds and operates the FIU or FIP module on behalf of a regulated entity" and cannot itself be the licensed participant — [ecorpit, AA integration 2026](https://ecorpit.com/account-aggregator-integration-fintech-builders-2026/)
- Treelife likewise describes FIUs as overseen by RBI/SEBI/IRDAI/PFRDA depending on sector. An NBFC-AA licence (to _be_ an AA) needs ≥ ₹2 crore net owned funds under the 2025 AA Directions — [Treelife](https://treelife.in/fintech/nbfc-account-aggregator-licence-eligibility/)
- RBI recognised Sahamati as the AA ecosystem's self-regulatory organisation (SRO) on 5 June 2026. This rests on a secondary source and was not confirmed on rbi.org.in — [ecorpit](https://ecorpit.com/account-aggregator-integration-fintech-builders-2026/)
- A standardised AA fee model starts 1 Nov 2026. FIUs pay "a common fee under a standard contract" through a single bill, split between the FIP, the AA and Sahamati. Participants **cannot charge customers** for sharing data. No amounts were published in the article. 17 companies hold AA Certificates of Registration — [CAalley](https://caalley.com/news-updates/indian-news/explained-what-is-account-aggregator-framework-and-how-does-it-work)
- Setu's TSP pricing is not public. Third-party estimates put it at roughly ₹10–25 per successful fetch, with enterprise contracts going through sales. Another estimate gives ₹5–15 per consent plus per fetch, so ₹15–50 per fully fetched application. These figures are **unverified** — [productgrowth.in (Setu)](https://productgrowth.in/tools/banking-api/setu/); [javajack AA notes](https://javajack.github.io/b2b-lending-india/04-integrations/account-aggregator/); [HyperVerge FIU guide](https://hyperverge.co/blog/best-account-aggregators/)
- Setu's get-started docs say Setu bills for certification, but no amount is shown. Setu offers AA gateway docs and a sandbox flow — [Setu AA docs](https://docs.setu.co/data/account-aggregator/v1/get-started); [Setu AA overview](https://docs.setu.co/data/account-aggregator/overview)
- An estimated first-year in-house FIU build costs ₹5–25 lakh+ over 5–10 months. This is an order-of-magnitude estimate credited to CASParser — [ecorpit](https://ecorpit.com/account-aggregator-integration-fintech-builders-2026/)
- FI types live as of March 2026, per the article's table:
  - Savings accounts (singly held): all 72 listed banks.
  - Equities, MF units, ETFs, AIFs, REITs: via CDSL/NSDL on 13 AAs.
  - MF folios: via CAMS/KFin on 13 AAs.
  - GSTR-1/3B: via GSTN.
  - FD/RD: about 40% of banks.
  - Insurance: 57 insurers, many on only 1–2 AAs.
  - NPS: CRAs added as FIPs in 2023, live status unclear.
  - **EPF, PPF, bonds, G-Secs: proposed only, with no FIPs and no production schemas.**
  - Excluded: joint accounts, NRE/NRO accounts, non-proprietor current accounts.
    — [ecorpit](https://ecorpit.com/account-aggregator-integration-fintech-builders-2026/)
- Sahamati's own summary: only asset data is available (bank, deposits, MF, insurance, pension) — [Sahamati FIU page](https://sahamati.org.in/?p=1224)
- Recent timeline: FIUs had to adopt a new deposit schema version before 25 Apr 2026, and the old one was decommissioned 24 May 2026 — [fintegrationfs](https://www.fintegrationfs.com/post/nbfc-aa-api-compliance-adoption-timeline-fiu-fip-2026)
- DPDP Act: consent-manager registration and the penalty framework arrive around Nov 2026, with full compliance by May 2027. The overlap between AAs and DPDP consent managers is unsettled — [ecorpit](https://ecorpit.com/account-aggregator-integration-fintech-builders-2026/)

### Inferences

- For Aaj today, AA is **not achievable** as a direct integration. The realistic legal paths are:
  - (a) a solo founder getting a SEBI Investment Adviser or Research Analyst registration, which carries its own qualification, fee and net-worth requirements (not researched here);
  - (b) partnering with a regulated entity (NBFC, broker, IA) that is the FIU of record and shares insights with the app under contract;
  - (c) a user-initiated workaround: the user exports statements themselves (bank PDF or CSV, CAS) and uploads or emails them to Aaj.
- Even with a partner, the 1 Nov 2026 standard fee means per-fetch costs fall on the FIU and cannot be passed to the user as a data-sharing charge. A free app would absorb them.
- A sandbox for prototyping (Setu or other TSPs) is useful for learning the consent flow, but it cannot go to production without a regulated FIU.

### Gaps

- No official per-consent or per-fetch prices for Setu, Finvu, OneMoney, Anumati, CAMS Finserv, Finarkein, Saafe or Digio. None were found published. All require sales contact.
- The amount of the standardised 1 Nov 2026 AA fee was not found.
- Not verified whether any TSP currently offers a self-serve free sandbox signup (Setu Bridge historically did). Needs a direct check at bridge.setu.co.
- The SRO date and the "FIP first, then FIU" statement were not checked against primary RBI text.

## 2. Mutual funds and stocks: CAS statements and parsing

### Takeaway

User-initiated CAS import is the best free, legal route for MF and demat holdings. The user requests a CAS from CAMS, KFintech or AMFI by PAN and email, or downloads a demat CAS from NSDL or CDSL. The PDF arrives password-protected, and the open-source MIT library `casparser` parses CAMS, KFintech, NSDL and CDSL formats.

### Cited Findings

- CAMS and KFintech have CAS request pages where the investor enters PAN and email and receives the PDF by email. AMFI links to them — [AMFI download CAS](https://amfiindia.com/investor-corner/online-center/download-CAS.html); [AMFI CAS page](https://www.amfiindia.com/investor-corner/investor-center/cas.html)
- MF Central (a joint CAMS + KFintech platform) allows login with PAN + mobile/OTP and offers a CAS/Statement menu — [IncredMoney](https://www.incredmoney.com/knowledge-center/share-market/how-to-download-consolidated-account-statement-cas-step-by-step-instructions/); [inkl](https://www.inkl.com/news/how-to-download-cas-from-mfcentral)
- Passwords vary by issuer, and sources conflict:
  - One says CDSL uses the PAN, NSDL uses the 8-digit client ID, and CAMS/KFintech use a password the user sets when requesting — [IncredMoney](https://www.incredmoney.com/knowledge-center/?p=4219)
  - Another says the password is typically the uppercase PAN or DOB in DDMMYYYY — [mutualfundreport](https://mutualfundreport.netlify.app/how-to-analyze-mutual-fund-cas)
- `casparser` (github.com/codereverser/casparser) parses CAMS/KFintech detailed and summary CAS and NSDL/CDSL demat CAS. Its API is `read_cas_pdf(path, password)`, which returns pydantic models (CASData / NSDLCASData) or JSON. It has a CLI with JSON/CSV export and a beta capital-gains report. Since v1.0 it runs on pypdfium2 and is MIT licensed (GPL/AGPL dependencies removed). ISIN/AMFI lookup needs `casparser-isin`. Re-printed PDFs and **MF Central statements are not supported** — [GitHub casparser](https://github.com/codereverser/casparser); [PyPI](https://pypi.org/project/casparser/)
- AA also carries MF folios (CAMS/KFin) and demat holdings (NSDL/CDSL), but only to regulated FIUs (see section 1) — [ecorpit](https://ecorpit.com/account-aggregator-integration-fintech-builders-2026/)

### Inferences

- Aaj can automate this end to end for free:
  1. The user requests a CAS to their own Gmail.
  2. Aaj's existing Gmail ingestion picks up the CAS email, or the user uploads the PDF to the Telegram bot.
  3. A Python worker running casparser parses it, with the password supplied by the user.
- Hosting: casparser is Python, so it needs a Python runtime. Options are a Vercel Python function, a free-tier worker, or a port of the logic to TS (not researched).
- Telling users to request CAS from CAMS or KFintech rather than MF Central avoids the unsupported template.

### Gaps

- No official public CAS API from CAMS, KFintech or MF Central was found for third-party apps. Partner APIs may exist for distributors or RIAs (unverified).
- The exact current password conventions should be checked with a real statement.

## 3. EPF, NPS, PPF

### Takeaway

None of the three has a public third-party API. EPF and PPF are not on AA yet. The workable routes are user-downloaded statements: the EPF passbook PDF from the EPFO portal or UMANG, NPS statements from the CRA, and PPF from the bank or post office. Manual entry also works.

### Cited Findings

- The EPF passbook can be downloaded as a PDF from the EPFO Member Passbook portal or the UMANG app, with UAN + login. Since 1 Aug 2025 UAN activation uses Aadhaar face authentication on UMANG. Balance by SMS or missed call gives the balance only — [Groww](https://groww.in/p/savings-schemes/epf-passbook-download); [Jupiter](https://jupiter.money/blog/epf-passbook-download/)
- Commercial "UAN/EPFO verification" and employment-history APIs (for example Surepass) exist for onboarding and background checks. They are not an official passbook feed — [Surepass blog](https://surepass.io/blog/how-to-download-pf-statement-a-step-by-step-guide)
- On AA, EPF and PPF are proposed with no FIPs. NPS CRAs were added as FIPs in 2023 — [ecorpit](https://ecorpit.com/account-aggregator-integration-fintech-builders-2026/)

### Inferences

- For EPF, the user uploads the passbook PDF and Aaj parses it with a custom PDF parser. No open-source parser was verified.
- PPF is simplest as manual entry plus the annual interest rate.
- NPS: a statement upload from the CRA (Protean/KFin/CAMS) is the likely route.
- Scraping EPFO or UMANG with user credentials would be fragile and is likely against their terms of service. Not recommended.

### Gaps

- NPS statement formats and download paths, and any NPS consumer API, were not researched (search budget).
- No open-source EPF passbook parser was verified.

## 4. Credit score (CIBIL, Experian, Equifax, CRIF)

### Takeaway

Bureau data is regulated under CICRA 2005. Direct access is for credit institutions and members, and aggregator APIs (Surepass, Decentro, etc.) charge about ₹35–55 per pull and require a business entity and KYC. A solo dev cannot realistically offer an in-app score for free. The legal free route is to send users to the bureaus' own free score channels (for example Experian on WhatsApp, or the free annual report) and let them upload or enter the score.

### Cited Findings

- There are four RBI-licensed CICs (TransUnion CIBIL, Experian, Equifax, CRIF High Mark) under CICRA 2005. Most lenders reach them through API aggregators — [FinBox Research](https://research.finbox.in/blog/credit-bureau-data-api-providers-india-what-to-know/)
- Eligibility summary: CIBIL is tied to regulated financial institutions, and non-RBI fintechs are possibly admitted "if criteria met". Experian serves regulated lenders. Equifax serves CICRA-defined, registered institutions. This comes from a Scribd summary and is **unverified** — [Scribd Credit Data Access](https://www.scribd.com/document/879110634/Credit-Data-Access)
- Aggregator pricing is about ₹35–55 per report, or an example ₹50 per report. A security audit or bureau data-security certification is estimated at 6–10 weeks (vendor blog, unverified) — [Decentro](https://decentro.tech/resources/credit-bureau-api); [Surepass multi-bureau](https://surepass.io/?p=16862); [vistarkriya blog](https://vistarkriyablog.blogspot.com/2026/04/credit-bureau-api-integration-access.html)
- Bureau terms bar recipients from aggregating, storing, republishing or selling credit information except as agreed and in line with CICRA — [Protium credit bureau T&C](https://protium.co.in/regulatory/credit-bureau-terms-and-conditions)
- Fintech consumer partnerships exist. In Mar 2026 Payinstacard partnered with Experian India for free credit reports and monitoring, a product said to cost ₹600–2,000 a year elsewhere. OneScore and BankBazaar have similar tie-ups. These are B2B deals for established companies — [EntrepreneurIndia](https://www.entrepreneurindia.com/blog/en/news/payinstacard-and-experian-india-partner-users-to-get-free-credit-reports-alerts-and-financial-education.59591); [bankbazaar](https://bankbazaar.com/experian.html)
- Experian India offers free scores on WhatsApp, with a password-protected report sent to the user's email (since 2022) — [Experian plc PR 2022](https://www.experianplc.com/newsroom/press-releases/2022/experian-becomes-first-credit-bureau-in-india-to-offer-free-credit-scores-on-whatsapp)
- RBI reportedly requires each CIC to give individuals one free full credit report a year. This rests on a secondary source — [theprint](https://theprint.in/ani-press-releases/the-best-ways-to-check-your-credit-score-online-at-no-cost/750023)

### Inferences

- Aaj can offer a "credit score tracker" without any bureau API. The user checks their score on Experian WhatsApp, CIBIL or another free channel and enters it, or forwards the emailed report PDF.
- Parsing a bureau report the user forwarded themselves stays user-initiated. The CICRA reuse limits bind the bureau's _members_, not a user sharing their own report. That last point is an inference and needs legal confirmation.
- Embedded scores need a company plus a bureau partnership or aggregator, at a paid per-pull cost.

### Gaps

- No official direct-to-bureau developer pricing or eligibility from CIBIL or Experian developer pages.
- The free annual report mandate was not checked against RBI primary text.

## 5. BBPS (Bharat Connect) bill fetch and pay

### Takeaway

Becoming a BBPOU is out of reach: RBI authorisation with a historically ₹100 crore net-worth requirement, reportedly lowered to ₹25 crore (unverified). An agent institution under a COU has no stated net-worth requirement, but it still needs a registered business, KYC/business documents and agreements with the COU (Setu, Cashfree, Paytm, a bank). Pricing is contract-only. No path for an individual was found. User-initiated alternatives are deep-linking users to their own UPI app's BBPS/bill section, or keeping bill reminders based on parsed bill emails and SMS.

### Cited Findings

- Setu BillPay: the business registers as a BBPS agent, with approvals handled by Setu, its bank partner and BBPS. Business details go through Setu's onboarding team, which issues credentials. The BillCollect route needs KYC and business documents, a consent form, an SOP agreement and a pricing agreement. Go-live is a claimed 2–3 weeks (marketing) — [Setu BillPay API integration](https://docs.setu.co/payments/billpay/api-integration); [Setu BBPS quickstart](https://docs.setu.co/payments/bbps/quickstart); [Setu BBPS COU](https://setu.co/payments/bbps/cou/)
- Setu does not publish a comprehensive price list. Contact onboarding@setu.co — [productgrowth.in](https://productgrowth.in/tools/banking-api/setu/)
- Cashfree offers a BBPS API and is BBPS COU certified, with NPCI onboarding configuration docs — [Cashfree BBPS docs](https://www.cashfree.com/docs/api-reference/other-apis/bbps/overview); [Cashfree COU blog](https://www.cashfree.com/blog/cashfree-now-offers-a-complete-bbps-stack-with-bbps-cou-certification/)
- Agent institutions: "no net-worth requirement stipulated". The agent must submit an Agent-Institution consent letter to a Consumer BBPOU and follow NPCI technical standards — [Axis Bank BBPS agent FAQ](https://axisbank.com/business-banking/bharat-bill-payment-system/agent/got-a-query)
- BBPOU net worth: RBI's 2014 draft proposed ₹100 crore. A later cut to ₹25 crore for non-bank BBPOUs is reported by a study site and unverified. The 2024 RBI Master Direction defines a COU as an entity giving customers an interface to pay bills directly or through agent institutions — [Business Standard 2014](https://www.business-standard.com/article/news-ians/rbi-proposes-minimum-rs-100-crore-net-worth-for-bbpous-114080800651_1.html); [optimizeias](https://optimizeias.com/bharat-bill-payment-system-bbps); [RBI Master Direction BBPS 2024 (taxguru copy)](https://taxguru.in/rbi/master-direction-reserve-bank-india-bharat-bill-payment-system-directions-2024.html)
- NPCI Bharat Connect has rationalised AI–COU relationships, and a newer rule links payment-aggregator status to routing, with a compliance deadline of 30 Jun 2026 — [Bharat Connect circular](https://www.bharat-connect.com/strapi/uploads/Rationalisation_of_AI_COU_relationship_846b05ec51.pdf)

### Inferences

- Aaj's mocked bill fetch should stay mocked, or switch to a parse-based approach: extract amount and due date from biller emails and SMS that Aaj already ingests. Payment then hands off to the user's own UPI app, whose bill-pay section is BBPS.
- Real BBPS needs at least a registered entity (proprietorship or private limited company) plus a signed COU agreement. Expect paid per-transaction pricing. Setu and Cashfree are the most developer-friendly, though "free test environment" access appears to come only after onboarding (unverified).

### Gaps

- No public BBPS sandbox open to individuals was confirmed.
- No current (2025–26) RBI figure for BBPOU net worth was found.
- Razorpay and Paytm bill-pay API requirements were not researched individually.

## 6. UPI: intent deep links, PSP, Autopay, history

### Takeaway

Since 28 Feb 2026 NPCI has made UPI Intent the mandatory standard for mobile, and Collect is deprecated for most cases. An app can open `upi://pay?pa=<VPA>&pn=<name>&am=<amt>&cu=INR` to launch the user's own UPI app with the details prefilled. No PSP licence is needed to _generate_ the link, since the user's UPI app does the payment. Verified merchant collection, Autopay mandates and reading UPI history all need a PSP, bank or payment aggregator relationship. UPI history is only practical from SMS, notifications or email.

### Cited Findings

- UPI Collect is phased out for most mobile use cases from 28 Feb 2026, with exemptions for IPOs, some iOS cases, mandate management and cross-border PAs. NPCI guidelines restrict manual VPA entry on mobile. These are payment-vendor sources; the NPCI circular was not found — [Razorpay UPI collect migration](https://razorpay.com/docs/announcements/upi-collect-migration/recurring-payments/custom-checkout); [Razorpay intent vs collect](https://razorpay.com/blog/upi-intent-vs-collect-success-rates/); [Equentis UPI rules 2026](https://www.equentis.com/blog/upi-transaction-new-rules-2026-complete-guide-for-users-and-merchants/)
- The UPI deep link/QR format is `upi://pay?pa=…&pn=…&am=…&cu=INR`. On iOS the generic UPI app tray does not work, so per-app URL prefixes are needed. Desktop uses QR — [Solidgate UPI Intent](https://docs.solidgate.com/payments/alternative-payments/apms-overview/upi/upi-intent/); [Rocketpay](https://rocketpay.co.in/blog/upi-intent-collect-flow)
- NPCI's 2017 circular sets mandatory parameters for merchant-initiated intent calls — [NPCI Circular 18 (2017)](https://www.npci.org.in/PDF/npci/upi/circular/2017/Circular18_BankCompliances_to_enbaleUPIMerchantecosystem_0.pdf)
- One source reports a 0.4% MDR on P2M payments above ₹2,000 from 15 Oct 2026. This is **unverified** and should be checked against NPCI — [Equentis](https://www.equentis.com/blog/upi-transaction-new-rules-2026-complete-guide-for-users-and-merchants/)

### Inferences

- "Pay this bill" in Aaj can be a `upi://pay` intent to the biller's published VPA, or simply opening the user's UPI app. There is no PSP and no money touches Aaj.
- Caveats: some UPI apps limit or warn on non-merchant P2P intents with prefilled amounts. Aaj also gets no reliable success callback without a PSP, so the payment should be confirmed later from the bank SMS.
- UPI Autopay (e-mandate) creation needs a PSP or payment aggregator. Aaj can only _track_ mandates from SMS and email.
- No public API exists for a user's UPI transaction history. Bank SMS/notification parsing (already built) or AA (regulated only) are the routes.

### Gaps

- UPI Lite and Autopay limits for 2026 and the exact NPCI circular numbers were not verified within the search budget.
- No primary NPCI source was found for the 2026 Collect deprecation or for P2P intent restrictions.

## 7. Gmail API and Android SMS permissions

### Takeaway

Reading Gmail (gmail.readonly) is a _restricted_ scope. A public app needs OAuth verification plus an annual CASA Tier 2 security assessment. TAC Security lists $540 (Basic), $720 (Premium) and $1,800 (Enterprise) per app per year; other quotes run to $10k+. Below that, an unverified or "Testing" app is capped at 100 users for the project's lifetime, and in Testing mode tokens expire every 7 days. Play allows READ_SMS/RECEIVE_SMS for "SMS-based money management… apps that track and manage budget", subject to review through the Permissions Declaration Form. Approval is not guaranteed.

### Cited Findings

- Google: apps requesting restricted scopes must pass a security assessment and be revalidated **every year** — [Google Cloud Help, Security Assessment](https://support.google.com/cloud/answer/13465431?hl=en)
- Unverified apps requesting unapproved sensitive or restricted scopes are capped at **100 new users in total over the project's lifetime**, a cap that "cannot be reset". Projects in "Testing" status are limited to 100 listed test users, and test-user authorizations and refresh tokens **expire after 7 days** — [Google Cloud Help 15549945](https://support.google.com/cloud/answer/15549945?hl=en)
- TAC Security (Google's highlighted CASA lab) prices Tier 2 at $540 Basic (annual assessment + 2 revalidation cycles), $720 Premium, and $1,800 Enterprise (unlimited revalidation). Tier 2 typically takes about 1–3 weeks to the Letter of Validation (2024 figure). Other labs include Leviathan, Bishop Fox and NetSentries — [TAC Security ESOF/CASA](https://tacsecurity.com/esof/); [Switch Labs CASA pricing](https://www.switchlabs.dev/post/casa-tier-2-tier-3-security-review-providers-pricing-and-the-cheapest-option)
- Developer reports vary. One Indie Hackers founder paid $540 for Tier 2 in Jan 2026. Forum posts say $10k+, and a reseller claims $15k–75k (a marketing claim). Expect 40–80 hours of paperwork — [Indie Hackers](https://www.indiehackers.com/product/mailnotes); [Latenode forum](https://community.latenode.com/t/is-casa-tier-2-assessment-necessary-for-all-gmail-api-apps-options-for-indie-developers/22861); [truto](https://truto.one/google.md); [Gmail verification wall](https://bluesky-3o2.pages.dev/ideas/social-inbox/gmail-verification-wall/)
- gmail.send is sensitive, not restricted. Read and modify scopes are restricted. A Google forum thread from Oct 2026 reports no recent case of restricted Gmail scopes passing without CASA — [Gmail verification wall](https://bluesky-3o2.pages.dev/ideas/social-inbox/gmail-verification-wall/); [Google Security community](https://security.googlecloudcommunity.com/google-security-operations-2/what-happened-to-local-app-gmail-api-access-7138)
- Play SMS policy: "SMS-based money management (e.g., apps that track and manage budget)" may use READ_SMS, RECEIVE_SMS, RECEIVE_MMS and RECEIVE_WAP_PUSH, but not SEND_SMS or WRITE_SMS. Conditions:
  - It is "subject to Google Play review and approval".
  - The permission must enable core functionality with no alternative method.
  - The app must have a privacy policy and show prominent disclosure and consent.
  - It must be declared in the Permissions Declaration Form.
  - Budgeting apps "may not exfiltrate or share non-financial or personal SMS history".
    — [Play Console Help 10208820](https://support.google.com/googleplay/android-developer/answer/10208820?hl=en); [Play SMS/Call Log policy 9047303](https://support.google.com/googleplay/android-developer/answer/9047303)
- A Play policy update is marked effective 27 Jan 2027, removing phone-call account verification as a READ_CALL_LOG use — [Play Console Help 17225965](https://support.google.com/googleplay/android-developer/answer/17225965)
- Precedent: Bluecoins dropped its SMS banking feature after failing to get an exception in 2018 — [Bluecoins](https://bluecoinsapp.com/?p=9286)

### Inferences

- Gmail, free options:
  - (a) Stay under 100 users with an unverified app. This suits a personal or beta stage, but the lifetime cap means you cannot exceed it later without verification.
  - (b) **Use email forwarding instead of OAuth.** The user sets a Gmail filter that auto-forwards bank and biller alerts to an Aaj inbound address (for example Cloudflare Email Routing to a Worker, free). No restricted scope and no CASA are needed, and it is fully user-initiated. This is the strongest free path past 100 users.
  - (c) Budget about $540–720 a year for TAC Tier 2 once revenue exists.
- Android SMS: sideloaded or direct-APK distribution avoids Play review entirely. For Play, the budget-tracker exception is the right category, but approval is discretionary. NotificationListenerService, which reads bank-app notifications, is a fallback. Its Play policy was not researched here.
- Keeping SMS parsing on-device and uploading only parsed financial transactions supports the "no exfiltration of non-financial SMS" condition.

### Gaps

- Play policy on NotificationListenerService for finance apps was not researched.
- Whether Google ever exempts Gmail restricted scopes for "personal use" or single-user apps was not confirmed. The 100-user cap is the documented limit.

## 8. Ranking by feasibility for a solo dev (synthesis)

### Takeaway

Free now and solo: SMS/notification parsing (Play approval needed for SMS), Gmail under 100 users or via email forwarding, user-uploaded CAS (casparser), EPF/NPS/bank statement uploads, a manually entered credit score, and UPI intent links. A company and contracts are needed for BBPS agent access via Setu or Cashfree, credit bureau APIs via aggregators, Gmail CASA past 100 users (cost rather than a company requirement), and UPI Autopay or verified collection through a PA. A regulated licence or regulated partner is needed for AA (FIU) and for becoming a BBPOU or PSP.

### Cited Findings

- AA FIU must be RBI/SEBI/IRDAI/PFRDA regulated — [Sahamati](https://sahamati.org.in/?p=1224)
- BBPS agents need a COU agreement and business KYC — [Setu BBPS quickstart](https://docs.setu.co/payments/bbps/quickstart); [Axis Bank](https://axisbank.com/business-banking/bharat-bill-payment-system/agent/got-a-query)
- Bureau APIs cost about ₹35–55 per pull through aggregators — [Decentro](https://decentro.tech/resources/credit-bureau-api)
- CASA Tier 2 from $540 a year — [TAC Security](https://tacsecurity.com/esof/)
- casparser is MIT licensed and free — [GitHub](https://github.com/codereverser/casparser)

### Inferences

- Tier A (free, solo, now):
  - bank SMS/notification parsing;
  - Gmail via auto-forward to an inbound address, or OAuth while under 100 users;
  - CAS PDF parsing for MF and demat;
  - statement uploads for EPF, NPS, PPF and bank (PDF/CSV);
  - credit score entered manually or parsed from a report the user forwards;
  - `upi://pay` intent hand-off for bills;
  - bill due dates parsed from emails and SMS.
- Tier B (needs company/KYC and/or money): BBPS via Setu, Cashfree or Paytm as an agent institution; credit bureau pulls via Surepass or Decentro; Gmail CASA ($540+/yr); payment aggregator for Autopay or collections.
- Tier C (needs a regulated licence or regulated partner): AA FIU (data pull); BBPOU; UPI PSP; becoming a CIC member.

### Gaps

- Costs of forming a minimal entity (proprietorship vs private limited company) and whether a proprietorship is accepted by Setu or Cashfree BBPS were not researched.
