# Graph Report - Project_expense (2026-11-01)

## Corpus Check

- 260 files · ~225,065 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 14 file(s) not represented in the graph (top: (none) 10, .example 1, .xml 1)

## Summary

- 2476 nodes · 6656 edges · 108 communities (96 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 149 edges (avg confidence: 0.88)
- Token cost: 623,984 input · 0 output

## Community Hubs (Navigation)

- Web Dashboard UI
- Account & Gmail API Routes
- Mobile Account Sheets
- Subscriptions & Insights API
- Mobile App Shell
- Cards App UI
- Android Notification Capture (Kotlin)
- Telegram Bot
- Add Expense Flow
- Morning/Evening Briefs & Notify
- Bills API
- Cards UX Design Brief
- Expense Logging & Parser
- Card Recommender Build Plan
- Bills Tab & Money Cards
- Indian Card Recommender Competitors
- BBPS Integration
- Card Recommender Regulation
- Bill Detection
- Mobile Dependencies
- Auth & Gmail OAuth
- Goals & Plan API
- Expo App Config
- Goals Card & Money Rules
- Bank SMS Parsing
- Daily Budget Card & Setup
- Web Dependencies
- Transfers & Data Export
- Backup Workflow
- Accounts API
- Build-vs-Partner Decision
- Monzy (Warikoo) Analysis
- HDFC/ICICI/AU Card Rules
- Tech & Monetisation Risks
- Finance Roadmap Phases
- Card Rewards Engine
- Co-brand & Smaller Bank Cards
- Email Inbound & OTP
- SMS/Play Policy & Regulation
- LLM Calls & Redaction
- Data Access (AA, BBPS, Gmail)
- Axis/BOB/IndusInd/Kotak Cards
- Capture Sync Client
- Income & Digest
- Finance App Competitors
- Card Catalog Data
- Deploy Workflow
- AI Key Rotation & Secrets
- Cards API Service
- Amex & Premium Cards
- Detected Bills Model
- Web TS Config
- Play Data Safety
- Telegram Tracker Overview
- Original Project Plan
- Transaction Ingest & Balances
- Multiuser & Auth Schema
- SBI Card Rules
- Brand Assets & Icons
- Play Store Listing
- App-First Roadmap Spec
- Cards i18n Strings
- Capture Native Module API
- Axis Premium Cards
- IDFC FIRST Cards
- Card Detection from SMS
- Receipt Parsing
- Database Backups
- Card Catalog Builder Script
- Account & Transfer Sheets
- Recommender Valuation Basics
- Card Rule JSON Conventions
- Merchant Cleaning
- Receipt Items Schema
- Reward Cap Allocation
- User Identity & Link Codes
- Capture Setup Card
- Ledger Schema
- Firebase Push Setup
- Web Scripts
- Setu Check Script
- Finance Roadmap Strategy
- Mailer
- Usage Quotas
- Budgets & Income Schema
- Bills Schema
- Mobile Build & Release
- US Card Optimizers
- Play Review Login
- Push Schema
- Mobile Dev Dependencies
- Mobile Scripts
- Mobile TS Config
- Web Root Layout
- Daily Budget Schema
- Goals Schema
- BBPS Billers Schema
- Bank Messages Schema
- Mobile Agent Docs
- Subscriptions Schema
- Set Commands Script
- Vercel Crons

## God Nodes (most connected - your core abstractions)

1. `createServiceClient()` - 120 edges
2. `Text` - 97 edges
3. `useSettings()` - 90 edges
4. `authedUser()` - 84 edges
5. `Indian credit card reward rules dataset (card_rules.md)` - 78 edges
6. `localDate()` - 61 edges
7. `Report: Real spending data beats Monzy's six questions` - 54 edges
8. `Aaj Cards UI/UX design brief` - 51 edges
9. `formatINR()` - 49 edges
10. `AppInner()` - 46 edges

## Surprising Connections (you probably didn't know these)

- `FINQY Test My Card` --semantically_similar_to--> `Top-3 next-card ranking by gain over current best card` [INFERRED] [semantically similar]
  research_notes/Monzy and Indian card recommenders/competitors.md → reports/Monzy and Indian card recommenders.md
- `One-time Firebase/FCM push setup` --semantically_similar_to--> `Firebase setup left to user` [INFERRED] [semantically similar]
  README.md → docs/superpowers/specs/2026-10-24-app-first-roadmap-design.md
- `EAS store builds` --semantically_similar_to--> `EAS build and submit` [INFERRED] [semantically similar]
  mobile/README.md → docs/play-store/release-checklist.md
- `On-device parsing pipeline (regex, Gemini Nano, masked fallback)` --semantically_similar_to--> `Recommended on-device parsing pipeline` [INFERRED] [semantically similar]
  reports/Aaj complete finance roadmap.md → research_notes/Aaj complete finance roadmap/tech_monetisation.md
- `Monzy (monzy.co)` --conceptually_related_to--> `Monzy` [INFERRED]
  reports/Monzy and Indian card recommenders.md → research_notes/Monzy and Indian card recommenders/economics_and_build.md

## Import Cycles

- None detected.

## Hyperedges (group relationships)

- **HDFC premium cards sharing SmartBuy accelerated rewards and voucher cap** — research_notes_aaj_cards_app_design_card_rules_card_hdfc_infinia, research_notes_aaj_cards_app_design_card_rules_card_hdfc_diners_black_metal, research_notes_aaj_cards_app_design_card_rules_card_hdfc_regalia_gold, research_notes_aaj_cards_app_design_card_rules_hdfc_smartbuy, research_notes_aaj_cards_app_design_card_rules_dev_hdfc_smartbuy_voucher_cap_jul_2026 [EXTRACTED 1.00]
- **IDFC FIRST LTF cards affected by 2026 earn, cap and forex changes** — research_notes_aaj_cards_app_design_card_rules_card_idfc_first_select, research_notes_aaj_cards_app_design_card_rules_card_idfc_first_wealth, research_notes_aaj_cards_app_design_card_rules_card_idfc_first_millennia, research_notes_aaj_cards_app_design_card_rules_credit_limit_reward_cap, research_notes_aaj_cards_app_design_card_rules_dev_idfc_earn_basis_jan_2026, research_notes_aaj_cards_app_design_card_rules_dev_idfc_zero_forex_sep_2026 [EXTRACTED 1.00]
- **Reward valuation model: point values, best vs cash redemption, caps** — research_notes_aaj_cards_app_design_card_rules_point_value_table, research_notes_aaj_cards_app_design_card_rules_best_common_redemption_valuation, research_notes_aaj_cards_app_design_card_rules_cash_statement_valuation, research_notes_aaj_cards_app_design_card_rules_capmonthly [INFERRED 0.85]
- **Telegram message to dashboard pipeline** — readme_telegram_webhook, readme_rules_parser, readme_llm_fallback, readme_self_improving_keywords, readme_dashboard [EXTRACTED 1.00]
- **Notice stored in inbox then pushed via Expo/FCM** — docs_superpowers_specs_2026_10_24_app_first_roadmap_design_notify_entry_point, docs_superpowers_specs_2026_10_24_app_first_roadmap_design_notifications_inbox, docs_superpowers_specs_2026_10_24_app_first_roadmap_design_push_tokens_table, docs_superpowers_specs_2026_10_24_app_first_roadmap_design_expo_push_fcm, docs_superpowers_specs_2026_10_24_app_first_roadmap_design_notice_kinds_channels [EXTRACTED 1.00]
- **Play Store release preparation** — docs_play_store_data_safety, docs_play_store_listing, docs_play_store_release_checklist_twelve_tester_rule, docs_play_store_release_checklist_build_and_upload, docs_play_store_release_checklist_testing_tracks [EXTRACTED 1.00]
- **Free user-initiated data access stack (Gmail forwarding, CAS parsing, UPI intent, on-device SMS parsing)** — research_notes_aaj_complete_finance_roadmap_data_access_gmail_forwarding, research_notes_aaj_complete_finance_roadmap_data_access_casparser, research_notes_aaj_complete_finance_roadmap_data_access_upi_intent, research_notes_aaj_complete_finance_roadmap_tech_monetisation_parsing_pipeline, reports_aaj_complete_finance_roadmap_user_supplied_documents_strategy [EXTRACTED 1.00]
- **Regulated gates Aaj must not cross without a licence (SEBI IA, RBI LSP, RBI PA, IRDAI)** — research_notes_aaj_complete_finance_roadmap_regulation_sebi_ia_regulations, research_notes_aaj_complete_finance_roadmap_regulation_rbi_digital_lending_directions_2025, research_notes_aaj_complete_finance_roadmap_regulation_payment_aggregator_directions_2025, research_notes_aaj_complete_finance_roadmap_regulation_irdai_web_aggregators, reports_aaj_complete_finance_roadmap_track_and_teach_boundary [EXTRACTED 1.00]
- **Free-tier risks and their free fixes** — research_notes_aaj_complete_finance_roadmap_tech_monetisation_vercel_commercial_clause, research_notes_aaj_complete_finance_roadmap_tech_monetisation_supabase_free, research_notes_aaj_complete_finance_roadmap_tech_monetisation_eas_update_cap, research_notes_aaj_complete_finance_roadmap_tech_monetisation_gemini_free_tier_terms, reports_aaj_complete_finance_roadmap_free_tier_risks [EXTRACTED 1.00]
- **Spend-based recommendation pipeline (card rules, merchant mapping and point values feed the net value formula for missed-rewards and next-card ranking)** — reports_monzy_and_indian_card_recommenders_cards_table, reports_monzy_and_indian_card_recommenders_merchant_category_mapping, reports_monzy_and_indian_card_recommenders_point_value_table, reports_monzy_and_indian_card_recommenders_net_value_formula, reports_monzy_and_indian_card_recommenders_missed_rewards_report, reports_monzy_and_indian_card_recommenders_next_card_ranking [EXTRACTED 1.00]
- **RBI 2027 sales-practice regime for paid referrers** — research_notes_monzy_and_indian_card_recommenders_regulation_dsa_dma_definition, research_notes_monzy_and_indian_card_recommenders_regulation_dsa_code_of_conduct, research_notes_monzy_and_indian_card_recommenders_regulation_default_no_consent, research_notes_monzy_and_indian_card_recommenders_regulation_eleven_dark_patterns, research_notes_monzy_and_indian_card_recommenders_regulation_mis_selling_refund [EXTRACTED 1.00]
- **Indian subscription/per-transaction reward optimisers** — research_notes_monzy_and_indian_card_recommenders_competitors_savesage, research_notes_monzy_and_indian_card_recommenders_competitors_pointsfly, research_notes_monzy_and_indian_card_recommenders_competitors_credeem, research_notes_monzy_and_indian_card_recommenders_competitors_ccreward, research_notes_monzy_and_indian_card_recommenders_competitors_cusp [EXTRACTED 1.00]
- **Aaj app icon set (store, mobile, Android adaptive, web/PWA)** — docs_play_store_assets_icon_512_play_store_icon, mobile_assets_icon_app_icon, mobile_assets_android_icon_background_adaptive_icon_background, mobile_assets_android_icon_foreground_adaptive_icon_foreground, mobile_assets_android_icon_monochrome_adaptive_icon_monochrome, mobile_assets_favicon_favicon, mobile_assets_notification_icon_notification_icon, mobile_assets_splash_icon_splash_icon, public_icon_192_pwa_icon_192, public_icon_512_pwa_icon_512 [INFERRED 0.85]

## Communities (108 total, 12 thin omitted)

### Community 0 - "Web Dashboard UI"

Cohesion: 0.05
Nodes (70): recharts, Home(), App(), RANGE_LABELS, RangeKey, rangeStartOf(), Scope, shiftDate() (+62 more)

### Community 1 - "Account & Gmail API Routes"

Cohesion: 0.06
Nodes (62): nextConfig, next, DELETE(), dynamic, EXPORT_TABLES, GET(), maxDuration, OWNED_TABLES (+54 more)

### Community 2 - "Mobile Account Sheets"

Cohesion: 0.07
Nodes (57): Props, styles, KINDS, Props, styles, Props, DayPick, EditExpenseSheet() (+49 more)

### Community 3 - "Subscriptions & Insights API"

Cohesion: 0.06
Nodes (60): dynamic, fail(), GET(), load(), messageOf(), PATCH(), addDays(), Anomaly (+52 more)

### Community 4 - "Mobile App Shell"

Cohesion: 0.06
Nodes (60): App(), AppInner(), longDate(), MONTH_NAMES, Scope, shiftDate(), styles, Tab (+52 more)

### Community 5 - "Cards App UI"

Cohesion: 0.11
Nodes (65): Accent, BANDS, CalcScreen(), CardDetail(), CardsApp(), ExplainSheet(), Explore(), feeLine() (+57 more)

### Community 6 - "Android Notification Capture (Kotlin)"

Cohesion: 0.06
Nodes (9): BankNotificationListenerService, CaptureStore, CaptureUploadWorker, Outcome, Done, Rejected, SignedOut, TryLater (+1 more)

### Community 7 - "Telegram Bot"

Cohesion: 0.10
Nodes (61): answerSubscription(), confirmText(), dailySuffix(), dynamic, escapeHtml(), flipLast(), fmtINR(), handleBankMessage() (+53 more)

### Community 8 - "Add Expense Flow"

Cohesion: 0.05
Nodes (53): AddExpenseSheet(), Day, Mode, styles, Success, yesterdayOf(), BillSheet(), KIND_CATEGORY (+45 more)

### Community 9 - "Morning/Evening Briefs & Notify"

Cohesion: 0.07
Nodes (49): dynamic, GET(), maxDuration, dynamic, GET(), maxDuration, dynamic, fail() (+41 more)

### Community 10 - "Bills API"

Cohesion: 0.08
Nodes (46): dynamic, maxDuration, POST(), DELETE(), dynamic, fail(), GET(), parseBill() (+38 more)

### Community 11 - "Cards UX Design Brief"

Cohesion: 0.07
Nodes (36): Aaj Cards UI/UX design brief, C1 My cards (wallet), C3 Which card is this? matcher, C4 Missed rewards report, C6 Explain this number sheet, C7 Explore: top 3 next cards, C8 Card offer detail (Why this card), C9 Leaving Aaj interstitial (+28 more)

### Community 12 - "Expense Logging & Parser"

Cohesion: 0.12
Nodes (42): POST(), dynamic, maxDuration, POST(), alertsFor(), DELETE(), dynamic, maxDuration (+34 more)

### Community 13 - "Card Recommender Build Plan"

Cohesion: 0.08
Nodes (32): Card rule devaluations (April/July clusters), CardAdvisor, Supabase cards table (JSON rules, verified_at, source URL), Net value / Score formula per card, SaveSage, CardAdvisor, CardTrail, Axis Atlas revamp and transfer partner changes (+24 more)

### Community 14 - "Bills Tab & Money Cards"

Cohesion: 0.10
Nodes (39): AccountsCard(), BillsTab(), KIND_CATEGORY, KIND_ICON, KINDS, MarkPaidSheet(), Props, styles (+31 more)

### Community 15 - "Indian Card Recommender Competitors"

Cohesion: 0.07
Nodes (42): BankBazaar, CardInsider, CashKaro group (BankKaro, EarnKaro, Great.Cards), CRED, EarnKaro, Paisabazaar (PB Fintech), PointsFly, Scapia (+34 more)

### Community 16 - "BBPS Integration"

Cohesion: 0.09
Nodes (23): mock, ALNUM(), fromSpec(), MOCK_BILLERS, MockBbpsProvider, NUM(), mock, UTILITY_BILLERS (+15 more)

### Community 17 - "Card Recommender Regulation"

Cohesion: 0.09
Nodes (35): Account Aggregator framework, Credit bureau Specified User criteria, 18% GST and s.194H TDS on referral commission, Aaj (SMS-reading expense tracker), Account Aggregator framework (FIU must be regulated), Para 44: issuer liable for acts of agents, RBI penalty on American Express (Oct 2025), Card network choice circular (Mar 2024) (+27 more)

### Community 18 - "Bill Detection"

Cohesion: 0.10
Nodes (34): BILL_QUERY, BILL_SIGNALS, CLAUDE_SCHEMA, DATE_PATTERN, extractBill(), extractWithClaude(), extractWithGemini(), findDueDate() (+26 more)

### Community 19 - "Mobile Dependencies"

Cohesion: 0.08
Nodes (35): dependencies, expo@~57.0.31, expo-asset@~57.0.20, expo-audio@~57.0.5, expo-constants@~57.0.22, expo-font@~57.0.4, @expo-google-fonts/plus-jakarta-sans@^0.4.2, expo-image-picker@~57.0.20 (+27 more)

### Community 20 - "Auth & Gmail OAuth"

Cohesion: 0.10
Nodes (26): GET(), dynamic, GET(), page(), dynamic, GET(), COOKIE_NAME, secret() (+18 more)

### Community 21 - "Goals & Plan API"

Cohesion: 0.12
Nodes (31): DELETE(), dynamic, GET(), POST(), handleFixed(), archiveGoal(), cycleCredits(), getGoals() (+23 more)

### Community 22 - "Expo App Config"

Cohesion: 0.06
Nodes (33): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, blockedPermissions, package, predictiveBackGestureEnabled (+25 more)

### Community 23 - "Goals Card & Money Rules"

Cohesion: 0.13
Nodes (30): allEmiLine(), GoalsCard(), GoalSheet(), RuleAdvice(), styles, MoneySplitCard(), styles, CardHeader() (+22 more)

### Community 24 - "Bank SMS Parsing"

Cohesion: 0.09
Nodes (28): ACCOUNT_PATTERNS, ACCOUNT_WORD, AMOUNT_PATTERNS, BALANCE_PATTERNS, cardNamesOut(), carriesCode(), cleanCounterparty(), CREDITS (+20 more)

### Community 25 - "Daily Budget Card & Setup"

Cohesion: 0.14
Nodes (28): Field(), History(), Line(), MONTHS, PlanSheet(), PlanSummaryCard(), shortDate(), styles (+20 more)

### Community 26 - "Web Dependencies"

Cohesion: 0.08
Nodes (30): dependencies, @anthropic-ai/sdk@^0.117.1, next@^15.4.0, nodemailer@^9.1.1, react@^19.1.0, react-dom@^19.1.0, recharts@^3.1.0, @supabase/supabase-js@^2.49.0 (+22 more)

### Community 27 - "Transfers & Data Export"

Cohesion: 0.12
Nodes (24): dynamic, GET(), DELETE(), dynamic, fail(), GET(), POST(), loadBalanceSheet() (+16 more)

### Community 28 - "Backup Workflow"

Cohesion: 0.07
Nodes (29): runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group, BACKUP_PASSPHRASE, OUT_DIR (+21 more)

### Community 29 - "Accounts API"

Cohesion: 0.14
Nodes (24): DELETE(), dynamic, fail(), GET(), PATCH(), POST(), readAmount(), readDay() (+16 more)

### Community 30 - "Build-vs-Partner Decision"

Cohesion: 0.11
Nodes (20): Aaj (expense tracker), ASCI finance-influencer addendum (Apr 2025), CCPA dark-patterns advisory (Jun 2025), Affiliate commission economics (~Rs 1,500 per activated card), Credeem, Cuelinks, RBI Digital Lending Directions 2025, Report: Real spending data beats Monzy's six questions (+12 more)

### Community 31 - "Monzy (Warikoo) Analysis"

Cohesion: 0.14
Nodes (25): Ankur Warikoo, CheQ AU LED Credit Card, Monzy (monzy.co), Amarjeet Sarma (Chief Developer), Ankur Warikoo, Anmol Ratan Sachdeva (SEO and Data Lead), /api/start and /api/answer endpoints, /api/card-apply-urls endpoint (+17 more)

### Community 32 - "HDFC/ICICI/AU Card Rules"

Cohesion: 0.13
Nodes (29): AU Reward Points, AU Small Finance Bank, HDFC Bank, ICICI Bank, AU Altura, AU LIT, Axis ACE, HDFC Millennia (+21 more)

### Community 33 - "Tech & Monetisation Risks"

Cohesion: 0.13
Nodes (25): Store-build release path beyond EAS 1,000 MAU, Free-tier and policy risks to fix before new features, On-device parsing pipeline (regex, Gemini Nano, masked fallback), SEBI finfluencer circular (Oct 2024, Jan 2025 clarification), GST registration threshold (Rs 20 lakh) and OIDAR, Cloudflare Workers Free, Free-tier tech choices and monetisation for Aaj, EAS Update 1,000 MAU cap on Expo Free (+17 more)

### Community 34 - "Finance Roadmap Phases"

Cohesion: 0.11
Nodes (27): Ask your money with fixed typed tools and deterministic numbers, Replace mocked BBPS fetch with parsed bills plus upi://pay hand-off, Roadmap Next (3-9 months): earn the all-in-one-place claim, Roadmap Now (0-3 months): legal, safe and sticky, Sinking funds for Diwali, weddings, school fees and premiums, Weekly personalised review in briefs, Advance tax and ITR due dates, Candidate first-week aha moments (+19 more)

### Community 35 - "Card Rewards Engine"

Cohesion: 0.10
Nodes (24): Allocation, Assignment, CATEGORY_BUCKETS, Chance, daysBetween(), debtStress(), dedupe(), eligibility (+16 more)

### Community 36 - "Co-brand & Smaller Bank Cards"

Cohesion: 0.12
Nodes (25): Airtel Thanks app, CSB Bank (Jupiter), Federal Bank, HSBC, book1a.com card pages, Airtel Axis Bank, HSBC Live+, HSBC TravelOne (+17 more)

### Community 37 - "Email Inbound & OTP"

Cohesion: 0.18
Nodes (23): dynamic, POST(), secret(), verdictMessage(), displayNameOf(), isEmailShaped(), mailerConfigured(), checkCode() (+15 more)

### Community 38 - "SMS/Play Policy & Regulation"

Cohesion: 0.12
Nodes (22): Bluecoins SMS rejection precedent, NotificationListenerService fallback, Play SMS-based money management exception, Bima Sugam marketplace regulations 2024, RBI 2018 payment-data localisation circular, Regulatory and platform-policy constraints for Aaj, DPDP breach notification (72-hour Board report), Minimum DPDP build list for a solo developer (+14 more)

### Community 39 - "LLM Calls & Redaction"

Cohesion: 0.12
Nodes (21): apply, headers, callGemini(), CLAUDE_SCHEMA, DIRECTION_PROMPT, DIRECTION_SCHEMA, directionWithLLM(), GEMINI_SCHEMA (+13 more)

### Community 40 - "Data Access (AA, BBPS, Gmail)"

Cohesion: 0.14
Nodes (23): Gmail forward-to-inbound address, Standardised AA fee model from 1 Nov 2026, AA live FI types (EPF, PPF, bonds, G-Secs not live), Account Aggregator (AA) framework, BBPS / Bharat Connect, BBPS agent institution under a COU (Setu, Cashfree), Consolidated Account Statement (CAMS/KFintech/NSDL/CDSL), CASA Tier 2 security assessment (TAC Security $540-1,800/yr) (+15 more)

### Community 41 - "Axis/BOB/IndusInd/Kotak Cards"

Cohesion: 0.09
Nodes (24): Axis EDGE Miles, Bank of Baroda (BOBCARD), IndusInd Bank, Kotak Mahindra Bank, OneCard, BOB Eterna Reward Points, BOBCARD Eterna, CRED IndusInd RuPay (+16 more)

### Community 42 - "Capture Sync Client"

Cohesion: 0.15
Nodes (17): captureStatus(), CaptureSyncResult, connectCapture(), empty, keepForRetry(), readRetries(), syncCaptures(), Capture (+9 more)

### Community 43 - "Income & Digest"

Cohesion: 0.14
Nodes (17): @supabase/supabase-js, DELETE(), dynamic, POST(), composeMonthlyDigest(), fmtINR(), MONTH_NAMES, monthAdd() (+9 more)

### Community 44 - "Finance App Competitors"

Cohesion: 0.14
Nodes (21): AA consolidator attached to investing/credit business model, Amazon, axio (ex-Walnut, Amazon-owned), Cleo, Copilot Money, CRED Money, Competitor landscape for Aaj (Oct 2026), ET Money (+13 more)

### Community 45 - "Card Catalog Data"

Cohesion: 0.12
Nodes (17): BY_KEY, CATALOG, CATALOG_VERIFIED, CARDS, productByKey(), NextCard, Slot, amazonCard (+9 more)

### Community 46 - "Deploy Workflow"

Cohesion: 0.09
Nodes (21): concurrency, cancel-in-progress, group, env, runs-on, steps, VERCEL_ORG_ID, VERCEL_PROJECT_ID (+13 more)

### Community 47 - "AI Key Rotation & Secrets"

Cohesion: 0.18
Nodes (16): configuredKeys(), GeminiAttempt, isQuotaError(), KeyState, pickKey(), pool(), restKey(), states (+8 more)

### Community 48 - "Cards API Service"

Cohesion: 0.19
Nodes (20): dynamic, fail(), GET(), messageOf(), POST(), ScoreBand, STRESS_TEXT, applyCardAction() (+12 more)

### Community 49 - "Amex & Premium Cards"

Cohesion: 0.19
Nodes (18): Amex Membership Rewards, American Express, Amex Gold Charge Card, Amex Membership Rewards Credit Card, Amex Platinum Travel, HDFC Diners Club Black Metal, HDFC Infinia (Metal), IRCTC HDFC (RuPay) (+10 more)

### Community 50 - "Detected Bills Model"

Cohesion: 0.16
Nodes (16): DetectedBillDraft, DetectSource, BillKind, KIND_CATEGORY, DetectedBill, detectedNotice(), DetectSourceName, GmailAccount (+8 more)

### Community 51 - "Web TS Config"

Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 52 - "Play Data Safety"

Cohesion: 0.13
Nodes (14): Play Console data safety answers, Data safety form answers, Collected data types (email, purchase history, SMS notifications, push token), Financial features declaration (none of regulated), Gmail restricted scope / CASA Tier 2, Notification access (BIND_NOTIFICATION_LISTENER_SERVICE), Privacy policy and account deletion URLs, Prominent disclosure card (+6 more)

### Community 53 - "Telegram Tracker Overview"

Cohesion: 0.16
Nodes (16): Full description, Telegram Expense Tracker README, Correction commands (/undo, /category, /amount, /last), Daily budget (v14), Next.js realtime dashboard, Goals (v17), LLM fallback (Gemini / Claude), Morning brief and night report (+8 more)

### Community 54 - "Original Project Plan"

Cohesion: 0.13
Nodes (15): Personal Expense Tracker project plan, budget_alerts table (v3), categories table, expenses table, Feature matrix, Project goals (log in <5 s), MetroSaathi (portfolio reference), Scope / out of scope (no native app, no bank import) (+7 more)

### Community 55 - "Transaction Ingest & Balances"

Cohesion: 0.19
Nodes (15): BankTxn, matchAccountByHint(), applyReportedBalance(), captureDate(), fail(), findManualTwin(), ingestBankMessage(), IngestInput (+7 more)

### Community 56 - "Multiuser & Auth Schema"

Cohesion: 0.17
Nodes (14): auth_codes, auth_codes_email_idx, link_codes, usage_counters, users_email_idx, users_telegram_idx, user_api_keys, card_profiles (+6 more)

### Community 57 - "SBI Card Rules"

Cohesion: 0.23
Nodes (17): SBI Card, Business Today SimplyCLICK article, BPCL SBI Card OCTANE, SBI Card ELITE, SBI Card PRIME, SBI SimplyCLICK, SBI SimplySAVE, SBI BPCL Octane fuel cap conflict (+9 more)

### Community 58 - "Brand Assets & Icons"

Cohesion: 0.23
Nodes (14): Aaj app brand (tagline: Know what you can spend today.), Play Store feature graphic: Aaj logo + 'Know what you can spend today.', Aaj logo mark: rupee sign inside partial progress ring, Play Store 512px app icon (white rupee ring on teal), Android adaptive icon background (solid teal), Brand colour: deep teal, Android adaptive icon foreground (white glyph on transparent; renders blank), Android themed/monochrome icon (white on transparent; renders blank) (+6 more)

### Community 59 - "Play Store Listing"

Cohesion: 0.15
Nodes (13): Play Store listing draft, App name Aaj (आज, today), Private by design, Screenshot captions, Short description, What's new (first release), Google Play release checklist, EAS upload service account (+5 more)

### Community 60 - "App-First Roadmap Spec"

Cohesion: 0.21
Nodes (7): App-first roadmap and push notifications spec, Roadmap goals, Notice kinds -> Android channels (daily, spend, alerts, digest), notify(supabase, userId, notice) single entry point, Order of work, push_tokens table, Push + in-app inbox (v15)

### Community 61 - "Cards i18n Strings"

Cohesion: 0.18
Nodes (10): CardsKey, cardsT(), en, hi, TABLES, Lang, Settings, SettingsContext (+2 more)

### Community 63 - "Axis Premium Cards"

Cohesion: 0.33
Nodes (11): Axis EDGE Reward Points, Axis Travel EDGE, Axis Bank, Axis Atlas, Axis Magnus, Axis Magnus for Burgundy, Axis MY Zone, Axis Neo (+3 more)

### Community 64 - "IDFC FIRST Cards"

Cohesion: 0.41
Nodes (12): IDFC FIRST Bank, IDFC FIRST Millennia, IDFC FIRST Power+ (HPCL), IDFC FIRST Select, IDFC FIRST Wealth, IDFC Wealth/Select structure after 18 Jun 2026, Rewards capped at credit limit per cycle (IDFC, from 18 Jun 2026), IDFC earn basis per Rs150 to per Rs200 (18 Jan 2026) (+4 more)

### Community 65 - "Card Detection from SMS"

Cohesion: 0.23
Nodes (11): bankOf(), BANKS, CardMessage, cardOf(), detectCards(), DetectedCard, isCreditCardMessage(), PRODUCT_HINTS (+3 more)

### Community 66 - "Receipt Parsing"

Cohesion: 0.35
Nodes (9): clean(), itemsTotal(), normaliseItem(), Receipt, ReceiptHeader, ReceiptItem, reconciles(), saveParsedReceipt() (+1 more)

### Community 67 - "Database Backups"

Cohesion: 0.20
Nodes (9): Deployment checklist, psql_verify(), backup.sh script, Database backups README, AES-256 gpg encryption, 30-day artifact, Nightly backup workflow (backup.yml, 02:00 IST), Repo secrets SUPABASE_DB_URL / BACKUP_PASSPHRASE, Restore procedure (session_replication_role = replica) (+1 more)

### Community 68 - "Card Catalog Builder Script"

Cohesion: 0.29
Nodes (5): buckets(), cash_ratio(), convert(), main(), num()

### Community 69 - "Account & Transfer Sheets"

Cohesion: 0.31
Nodes (11): AccountSheet(), archive(), save(), TransferSheet(), save(), archiveAccount(), authHeaders(), createAccount() (+3 more)

### Community 70 - "Recommender Valuation Basics"

Cohesion: 0.29
Nodes (8): Aaj card recommender, YES Bank, Business Standard Flipkart SBI launch article, Flipkart Axis Bank, Flipkart SBI Card, YES Klick, Indian credit card reward rules dataset (card_rules.md), Paisabazaar

### Community 71 - "Card Rule JSON Conventions"

Cohesion: 0.22
Nodes (11): Kiwi (YES/PNB/AU), capMonthly (reward value cap in Rs per month), Tata Neu Infinity HDFC, Tata Neu Plus HDFC, Kiwi RuPay, JSON field conventions (lounge 99=unlimited, capMonthly in Rs value, status values), Kiwi app UPI Scan & Pay, Kiwis (Kiwi rewards) (+3 more)

### Community 72 - "Merchant Cleaning"

Cohesion: 0.27
Nodes (8): cleanMerchant(), HANDLE_NOISE, MerchantRule, nameFromHandle(), NOISE, Normalised, normaliseMerchant(), rules

### Community 73 - "Receipt Items Schema"

Cohesion: 0.31
Nodes (9): receipt_items, receipt_items_expense_idx, receipt_items_user_name_idx, receipts, receipts_user_idx, categories, expenses, expenses_category_idx (+1 more)

### Community 74 - "Reward Cap Allocation"

Cohesion: 0.33
Nodes (8): actualEarnings(), allocate(), CapBook, displayLabel(), groupBy(), missedRewards(), rateFor(), useFor

### Community 75 - "User Identity & Link Codes"

Cohesion: 0.31
Nodes (9): findOrCreateEmailUser(), findUserByEmail(), generateLinkCode(), isLinkCodeShaped(), issueLinkCode(), linkTelegram(), redeemLinkCode(), userByTelegramChat() (+1 more)

### Community 76 - "Capture Setup Card"

Cohesion: 0.31
Nodes (8): CaptureSetupCard(), manufacturer(), Step(), styles, openAppSettings(), openCaptureSettings(), @react-native-async-storage/async-storage@2.2.0, @react-native-async-storage/async-storage

### Community 77 - "Ledger Schema"

Cohesion: 0.36
Nodes (8): accounts, accounts_one_default_idx, accounts_user_idx, expenses_account_idx, merchants, merchants_pattern_idx, transfers, transfers_user_date_idx

### Community 78 - "Firebase Push Setup"

Cohesion: 0.25
Nodes (4): Firebase setup left to user, One-time Firebase/FCM push setup, CATEGORIES, enabled

### Community 79 - "Web Scripts"

Cohesion: 0.25
Nodes (8): scripts, build, dev, set-commands, set-webhook, setu-check, start, test

### Community 80 - "Setu Check Script"

Cohesion: 0.25
Nodes (5): argv, fi, missing, paths, shape()

### Community 81 - "Finance Roadmap Strategy"

Cohesion: 0.29
Nodes (6): Data access matrix (free / entity / licence), Aaj complete finance roadmap (report), Family tracking without forced sign-ups, Roadmap Later (9+ months): gated on money, entity or partner, Ask Google Pay (Gemini assistant), Telegram Bot Platform Developer Terms

### Community 82 - "Mailer"

Cohesion: 0.43
Nodes (7): htmlBody(), mailProvider, MailResult, sendSignInCode(), sendViaEmailJs(), sendViaResend(), sendViaSmtp()

### Community 83 - "Usage Quotas"

Cohesion: 0.39
Nodes (7): consumeQuota(), DEFAULT_LIMITS, evaluate(), limitFor(), limitMessage(), QuotaKind, QuotaVerdict

### Community 84 - "Budgets & Income Schema"

Cohesion: 0.36
Nodes (7): budget_alerts, budgets, budgets_user_cat_uidx, expenses_split_idx, incomes, incomes_user_idx, incomes_account_idx

### Community 85 - "Bills Schema"

Cohesion: 0.36
Nodes (6): bill_payments, bills, bills_user_idx, detected_bills, detected_bills_pending_idx, gmail_accounts

### Community 86 - "Mobile Build & Release"

Cohesion: 0.29
Nodes (7): EAS build and submit, Retire Telegram bot, Mobile app README, Mobile architecture (App.tsx, components, lib/api, lib/theme), EAS store builds, Run with Expo Go (development), Login via Telegram /app code

### Community 87 - "US Card Optimizers"

Cohesion: 0.38
Nodes (5): CardPointers, MaxRewards, MaxRewards, CardPointers, MaxRewards

### Community 88 - "Play Review Login"

Cohesion: 0.80
Nodes (4): normaliseEmail(), config(), isReviewEmail(), reviewCodeMatches()

### Community 89 - "Push Schema"

Cohesion: 0.53
Nodes (5): notifications, notifications_unread_idx, notifications_user_idx, push_tokens, push_tokens_user_idx

### Community 90 - "Mobile Dev Dependencies"

Cohesion: 0.40
Nodes (5): devDependencies, @types/react@~19.2.2, typescript@~6.0.3, @types/react, typescript

### Community 91 - "Mobile Scripts"

Cohesion: 0.40
Nodes (5): scripts, android, ios, start, web

### Community 92 - "Mobile TS Config"

Cohesion: 0.40
Nodes (4): compilerOptions, strict, extends, expo/tsconfig.base

### Community 94 - "Daily Budget Schema"

Cohesion: 0.67
Nodes (3): budget_plans, commitments, commitments_user_idx

### Community 95 - "Goals Schema"

Cohesion: 0.83
Nodes (3): goal_credits, goals, goals_user_idx

### Community 96 - "BBPS Billers Schema"

Cohesion: 0.83
Nodes (3): bbps_billers, bbps_billers_category_idx, bbps_billers_name_idx

### Community 97 - "Bank Messages Schema"

Cohesion: 0.83
Nodes (3): bank_messages, bank_messages_dedupe_idx, bank_messages_external_idx

## Ambiguous Edges - Review These

- `Great.Cards` → `/go/ apply-link click-counting redirect layer` [AMBIGUOUS]
  research_notes/Monzy and Indian card recommenders/monzy.md · relation: conceptually_related_to
- `Android adaptive icon foreground (white glyph on transparent; renders blank)` → `Aaj logo mark: rupee sign inside partial progress ring` [AMBIGUOUS]
  mobile/assets/android-icon-foreground.png · relation: references
- `Android themed/monochrome icon (white on transparent; renders blank)` → `Aaj logo mark: rupee sign inside partial progress ring` [AMBIGUOUS]
  mobile/assets/android-icon-monochrome.png · relation: references
- `Android notification icon (white silhouette; renders blank)` → `Aaj logo mark: rupee sign inside partial progress ring` [AMBIGUOUS]
  mobile/assets/notification-icon.png · relation: references

## Knowledge Gaps

- **96 isolated node(s):** `Done`, `Rejected`, `SignedOut`, `TryLater`, `expo/tsconfig.base` (+91 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 617 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `Web Dependencies` to `Web Dashboard UI`, `Subscriptions & Insights API`, `Morning/Evening Briefs & Notify`, `Bills API`, `Expense Logging & Parser`, `BBPS Integration`, `Bill Detection`, `Goals & Plan API`, `Goals Card & Money Rules`, `Bank SMS Parsing`, `Transfers & Data Export`, `Accounts API`, `Email Inbound & OTP`, `LLM Calls & Redaction`, `Card Catalog Data`, `AI Key Rotation & Secrets`, `Detected Bills Model`, `Transaction Ingest & Balances`, `Receipt Parsing`, `Merchant Cleaning`, `Firebase Push Setup`, `Play Review Login`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **What connects `Done`, `Rejected`, `SignedOut` to the rest of the system?**
  _96 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Web Dashboard UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05276907001044932 - nodes in this community are weakly interconnected._
- **Why does `@supabase/supabase-js` connect `Income & Digest` to `Account & Gmail API Routes`, `Subscriptions & Insights API`, `Telegram Bot`, `Morning/Evening Briefs & Notify`, `Bills API`, `Expense Logging & Parser`, `BBPS Integration`, `Goals & Plan API`, `Web Dependencies`, `Transfers & Data Export`, `Accounts API`, `Email Inbound & OTP`, `AI Key Rotation & Secrets`, `Cards API Service`, `Detected Bills Model`, `Transaction Ingest & Balances`, `Receipt Parsing`, `Merchant Cleaning`, `User Identity & Link Codes`, `Usage Quotas`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Should `Account & Gmail API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.06426484907497566 - nodes in this community are weakly interconnected._

### Low-confidence Hints

_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Great.Cards` and `/go/ apply-link click-counting redirect layer`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Android adaptive icon foreground (white glyph on transparent; renders blank)` and `Aaj logo mark: rupee sign inside partial progress ring`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
