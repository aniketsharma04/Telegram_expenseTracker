# Credit score in Aaj: research and design

Date: 2026-11-04. The question: Google Pay, PhonePe, Paytm and CRED show your CIBIL / credit score for free. Can Aaj, and how?

## How the big apps do it

| App                | Bureau shown                                        | Refresh                | What the user gives                               | Source                                                                                                                                                                                                                                                     |
| ------------------ | --------------------------------------------------- | ---------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Pay         | TransUnion CIBIL                                    | Monthly                | Name, phone; PAN and email optional; tick consent | [Google Pay help](https://support.google.com/pay/india/answer/13017211)                                                                                                                                                                                    |
| Paytm              | TransUnion CIBIL                                    | Monthly                | Paytm account, consent                            | [Paytm FAQ](https://paytm.com/faqs/credit-score/how-to-check-cibil-score-on-paytm)                                                                                                                                                                         |
| PhonePe            | Experian for most users (some see CIBIL or Equifax) | On demand              | Name, DOB, PAN, consent                           | [CreditMantri](https://creditmantri.com/article-how-to-check-cibil-score-in-phonepe), [Crowdfund Insider](https://www.crowdfundinsider.com/2023/12/219026-indian-fintech-phonepe-introduces-option-to-view-credit-bureau-scores-without-additional-costs/) |
| CRED               | Experian; CRIF for club members                     | Monthly                | Name, mobile, email (Experian)                    | [CRED Experian page](https://cred.club/check-your-credit-score/experian-credit-score-report)                                                                                                                                                               |
| Bureaus themselves | Each one                                            | Once a year free (RBI) | Name, PAN, DOB, OTP                               | [CIBIL free score](https://www.cibil.com/freecibilscore)                                                                                                                                                                                                   |

Every one of them has a **signed agreement with a bureau** and pulls the report with the user's consent. A self-check is a soft enquiry and never lowers the score. The bureau differs by app, and scores differ between bureaus (different models and data).

## What the law requires (the deciding factor)

RBI (Credit Information Companies) Directions, 2025, dated 28 Nov 2025 ([TaxGuru summary](https://taxguru.in/rbi/rbi-credit-information-companies-directions-2025.html)):

- **Para 24: sharing with entities that are not "specified users"** (i.e. not banks/NBFCs; this is how a non-lending app gets a report on the user's consent):
  - The bureau must do due diligence on the app company: ownership, governance, financial soundness, information security.
  - A contract with the bureau. A **CISA-certified IS audit every year**, reports to the bureau and the RBI.
  - Use only for the agreed purpose. No selling or passing on, not even to group companies.
  - **Stored in India only**, kept at most 6 months (or until consent is withdrawn), then deleted.
  - Prior written consent, recorded verifiably.
- **Para 21(7):** every bureau gives every individual **one free full credit report with score each calendar year**, linked from its homepage.
- Pulling without a CICRA basis isn't allowed. Aggregator APIs (Surepass, Karza, IDfy, Perfios) are only a technical layer and still need that basis ([productgrowth.in](https://productgrowth.in/tools/kyc-identity/cibil/)).

**Cost when you do have the contract:** bureaus don't publish prices. Indicative figures are ₹5–20 per score-only pull and ₹15–50 per full report at low volume, plus ₹2–15 aggregator margin ([productgrowth.in Experian](https://productgrowth.in/tools/kyc-identity/experian-india/), [Surepass](https://surepass.io/credit-bureau-api/)). At 1,000 users refreshing monthly that's roughly ₹60k–6 lakh a year.

**So:** Aaj (no company, no bureau contract, no audit, free tools only) cannot pull a credit report today. Doing it anyway, e.g. through an aggregator without a contract or by scraping a bureau site, would break the Directions and the bureaus' terms.

## What Aaj does instead (v22, built)

1. **Check for free, in one tap.** A list of the free routes: Google Pay, Paytm, PhonePe, CRED, and the four bureaus' free yearly reports. Tapping one opens the app on Android (or its Play Store page, or the official website). Each row says which bureau it shows and how often it's free.
2. **Save the score.** One field (300–900) and the bureau, pre-selected from the app they came back from. Stored in `credit_scores` (v22 migration), server-only, deleted with "Forget my cards" and with the account.
3. **Track it.** The newest score per bureau, change since last time, "Excellent / Good / Fair / Needs work" at the lenders' cut-offs (750 / 700 / 650), and a bar per saved score.
4. **It feeds the card finder.** Saving a score sets the score band behind the likely / stretch / unlikely approval chances. The user doesn't have to pick a band by hand anymore.
5. **What moves your score**, using only what Aaj actually sees:
   - Payment history: late fees, overdue or bounce messages → "Hurting your score". Minimum-due-only or interest charged → "Watch this".
   - New applications: 2+ new cards in 6 months → "Watch this".
   - Utilisation, credit age and mix are things Aaj can't see from messages, so they're marked "Aaj can't see this" with the rule of thumb, never a made-up status.
6. **A monthly nudge.** The daily cron pushes once, exactly 30 days after the newest saved score: "Time to check your credit score".

Not done, on purpose:

- No PAN or Aadhaar collection.
- No report pulls.
- No "pre-approved" claims.
- No affiliate or tracking links.

## What it would take to pull scores directly (later)

1. A registered company (Pvt Ltd/LLP), with a privacy policy and a grievance officer.
2. A contract with a bureau for consumer-consented pulls (para 24): Experian and CRIF are the most fintech-friendly, CIBIL via its API Marketplace and key account manager. Or go through a regulated lender partner.
3. A yearly CISA IS audit, India-only storage, deletion within 6 months, and a consent log.
4. A budget of ₹5–50 per pull. Refresh monthly at most, and only when the user asks.
5. Then the "Save your score" step disappears. The same screen fills itself, and the factors get real utilisation, age and enquiry data from the report.

## Option worth building next (no contract needed)

**Read the user's own report.** Every bureau's free yearly report is downloadable as a PDF. Letting the user upload theirs, then reading the score, accounts, utilisation, overdue amounts and enquiries out of it, uses only their own data, given by them. That's the same footing as a receipt photo. It would make the utilisation, age and mix factors real. Bureau PDFs are often password-protected (the password is usually built from the name and date of birth), and the layouts differ per bureau, so it needs a parser per bureau and test reports.
