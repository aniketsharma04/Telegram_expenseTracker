# Monzy (monzy.co): profile of the credit-card recommendation flow

Research date: 2026-11-01. Method: fetched monzy.co pages, sitemap, robots.txt, JS bundles and public JSON endpoints directly. Clicked through the credit-card quiz once in Chrome (Shopping branch) using only anonymous multiple-choice answers. No personal data was entered and nothing was submitted. Plus web searches.

Name ambiguity: "Monzy" (monzy.co, India) is unrelated to **Monzo** (the UK digital bank, which has its own 2026 credit-card news) and to "Monyz", a separate Crunchbase entry. Most search results for "Monzy credit card" are about Monzo.

## 1. What monzy.co/go/ytn resolves to, and what is on the site

### Takeaway

`/go/ytn` is a 302 redirect to the monzy.co homepage with YouTube UTM tags (`utm_source=youtube&utm_medium=description&utm_campaign=ytlatest`). In other words it is a link placed in YouTube video descriptions. "ytn" is a campaign shortcode, not a YouTuber's name. The site is a Next.js web app with two "single recommendation" quizzes (credit cards and mutual funds), a card catalogue, a blog, calculators and tools. It has no account system.

### Cited Findings

- `curl -I https://monzy.co/go/ytn` returns `302` to `https://monzy.co/?utm_source=youtube&utm_medium=description&utm_campaign=ytlatest&utm_content=ytlatest` — [monzy.co/go/ytn](https://monzy.co/go/ytn)
- The `/go/` prefix is also used for apply-link click counting. For example, `/go/cashback-sbi-card` returns 302 to `sbicard.com/...cashback-sbi-card.page?utm_source=monzy`. robots.txt disallows `/go/` and `/api/` — [robots.txt](https://monzy.co/robots.txt)
- Homepage: "Help me find the best... Mutual Fund / Credit Card. 60 seconds · 1 recommendation". It claims that "Instead of showing you 100 options, we ask a few smart questions, and pick the single BEST option for you." — [monzy.co](https://monzy.co/)
- The credit-card landing page says "60 seconds · 1 recommendation · NOT sponsored by any banks". It attacks rival sites for "Endless Lists", "Biased Rankings: Paid placements shown as organic results", "Data Sold" and "Spam Calls". Its pitch is "No sign up. No spam." — [monzy.co/credit-cards](https://monzy.co/credit-cards)
- About page: "We don't require an account. We don't sell your data. We don't sell your attention." — [monzy.co/about](https://monzy.co/about)
- **Privacy policy (full substance).** "You do not need an account. We do not ask for your name, email, phone, or PAN." It collects:
  - anonymous quiz answers and the recommended cards
  - product analytics (Google Analytics and Microsoft Clarity)
  - apply-link clicks, counted when users pass through monzy.co/go/ to a bank site

  Quiz UI state is stored in the browser. The policy states "No sale of your data to banks" and "we do not share quiz answers with banks for marketing". No partner banks and no DSA (direct selling agent) relationship are named. — [monzy.co/privacy-policy](https://monzy.co/privacy-policy)

- Terms say Monzy is "not a bank, not a lender, and not a financial advisor". It does not guarantee approvals, and scraping is prohibited. No legal entity name, address or grievance officer is given. — [monzy.co/terms-and-conditions](https://monzy.co/terms-and-conditions)
- Contact: contact@monzy.co on the page. The JSON-LD lists hello@monzy.co. — [monzy.co/contact](https://monzy.co/contact)
- The sitemap (about 210 URLs) includes:
  - /cards plus about 168 individual card pages
  - /funds, /mutual-funds, /mutual-fund-taxation
  - /scoring-methodology
  - /tools: credit-card offers, CIBIL action impact, an MCC (merchant category code) scanner ("scan a QR code and see its MCC code"), "what changed to your credit card", and an ideal card-stack checker
  - about 25 calculators, including a reward calculator, annual-fee breakeven, credit-card interest, card-debt refinance, no-cost-EMI true cost, CIBIL score action plan, SIP and retirement

  Source: [sitemap.xml](https://monzy.co/sitemap.xml), [monzy.co/tools](https://monzy.co/tools)

- The card catalogue at /cards shows "348 cards found" from about 28 issuers (AU SFB, Amex, Axis, BOBCARD, HDFC, ICICI, IDFC FIRST, IndusInd, Kotak, OneCard, RBL, SBI Card, SC, YES, slice and others). Filters cover Travel, Shopping, Fuel, Lounges, Dining, Flights and Utilities, sorted by "Popular". — [monzy.co/cards](https://monzy.co/cards)
- Card counts vary by source:
  - The Organization JSON-LD claims "India's most exhaustive credit card recommendation platform with 493 cards" — [monzy.co/about (page source)](https://monzy.co/about)
  - The public `/api/refined-catalog` endpoint returned 335 cards. The top issuers were SBI Card 47, RBL 45, Axis 32, HDFC 26, ICICI 22, IndusInd 21. — [monzy.co/api/refined-catalog](https://monzy.co/api/refined-catalog)
- A blog is hosted at blog.monzy.co and uses its own GA tag plus Microsoft Clarity — [blog.monzy.co](https://blog.monzy.co)

### Inferences

- "ytn" / "ytlatest" most likely means "YouTube, latest video". It is the link Ankur Warikoo's channel puts in video descriptions (see section 4).
- The three public figures (348, 335 and 493 cards) suggest the catalogue includes discontinued or variant cards, or that the marketing figure is inflated.

### Gaps

- No FAQ page and no separate disclosures page exist.
- The terms and privacy policy do not name a registered legal entity.

## 2. The quiz: questions, options, order and logic

### Takeaway

The quiz has about 6 adaptive multiple-choice questions, with no text input. It never asks for phone, PAN, name, email, income, CIBIL score or date of birth, and it does no credit pull. It returns one "perfect match" card (the code also has a #2 / "rank 2" alternative). It is protected by Google reCAPTCHA v3 and driven server-side through `/api/start` and `/api/answer`.

### Cited Findings (live walkthrough, Shopping branch, 2026-11-01) — [monzy.co/credit-cards](https://monzy.co/credit-cards)

1. **"Which one do you prefer more?"** (shown on the landing page)
   - Travel: free airport lounge access / airline miles and flight rewards / low or zero forex markup
   - Shopping: cashback on Amazon and Flipkart / rewards on Swiggy and Zomato / extra points on online shopping
   - Bills & Utility: fuel surcharge waiver at pumps / cashback on groceries and essentials / rewards on rent and bill payments
2. (26%) **"How do you feel about annual fees?"** Options: No fee, ever / Not free, but under ₹500/year / ₹500–₹2,000/year is fine / ₹2,000–₹5,000/year is fine / Doesn't matter, just show me the best
3. (37%) **"Where do you spend most of your money online?"** Options: Amazon shopping / Flipkart / Myntra / Food delivery and dining out / Tata apps (BigBasket, Croma, 1mg) / Movies and OTT / A little bit of everything
4. (59%; the progress bar skipped from 37% to 59%, so a question was skipped or branched) **"Do you need UPI support?"** Options: Yes, I need UPI / Doesn't matter
5. (70%) **"How much is your total monthly expense?"** Options: Under ₹15,000 / ₹15,000–₹50,000 / ₹50,000+
6. (81%) **"What kind of rewards do you need?"** Options: Higher benefits, with a monthly limit / Lower benefits, with no monthly limits
7. Result page (URL `?page=recommendation`). My answers were Shopping, under ₹500, Amazon, UPI yes, ₹15–50k, higher-but-capped. The result was "WE FOUND A PERFECT MATCH!": **CheQ AU LED Credit Card (AU Small Finance Bank)**, labelled "(No CIBIL Check Needed)", ₹499 joining and ₹499 annual fee. The page showed:
   - an "EARN POINTS" table (12% on Amazon/Flipkart via CheQ, 5% online, 2.5% CheQ UPI, 1% base)
   - category benefits (Shopping, Groceries, Dining, Fuel, Utilities, Travel, Welcome)
   - "THINGS TO KEEP IN MIND" caveats (exclusions; utility and UPI rewards only via the CheQ app; nothing under ₹200)
   - buttons: "Did you find this recommendation helpful?", "Shortlist Card / Compare multiple credit cards", "Visit Card Site"
   - the note "Recommendation based on your choices. No obligation to apply."

### Cited Findings (code and methodology)

- The front-end calls these endpoints:
  - `POST /api/start` with a reCAPTCHA token
  - `POST /api/answer` with `{allAnswers, questionId, answer, answerSecondary, stateKey, recaptchaToken, demographics}`
  - `/api/card-apply-urls`, `/api/refined-catalog`, `/api/compare-verdict`, `/api/saved-cards`

  The reCAPTCHA site key is embedded in the bundle. Analytics events include `rec_rank: 1|2`, `card_rank` and `trackFlowComplete`. A `demographics` object exists in the payload, but the walkthrough asked no demographic questions. — [monzy.co JS bundle](https://monzy.co/credit-cards)

- `/api/health` returns `{"ok":true,"service":"monzy-test"}` — [monzy.co/api/health](https://monzy.co/api/health)
- The scoring methodology page describes three steps:
  - **Step 1:** "a simulated preference exercise across benefit attributes". Attributes you rate as important get positive weight, deprioritised ones get negative weight, and cards are scored by how well their benefits align.
  - **Step 2:** a shortlist filter on 3 questions: lifetime-free vs fee, cashback vs reward points, and UPI or not ("A cashback seeker should never be matched against a rewards or miles card").
  - **Step 3:** "validate the fit" as a whole package, penalising cards whose headline rate is undermined by long exclusion lists. The output is a confidence score.
  - Scores are persona-specific, for example "7.1 / 10 for online shoppers", and are recalculated whenever the engine changes.

  Source: [monzy.co/scoring-methodology](https://monzy.co/scoring-methodology)

- Catalogue data per card includes `earnPoints` (category, rate, monthly cap in INR), tagged `strengths` with conditions, `core_reward_type` (cashback / points), `card_tags.primary`, `marketing_caveats` and the bank `source_url`. Data has been updated to April 2026 rule changes (for example the SBI Cashback ₹2,000 cap). — [/api/refined-catalog](https://monzy.co/api/refined-catalog)

### Inferences

- Ranking appears to be preference-weighted attribute matching with hard filters (fee band, cashback vs points, UPI). It does **not** appear to compute a personalised ₹-value of rewards from the spend profile; the spend question is a coarse 3-bucket band. A separate reward calculator exists at /calculators/reward-calculator.
- **Eligibility is not checked**: no income or CIBIL questions are asked. Instead the result is annotated (for example "No CIBIL Check Needed" for a secured/FD-style card). Approval odds are left to the bank.
- Questions are adaptive: the server returns the next question, and the progress jumps show branching. The Travel and Bills branches will ask different category questions.

### Gaps

- Only one branch (Shopping) was walked. The Travel and Bills branch questions and the mutual-fund quiz were not captured.
- The exact weights and algorithm are server-side and not visible.

## 3. What happens after the recommendation, and the business model

### Takeaway

"Visit Card Site" goes straight to the bank's own product page with only `?utm_source=monzy` added. There is no affiliate network, no lead form, no phone capture and no DSA flow. No visible revenue mechanism exists today. Monzy publicly claims "no ads, no sponsorships" and "NOT sponsored by any banks".

### Cited Findings

- On the results page all three apply links point to `https://www.au.bank.in/personal-banking/credit-cards/cheq-au-credit-card?utm_source=monzy` — [monzy.co/credit-cards result](https://monzy.co/credit-cards)
- `/api/card-apply-urls` returned plain bank URLs with `utm_source=monzy` for AU, SBI Card (Cashback), ICICI (Amazon Pay) and HDFC (Millennia) — [monzy.co/api/card-apply-urls](https://monzy.co/api/card-apply-urls)
- Warikoo's site says Monzy has "No ads, no sponsorships, and no personal data sought or tracked" — [ankurwarikoo.com/about](https://ankurwarikoo.com/about/)
- The privacy policy discloses click counting through /go/ and states no sale of data to banks — [monzy.co/privacy-policy](https://monzy.co/privacy-policy)

### Inferences

- The product currently looks like a non-monetised, audience-building or brand play: a top-of-funnel tool for the Warikoo ecosystem, with the mutual-fund quiz and tools.
- The `/go/` redirect layer and `utm_source=monzy` tagging would make it easy to swap in affiliate URLs later, or to show banks traffic for future partnership deals. This is speculative.

### Gaps

- No disclosure of any current or planned affiliate or commission arrangements was found. No premium tier exists.

## 4. Who runs it, launch date and traction

### Takeaway

Monzy was founded by Ankur Warikoo, India's best-known personal-finance creator. His YouTube channel is the "yt" traffic source. Founding date is 2026-05-06 (JSON-LD); his LinkedIn role starts April 2026. It is small and early, with no disclosed user numbers, funding or legal entity.

### Cited Findings

- The site's Organization JSON-LD has `"foundingDate":"2026-05-06"` and `"founder": Ankur Warikoo`, and a Person schema gives Warikoo `jobTitle: Founder` and `worksFor` Monzy. The footer social links on every page point to Warikoo's YouTube, X, Instagram and LinkedIn, plus linkedin.com/company/monzy-co — [monzy.co/about (page source)](https://monzy.co/about)
- Warikoo's LinkedIn headline: "Founder @WebVeda, @IndiaGeniusChallenge @Monzy • 6X Bestselling Author • 16M+ community" — [LinkedIn](https://in.linkedin.com/in/warikoo)
- Warikoo's site: "In 2026, we launched Monzy – a free credit card discovery platform…" — [ankurwarikoo.com/about](https://ankurwarikoo.com/about/)
- The team page (published 2026-05-27) lists:
  - Ankur Warikoo, Founder
  - Anmol Ratan Sachdeva, SEO and Data Lead, who has tracked Indian cards since 2019 and built the card database
  - Amarjeet Sarma, Chief Developer, who built the recommendation engine
  - Sakshi Dubey, Content Writer
  - Supriya, UI/UX

  Source: [blog.monzy.co/blog/team-monzy](https://blog.monzy.co/blog/team-monzy)

- Inc42 lists Warikoo as "Founder at Monzy.co" — [Inc42](https://inc42.com/person/ankur-warikoo/)
- One search-result summary attributes a statement to Warikoo that Monzy operates "under brand warikoo biz, for now". I could not open the source to verify it — [X post (402 on fetch)](https://x.com/warikoo/status/2008855596691505366)
- Product Hunt launch, hunted by Anmol Ratan Sachdeva: tagline "Find your best card in 60 seconds", 8 upvotes, 2 comments, #33 on the day. The maker comment cites 450+ cards from 16+ banks and Reddit users asking for recommendations as the motivation. — [hunted.space](https://hunted.space/product/monzy), [Product Hunt](https://www.producthunt.com/p/monzy)
- A Crunchbase profile exists, but no funding was visible in search results — [Crunchbase](https://www.crunchbase.com/organization/monzy)

### Inferences

- Distribution is essentially Warikoo's audience (YouTube description links, the `/go/ytn` campaign). This is the main moat versus BankBazaar, Paisabazaar or TechnoFino-style tools.
- It is probably run inside an existing Warikoo company rather than a separately incorporated "Monzy" entity, since no MCA entity named Monzy was found.

### Gaps

- Legal entity, CIN and MCA registration: none found on Tofler, InstaFinancials or the site.
- No funding information found.
- No user counts, quiz completions, web-traffic estimates or follower counts for the Monzy LinkedIn page were found.

## 5. Apps, other products, and user reviews or complaints

### Takeaway

Monzy is web-only: no Android or iOS app links in the site HTML or JS, and none found in search. Besides card recommendations it offers a mutual-fund "one fund" quiz, a card catalogue with compare and shortlist, a card-changes tracker, an MCC scanner, a card-stack checker, a deals page and about 25 finance calculators. It has **no** expense tracking, card linking, SMS parsing or reward tracking. I found no independent reviews or complaints anywhere.

### Cited Findings

- The site HTML and JS bundles contain no play.google.com or apps.apple.com links (grep across fetched pages and bundles) — [monzy.co](https://monzy.co/)
- Mutual-fund quiz: "Everyone (including warikoo) keeps telling you to invest in Mutual Funds. Nobody tells you which is the right one. 60 seconds · 1 recommendation" — [monzy.co/mutual-funds](https://monzy.co/mutual-funds)
- Tools page lists: CIBIL Action Impact Calculator, MCC Scanner ("Scan a QR code and see its MCC code"), Card Changes ("What changed to your credit card?"), Card Stack Checker ("Do you need another credit card?") and Deals ("Real discounts, live from the banks") — [monzy.co/tools](https://monzy.co/tools)
- Searches of Reddit (r/CreditCardsIndia), Product Hunt and general web found no user reviews, accuracy complaints, spam-call complaints or data-sharing complaints. The Product Hunt page shows 0 reviews. — [Product Hunt](https://www.producthunt.com/p/monzy)

### Inferences

- Spam-call or data complaints are structurally unlikely, because no contact data is collected.
- The likely critique is accuracy and bias. In my test, the "perfect match" for a mainstream Amazon shopper was a niche CheQ-app-dependent AU card whose top rates require routing spend through the CheQ app. Enthusiast communities may question picks like this.

### Gaps

- I could not search Reddit, X, TechnoFino or Trustpilot natively. The absence of reviews may reflect search-index limits rather than real absence.
- No Play Store or App Store listing, so there are no ratings or downloads to report.
