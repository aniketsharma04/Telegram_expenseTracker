# Regulatory and platform-policy constraints for "Aaj" (Indian personal-finance app), as of Oct 2026

Scope: a solo-developer app (Telegram bot, Expo Android app, Next.js web, Supabase) that reads bank SMS and notifications (NotificationListenerService) and Gmail (readonly) to capture transactions automatically, applies budgeting rules, and plans to add investment tracking, tax tips, bill pay and possibly recommendations.
Research date: 2026-10-30. About 17 searches and fetches. Several primary documents (the DPDP Rules Gazette PDF, the JSA PDF) could not be read: the PDF did not parse and one site returned 403. Some findings below rest on law-firm or secondary summaries and are marked as such. None of this is legal advice.

---

## 1. SEBI: Investment Adviser (IA) and Research Analyst (RA) rules, finfluencers, advice vs education, AI

### Takeaway

SEBI requires registration for anyone who "acts as" or "holds itself out as" an investment adviser. The exemptions are narrow:

- general, good-faith comments on market trends that do not name a particular security or product;
- advice published in widely available mass media.

Recommending specific mutual funds or stocks to a particular user based on their own data is the core of "investment advice" and needs IA registration (or RA registration for research and recommendations on securities). Generic budgeting rules (50/30/20, EMI caps, emergency fund) and plain portfolio tracking fall outside securities advice. AI-based advice gets no carve-out. SEBI now puts AI duties on registered advisers instead.

### Cited Findings

- Under Regulation 3 of the IA Regulations, 2013, any person "acting" or "holding itself out" as an investment adviser must register with SEBI. Commentators call the definition wide enough to cover "almost everyone who provides investment advice". — [Nishith Desai Associates](https://nishithdesai.com/research-and-articles/hotline/corpsec-hotline/investment-advisers-time-to-register-8408); [India Corporate Law blog (2013)](https://indiacorplaw.in/2013/01/21/sebi-has-released-today-sebi-investmen/)
- Exemption: a person giving general comments in good faith on trends in the financial or securities market is exempt, provided the comments do not specify any particular securities or investment product. — [Nishith Desai Associates, IA regulations PDF](https://www.nishithdesai.com/fileadmin/user_upload/pdfs/Research%20Articles/India%20notifies%20investment%20advisers%20regulations%20_%20are%20you%20regulated%20now_.pdf); [IA Regulations 2013 text (ICMAI copy)](https://icmai.in/upload/pd/SEBI-IA-Regulations-2013.pdf)
- "Investment advice" excludes advice given through a newspaper, magazine, or any electronic, broadcasting or telecommunications medium that is widely available to the public at large. — [Nishith Desai Associates](https://nishithdesai.com/SectionCategory/33/Research-and-Articles/12/55/38/8408/13.html)
- Insurance agents, insurance brokers and pension advisers who advise solely on IRDAI or PFRDA products, and are registered with that regulator, are exempt from IA registration. — [Nishith Desai Associates](https://nishithdesai.com/research-and-articles/hotline/corpsec-hotline/investment-advisers-time-to-register-8408)
- The December 2024 IA (Second Amendment) Regulations, 2024:
  - brought part-time investment advisers within the definition;
  - revised the definition of investment advice to exclude trading calls;
  - added Reg 15(14): an IA using AI tools, "irrespective of the scale and scenario of adoption", is responsible for client data and for the efficacy of the data used;
  - added Reg 18(9): the IA must disclose to clients the extent of AI use in its advice.
    — [Mondaq](https://www.mondaq.com/india/securities/1616712/securities-and-exchange-board-of-india-investment-advisers-second-amendment-regulations-2024); [Bar & Bench](https://www.barandbench.com/news/law-policy/sebis-amendment-to-investment-advisor-regulations-addresses-ai-concerns); [Taxmann](https://taxmann.com/post/blog/sebi-mandates-investment-advisers-to-disclose-use-of-ai-tools-to-clients-in-providing-investment-advice); [Upstox news](https://upstox.com/news/business-news/financial-regulations/sebi-allows-part-time-investment-advisers-puts-conditions-for-ai-use-all-you-need-to-know/article-135636)
- A 2025 SEBI (Intermediaries) amendment added a chapter on AI and ML. Any SEBI-regulated entity using AI or ML tools, whether built in-house or from third parties, is solely responsible for data privacy, security and integrity. The definition of tools is broad and covers investment strategies, trading, compliance and business management. This applies to regulated entities; it does not license unregistered ones. — [summary in search results; see Mondaq "SEBI's new digital compliance rules ... 2026"](https://www.mondaq.com/india/securities/1759228/sebis-new-digital-compliance-rules-what-investment-advisers-must-know-in-2026)
- The RA (Third Amendment) Regulations, notified 16 Dec 2024, added definitions including "part-time research analyst", "research services" and "persons associated with research services". They followed SEBI's consultation paper of 6 Aug 2024. A November 2025 RA (Second Amendment) revised eligibility and certification requirements. — [SCC Online](https://www.scconline.com/blog/post/2024/12/19/sebi-research-analyst-third-amendment-regulations-2024/); [TeamLease RegTech](https://teamleaseregtech.com/updates/article/49798/securities-and-exchange-board-of-india-research-analysts-second-amendment-regulations-2025/); [LKS Corporate Amicus Oct 2025](https://www.lkslaw.com/insights/newsletters/corporate-amicus/corporate-amicus-october-2025)
- Finfluencer rules:
  - The October 2024 circular required SEBI-regulated entities and their agents to end, within 3 months, any association with unregistered persons who give advice or recommendations or make return claims.
  - Persons "exclusively engaged in investor education" who do not, directly or indirectly, give advice are exempt.
  - The 29 Jan 2025 clarification defines "association" broadly: any "transaction involving money or money's worth", client referrals, "interaction of information technology systems" and similar links. It also extends the rule to MF distributors, authorised persons, and PMS and AIF distributors.
    — [Business Standard](https://business-standard.com/amp/finance/news/sebi-gives-3-month-window-to-end-associations-with-unregistered-entities-124102201169_1.html); [Legal500 / Mansukhlal Hiralal](https://www.legal500.com/developments/thought-leadership/securities-law-update-sebi-imposes-restrictions-on-intermediaries-and-finfluencers/); [Inc42](https://inc42.com/buzz/sebi-bars-regulated-entities-from-associating-with-unregistered-finfluencers); [Medianama (2024)](https://www.medianama.com/2024/09/223-sebi-regulated-firms-barred-from-collaborating-with-unregistered-finfluencers/)

### Inferences

- **Allowed without registration (low risk):**
  - expense tracking;
  - budgeting rules (50/30/20, EMI-to-income cap, emergency-fund months);
  - read-only display of holdings or portfolio value the user enters or imports;
  - SIP and goal calculators that use returns the user enters;
  - generic education on what an index fund or ELSS is, with no named scheme or stock;
  - generic, non-personalised statements (for example "diversify; keep 6 months of expenses as an emergency fund").
- **Grey zone:**
  - Personalised asset-allocation output such as "you should hold 60% equity / 40% debt" based on the user's age, income and risk profile. It names no security, but it is tailored to a client and is arguably "advice on investing". The general-comments exemption covers market trends only, not tailored allocation. Treat it as advice unless counsel says otherwise, or present it as a user-driven calculator with disclaimers.
- **Needs SEBI IA registration (or a partnership with a registered IA or RA):**
  - recommending specific mutual fund schemes or stocks;
  - "buy / sell / switch" prompts;
  - model portfolios;
  - AI chatbot answers that name securities for that user.
    The mass-media exclusion is unlikely to cover a personalised in-app recommendation.
- **Monetisation trap:** if Aaj earns affiliate or referral fees from a broker or AMC distributor, those regulated entities are barred from paying an unregistered person who gives advice or makes return claims. Aaj would have to stay strictly "investor education only", or the partner will not be able to work with it.
- **AI does not avoid any of this.** SEBI's approach makes the registered entity responsible for its AI tools. An unregistered app's AI that recommends securities is still unregistered advice.

### Gaps

- I could not confirm the exact wording of the investor-education exemption conditions. I recall a condition barring use of market price data from the preceding 3 months, from SEBI's 2024 board decision or Intermediaries amendment, but no source in this session confirmed it.
- I found no SEBI guidance specific to robo-advisory apps or personal-finance apps for 2025–2026.
- The 2025 IA/RA FAQs were not fetched.
- Registration costs and eligibility (net worth, NISM certification, qualification) for an individual IA under the 2024 amendments were not retrieved.

---

## 2. RBI: balances, digital lending, payment aggregators, data localisation

### Takeaway

Showing balances and transactions the app parses from the user's own SMS or email is not a regulated activity in itself. Two monetisation routes are regulated:

- **Loan offers or referrals:** these pull Aaj into the RBI Digital Lending Directions, 2025 as a Lending Service Provider (LSP) of a regulated entity, under contract with it, and trigger Google Play's personal-loan policy.
- **Holding or settling customer funds** for bill pay: this needs RBI authorisation as a payment aggregator, with ₹15 crore net worth. A solo developer cannot get that, so bill pay has to go through a licensed partner.

### Cited Findings

- The RBI (Digital Lending) Directions, 2025, issued 8 May 2025:
  - replaced the Guidelines on Digital Lending of 2 Sep 2022 and the 2023 Default Loss Guarantee guidelines;
  - multi-lender arrangement provisions took effect 1 Nov 2025;
  - reporting of Digital Lending Apps (DLAs) took effect 15 Jun 2025.
    — [RBI notification](https://www.rbi.org.in/scripts/FS_Notification.aspx?Id=12848); [Mondaq overview](https://www.mondaq.com/india/financial-services/1629916/rbi-digital-lending-directions-2025-an-overview); [ELP Law PDF](https://elplaw.in/wp-content/uploads/2025/05/Regulatory-Update-on-RBIs-Consolidated-Digital-Lending-Framework-%E2%80%93-May-2025.pdf)
- An LSP is an agent of a regulated entity (RE) and does work such as customer acquisition, underwriting support, pricing and servicing. REs must do enhanced due diligence, sign a written agreement, and review LSPs periodically. LSPs must follow RBI outsourcing and digital lending norms. The Directions align data-privacy duties with the DPDP Act. — [SS Rana](https://ssrana.in/articles/rbi-introduced-digital-lending-direction-2025/); [Mondaq](https://www.mondaq.com/india/financial-services/1625008/rbi-notifies-reserve-bank-of-india-digital-lending-directions-2025)
- The RBI (Regulation of Payment Aggregators) Directions, 2025, issued 15 Sep 2025, took effect immediately. Non-bank PAs need ₹15 crore net worth when they apply and ₹25 crore by the end of the third financial year after authorisation. Banks need no separate authorisation. Reports say existing non-bank PAs had to apply by 31 Dec 2025. — [Outlook Business](https://www.outlookbusiness.com/news/rbi-issues-new-master-directions-for-payment-aggregators-rules-take-effect-immediately); [Goodreturns](https://www.goodreturns.in/news/rbi-unveils-new-payment-aggregator-guidelines-rs-25-cr-net-worth-mandate-cross-border-limits-mor-1456997.html); [Mondaq](https://www.mondaq.com/india/financial-services/1726232/rbi-master-directions-2025-compliance-and-operational-challenges-for-payment-aggregators)
- Google Play India: only apps whose licence was submitted and that appear on RBI's list of "Digital lending apps (DLAs) deployed by Regulated Entities" may publish personal-loan apps. Facilitator platforms must declare that role and name all partner NBFCs and banks in the app description. — [Google Play Financial Services policy](https://support.google.com/googleplay/android-developer/answer/9876821)

### Inferences

- **Balance and transaction display from SMS or email:** allowed. It is the user's own data, processed for them. The DPDP Act is the main regime here, not RBI.
- **Pulling bank data through APIs:** the RBI-sanctioned route is the Account Aggregator (NBFC-AA) framework. Aaj would join as a Financial Information User, which normally has to be a regulated entity. A solo developer cannot be an FIU directly. Not verified this session.
- **Loan offers or referrals:** avoid until there is a company and a written LSP agreement with an RBI-regulated lender. Doing it also triggers the Play loan-app declaration and RBI DLA listing.
- **Bill pay:** do not hold or route funds. Integrate a licensed partner: a BBPS Operating Unit, a UPI app intent or deep link, or a licensed PA checkout. The partner is the regulated entity, and Aaj only redirects.
- **Payment data localisation:** RBI's 2018 storage-of-payment-system-data circular binds payment system operators, not a tracker app. Using Supabase in an Indian region (ap-south-1 Mumbai) is still prudent. Not verified this session.

### Gaps

- I did not fetch the RBI 2018 data-localisation circular or its FAQs to confirm that it does not apply to non-PSO apps.
- I did not verify Account Aggregator FIU eligibility or the BBPS Agent Institution requirements.
- I did not find any RBI rule specific to "balance display" apps.

---

## 3. IRDAI: recommending or selling insurance

### Takeaway

Comparing or selling insurance for a fee, lead generation included, needs IRDAI registration. The options are an Insurance Web Aggregator, a corporate agent, or a broker. The governing instrument is still the IRDAI (Insurance Web Aggregators) Regulations, 2017. The 2024 Bima Sugam marketplace regulations are a separate framework. Generic education ("buy term cover of 10–15x income") does not sell or solicit anything and is lower risk.

### Cited Findings

- The IRDAI (Insurance Web Aggregators) Regulations, 2017 took effect in April 2017 to supervise web aggregators as insurance intermediaries. A government-hosted copy is dated Nov 2024. IRDAI still enforced them in a Sep 2024 order (Reg 30(b)). — [Policyholder.gov.in](https://policyholder.gov.in/web/guest/distribution-development/web-aggregators); [DFS-hosted regulation PDF](<https://financialservices.gov.in/beta/sites/default/files/2024-11/IRDAI%20(Insurance%20Web%20Aggregators)%20Regulations,%202017.pdf>)
- No web aggregator may operate without a valid Certificate of Registration. Application is on Form A. A minimum capital of ₹25 lakh is cited by a consultancy page only, so it is unverified. — [ClearTax](https://cleartax.in/s/insurance-web-aggregator-license); [Kanakkupillai](https://www.kanakkupillai.com/learn/everything-you-must-know-about-insurance-web-aggregator-license/)
- IRDAI issued the Bima Sugam – Insurance Electronic Marketplace Regulations, 2024 on 20 Mar 2024. They are a separate marketplace framework. — [BQ Prime](https://www.bqprime.com/business/irdai-issues-final-regulations-for-bima-sugam-one-stop-insurance-marketplace)

### Inferences

- **Allowed:** tracking the user's own policies and premiums, renewal reminders, and generic coverage-gap education with no product names and no referral fee.
- **Needs a licence or partner:**
  - recommending a specific insurer's plan;
  - showing quotes;
  - earning referral or lead fees from insurers.
    Work as a referral partner of a registered aggregator or broker, and confirm the partner is allowed to pay for leads.

### Gaps

- I did not verify any 2024–2026 amendments to the web aggregator regulations or their merger into a consolidated intermediaries regulation, or the current capital requirements.
- I did not check IRDAI's position on unregistered "lead generation" websites.

---

## 4. DPDP Act 2023 and DPDP Rules 2025

### Takeaway

The DPDP Rules were notified on 13/14 Nov 2025 and come in by phases:

- Board provisions: immediately;
- Consent Manager registration: about Nov 2026;
- core fiduciary duties (notice, security, breach reporting, rights, children, SDF): 18 months later, about 13 May 2027.

Aaj processes high-sensitivity financial data, so it is a Data Fiduciary. It should build consent notices, purpose limitation, security safeguards, breach notification (to the Board without delay, and a detailed report within 72 hours), erasure, grievance handling and verifiable parental consent for under-18s before mid-2027. Ideally it should have them at Play launch, since Play and Gmail policies demand much of the same already.

### Cited Findings

- **Notification date:** MeitY notified the Rules on 13 Nov 2025; publication in the Gazette is reported as 14 Nov 2025. PIB uses 14 Nov.
- **Phasing:** Rules 1, 2 and 17–21 (Board) in force immediately. Rule 4 (Consent Managers) one year later. Rules 3, 5–16, 22 and 23 eighteen months later. JSA gives that date as 13 May 2027.

  — [YourStory](https://yourstory.com/2025/11/digital-personal-data-protection-dpdp-rules-2025-rollout-over-18-months); [Storyboard18](https://www.storyboard18.com/digital/breaking-govt-notifies-final-dpdp-rules-sets-staggered-rollout-with-key-obligations-for-data-fiduciaries-84201.htm); [JSA Prism Nov 2025](https://www.jsalaw.com/?p=55573); [PIB doc](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf)
  - Conflict: SCC Online says Rule 4 starts "on a later date to be notified", not a fixed one year. — [SCC Online](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/)

- **Rule 3, notice:** the notice must describe the personal data, the purpose, the fiduciary's contact details, and how to withdraw consent, raise a grievance and exercise rights. — [SCC Online](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/)
- **Rule 6, security:** encryption, tokenisation, access controls, logging and audits, and backup and recovery. Logs must be kept at least 1 year. SCC Online places the one-year log figure under Rule 8; sources differ on which rule. — [SCC Online](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/)
- **Rule 7, breach:**
  - notify affected Data Principals "without delay";
  - notify the Board without delay, then send a detailed report within 72 hours, extendable by the Board on written request;
  - the report covers the description, timeline, impact, mitigation, who was responsible, and proof that users were notified.
    — [Matters.ai](https://www.matters.ai/article/dpdp-breach-notification); [Protiviti flash](https://www.protiviti.com/sites/default/files/2025-11/flash_compliance_update_dpdp_rules-2025.pdf); [Mondaq closer look](https://www.mondaq.com/india/data-protection/1706890/a-closer-look-at-the-dpdp-rules-2025)
  - Caveat: these are secondary sources. I could not read the Gazette text.
- **Rule 8 / Third Schedule, retention:**
  - large e-commerce (2 crore+ users), gaming and social-media intermediaries must erase data after 3 years of inactivity;
  - users get 48 hours' warning before erasure;
  - personal-finance apps are not a listed class, so the general purpose-limitation rule applies to them.
    — [SCC Online](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/); [search summary of Mondaq/iPleaders](https://blog.ipleaders.in/dpdp-rules-2025-operational-compliance-guide-for-indian-businesses/)
- **Rule 10, children:** verifiable consent from a parent or guardian, using reliable identity and age verification (DigiLocker or other government platforms allowed). Under the Act, a "child" is anyone under 18. — [SCC Online](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/)
- **Rule 13, Significant Data Fiduciaries:** an annual DPIA, an independent audit, checks that algorithms cause no harm, and restrictions on transferring specified data and logs out of India. — [SCC Online](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/)
- **Penalties (Act Schedule):**
  - failure of the security-safeguards duty (s.8(5)): up to ₹250 crore;
  - failure to notify a breach: up to ₹200 crore.
    — [Konfirmity](https://www.konfirmity.com/blog/dpdp-penalties); [search summary](https://www.matters.ai/article/dpdp-breach-notification)
- **Consent Managers** must be India-based and register under Rule 4. — [YourStory](https://yourstory.com/2025/11/digital-personal-data-protection-dpdp-rules-2025-rollout-over-18-months)

### Inferences: minimum DPDP build list for a solo developer, done before Play launch and no later than May 2027

1. A standalone, itemised consent notice at onboarding, in English and ideally Hindi. List each data source separately (SMS, notifications, Gmail, Telegram) with its purpose, and give a one-tap withdrawal.
2. Separate consents per source and purpose. Use no data for ads or credit scoring.
3. Data minimisation:
   - parse only transactional SMS and email, on-device where possible;
   - drop raw message bodies after extraction;
   - store only the amount, merchant, date and account suffix.
4. Security: Supabase row-level security, encryption at rest, access logging, and logs kept at least 1 year.
5. A breach runbook: notify affected users and the Board without delay, and send a detailed Board report within 72 hours.
6. Rights handling: in-app export and delete-account, plus a published grievance contact with a response SLA.
7. A retention policy: delete or anonymise inactive accounts after a stated period, with 48 hours' warning.
8. An 18+ age gate, or a parental-consent flow. An 18+ gate is simplest for a finance app.
9. SDF status is unlikely for a solo app. The government designates SDFs based on volume, sensitivity and risk; no fixed numeric threshold was found.

### Gaps

- I could not read the official Gazette text: the PDF did not parse and the JSA PDF returned 403. The 72-hour figure and the rule-by-rule phasing rest on law-firm and secondary summaries.
- The Act's statutory 90-day response period for rights requests was not confirmed in this session.
- No numeric SDF threshold appears in any source; designation is left to the government.
- I did not confirm the full penalty schedule beyond the ₹250 crore and ₹200 crore bands. From memory, and unverified: children's duties up to ₹200 crore, SDF duties up to ₹150 crore, residual up to ₹50 crore.

---

## 5. Google Play: Financial Services, SMS and Call Log, notification listener, Data safety; Gmail API verification and CASA

### Takeaway

Play explicitly lists "SMS-based money management (apps that track and manage budget)" as a permitted exception for READ_SMS and RECEIVE_SMS without being the default SMS handler. It still needs a Restricted Permission Declaration and approval, and is granted only when SMS access is core and no alternative exists. Budgeting apps such as Bluecoins have been refused in the past.

Separately:

- any app with financial features must complete the Financial features declaration;
- loan features bring India-specific RBI DLA listing.

For Gmail, gmail.readonly is a restricted scope. Production use needs OAuth verification plus a CASA security assessment, renewed every 12 months, whenever data reaches a server. The Limited Use rules ban ads, data sales, credit or lending uses, and training models across users.

### Cited Findings

- **Play SMS and Call Log exceptions table:**
  - "SMS-based money management: apps that track and manage budget" (READ_SMS, RECEIVE_SMS, RECEIVE_MMS, RECEIVE_WAP_PUSH);
  - "SMS-based financial transactions: UPI, verifications for financial transactions" (adds SEND_SMS);
  - exceptions apply to non-default handlers, "subject to Google Play review and approval", where "there's currently no alternative method";
  - "personal loans or budgeting apps may not exfiltrate or share non-financial or personal SMS history of a user."
    — [Play Console Help: Use of SMS or Call Log permission groups](https://support.google.com/googleplay/android-developer/answer/10208820)
- **Rejections in practice:** Bluecoins was refused the exception because it was not the default SMS handler and SMS was not judged core, and it removed the permission. A 2020s Indian personal-finance developer reports a similar rejection; this is an anecdote. — [Bluecoins blog](https://bluecoinsapp.com/?p=9286); [dev.to post](https://dev.to/zeta_byte/ive-been-working-on-a-personal-finance-app-called-finvantage-and-i-recently-hit-a-roadblock-4mjh)
- **Play Financial Services policy:**
  - "Any app that contains any financial features must complete the Financial features declaration form within Play Console";
  - personal-loan apps, including lead generators, need category "Finance" and APR and tenure disclosures;
  - full repayment in 60 days or less is banned;
  - no access to contacts, photos or precise location;
  - India: RBI DLA list membership and disclosure of partner NBFCs and banks.
    — [Play Console Help: Financial Services](https://support.google.com/googleplay/android-developer/answer/9876821)
- **Google restricted-scope verification:**
  - apps that use restricted scopes and can access the data "from or through a third-party server must go through a security assessment" (CASA, by Google-empanelled assessors);
  - reassessment "at least every 12 months after your assessor's Letter of Assessment (LOA) approval date";
  - the process "can potentially take several weeks";
  - exemptions: personal use by a few people known to you, apps in Testing status with listed test users, and internal Workspace apps;
  - there is no on-device exemption and no "under 100 users" exemption on the page.
    — [Google OAuth restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
- **Workspace API User Data Policy (Limited Use):**
  - use only for the approved user-facing feature;
  - no transfer or sale to ad platforms or data brokers;
  - no ads or retargeting;
  - no "determin[ing] credit-worthiness or for lending purposes";
  - no human reading without explicit consent, except security or legal needs;
  - no training of AI or ML models "beyond that specific user";
  - CASA required for restricted scopes.
    — [Google Workspace API User Data and Developer Policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)
- **CASA cost** (no official price was found):
  - a Google Groups post cites a TAC Security discounted Tier 2 rate of about US$540 per year;
  - other labs quoted more than $1k;
  - one founder estimated about $5k per year.
    — [Google Groups](https://groups.google.com/g/google-apps-script-community/c/wlibwqM0hlg); [Latenode community](https://community.latenode.com/t/is-casa-tier-2-assessment-necessary-for-all-gmail-api-apps-options-for-indie-developers/22861); [MailMate list, Apr 2025](https://lists.freron.com/mailmate/2025-April/018278.html)
  - An open question on Google's forum asks whether on-device processing, with only derived data reaching the server, avoids CASA. It went unanswered. — [discuss.google.dev](https://discuss.google.dev/t/gmail-restricted-scope-is-the-casa-assessment-required-when-mail-is-processed-on-device-and-only-a-derived-subscription-list-reaches-our-server/398372)

### Inferences

- **Notification listener as the main route.** It avoids the SMS restricted-permission declaration, since bank SMS and UPI app notifications show up as notifications. Play still expects clear, prominent disclosure and accurate Data safety answers. This is likely the most approvable path; READ_SMS is a back-fill that needs a declaration.
- **Sideloaded APK.** Play policy does not apply, but DPDP does. Android's restricted-settings block on sideloaded apps getting notification-listener or accessibility access is a UX hurdle, not a legal one. This is from knowledge and was not verified.
- **Avoid AccessibilityService for transaction capture.** Play restricts accessibility to apps that help users with disabilities or declared uses. Not verified this session.
- **Gmail cost path:**
  - stay in Testing mode (up to 100 test users, from knowledge) for beta;
  - before public launch, budget for CASA Tier 2 (about $540 to several thousand dollars per year) plus several weeks;
  - or process email on-device only and confirm with Google whether that avoids CASA;
  - or offer "forward bank alerts to a custom inbound address" as a non-OAuth alternative.
- **Limited Use bars** using Gmail-derived data for loan offers or credit scoring, which conflicts with any lending monetisation. Keep the two separate.
- **Data safety form:** declare financial info (purchase history), messages (SMS and emails), app activity, encryption in transit, and the deletion mechanism. It must match the privacy policy.

### Gaps

- I did not fetch the Play policy pages for notification listener, accessibility, or "Permissions and APIs that Access Sensitive Information", nor the Data safety help page.
- The test-user cap for unverified apps (100, from knowledge) was not confirmed; the fetched page gives no number.
- I found no official CASA price list.
- Current approval rates for the "SMS-based money management" exception in 2025–2026 are unknown.

---

## 6. Telegram bot terms for financial data

### Takeaway

Telegram's Bot Platform Developer Terms require:

- a findable privacy policy;
- collection of only what is essential;
- encryption at rest with keys stored separately;
- breach notification;
- deletion when data is no longer needed or on request;
- explicit, revocable consent for data users submit.

They ban building datasets or training AI or ML models on user data. Telegram chats with bots are not end-to-end encrypted, so financial data sent to a bot passes through Telegram's servers.

### Cited Findings

- **Privacy policy:** TPAs (bots and Mini Apps) must have an easy-to-find privacy policy explaining what is stored, how and why. Without one, Telegram's Standard Privacy Policy for Bots applies and the developer remains responsible for it. A custom policy is registered via @BotFather.
- **Data use:** only essential data may be collected. Building large datasets or training ML or AI models is prohibited. Data users voluntarily submit may be used with a clearly stated purpose and explicit, revocable consent.
- **Security and retention:** data must be encrypted at rest and kept apart from the keys. Breach notification is required. Data must be deleted when no longer needed, on user or Telegram request, or when the bot shuts down.
- **Enforcement:** violators can be removed and face legal action.

— [Telegram Bot Platform Developer Terms of Service](https://telegram.org/tos/bot-developers)

### Inferences

- **Allowed:** logging expenses through the bot, with the bot's privacy policy registered in BotFather and linked to Aaj's main DPDP notice.
- Do not use bot chat logs to train shared AI models.
- Avoid sending full account numbers or balances in messages; mask them.

### Gaps

- I did not confirm the effective date or version of the Telegram developer terms.
- I did not check Telegram's privacy policy for the Bot API (cloud chats are not E2E; this is from knowledge).

---

## 7. GST and payment gateways for indie subscriptions

### Takeaway

An Indian-resident individual supplying services, including app subscriptions, normally has to register for GST once aggregate turnover passes ₹20 lakh a year (₹10 lakh in special-category states). Voluntary registration is possible earlier. Sources conflict on whether OIDAR supplies from India need registration regardless of turnover, so get a CA's confirmation. Foreign suppliers of OIDAR services to Indian consumers must register with no threshold, at 18%.

### Cited Findings

- **Threshold:** the general services registration threshold is ₹20 lakh (₹10 lakh for special-category states). Voluntary registration is available under s.25(3) of the CGST Act. — [Bilimoria Mehta](https://www.bilimoriamehta.in/blogs/gst-registration-applicability-an-overview); [TaxAdda](https://taxadda.com/gst-on-freelancers/)
- **OIDAR from India:** "general rules of registration will apply". Conflict: some guides say Indian OIDAR providers must register "irrespective of turnover". — [India Briefing](https://www.india-briefing.com/news/oidar-compliance-india-gst-registration-ntor-gstr5a-digital-tax-43951.html/); [ClearTax OIDAR](https://cleartax.in/s/oidar-gst-registration)
- **Foreign suppliers:** foreign OIDAR suppliers to non-taxable online recipients in India must register with no threshold; the rate is 18%. — [Fonoa](https://www.fonoa.com/resources/country-tax-guides/india/tax-on-digital-services)

### Inferences

- **Through Google Play Billing:** Google is treated as the supplier or collects GST under the marketplace model, which simplifies GST. Confirm with a CA.
- **Direct web subscriptions:** Razorpay, Cashfree and PayU onboard individuals and sole proprietors with PAN and a bank account. GST registration is generally not required to onboard below the threshold. This is from knowledge and was not verified this session.
- **Income tax:** app income is business or professional income on the developer's ITR. The presumptive scheme under s.44ADA may or may not apply, since software development is not always a specified profession. Ask a CA.

### Gaps

- I did not verify payment-gateway KYC requirements for individuals (Razorpay, Cashfree), or whether any require GSTIN.
- I did not verify how GST applies to Play Billing in-app subscriptions in India.
- The OIDAR "from India" registration conflict is unresolved.
- I did not research income-tax treatment.

---

## Summary matrix (for the report writer)

| Feature                                                   | Status                                       | Gate before launch                                                                                                  |
| --------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Expense capture from notifications (NotificationListener) | Allowed                                      | DPDP notice and consent; Play prominent disclosure and Data safety; minimise raw text                               |
| Expense capture from READ_SMS on Play                     | Allowed with approval                        | Restricted Permission Declaration under "SMS-based money management"; no exfiltration of non-financial SMS          |
| Gmail readonly capture                                    | Allowed with verification                    | OAuth restricted-scope verification plus CASA (annual) if data reaches a server; Limited Use; Testing mode for beta |
| Budget rules (50/30/20, EMI cap, emergency fund)          | Allowed                                      | Generic education framing and disclaimers                                                                           |
| Investment tracking (display only)                        | Allowed                                      | Read-only, no recommendations; AA route needs a regulated FIU partner                                               |
| Personalised asset allocation                             | Grey zone                                    | Counsel opinion, or frame as a user-driven calculator                                                               |
| Specific MF or stock suggestions, AI picks                | Needs SEBI IA/RA                             | Register or partner; AI disclosure duties apply to registrants                                                      |
| Tax tips (generic)                                        | Allowed                                      | Generic; no filing-on-behalf claims (not researched further)                                                        |
| Insurance recommendations or quotes or leads              | Needs IRDAI                                  | Web aggregator, broker or corporate agent registration, or a licensed partner                                       |
| Loan offers or referrals                                  | Needs RBI LSP contract plus Play loan policy | Written agreement with an RE, DLA listing, Play declaration, no contacts or photos                                  |
| Bill pay                                                  | Needs a licensed partner                     | No fund-holding; BBPS or PA partner (PA licence needs ₹15 crore)                                                    |
| Telegram bot                                              | Allowed                                      | Bot privacy policy, encryption at rest, no AI training on chats                                                     |
| Paid subscriptions                                        | Allowed                                      | GST at ₹20 lakh turnover (confirm OIDAR); PG KYC                                                                    |
| All features                                              | Needed                                       | DPDP core duties enforceable about 13 May 2027; breach report within 72 hours; 18+ gate or parental consent         |
