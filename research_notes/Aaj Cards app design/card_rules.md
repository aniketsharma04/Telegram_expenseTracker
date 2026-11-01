# Indian credit card reward rules: dataset for the Aaj card recommender

Compiled 1 November 2026. 53 cards are in the JSON, including one closed to new applicants (the original Swiggy HDFC). Myntra Kotak is discontinued and appears only in the notes.

## 0. How to read this (read before using the numbers)

**How the data was gathered.** Issuer pages (hdfc.bank.in, axis.bank.in, sbicard.com, icici.bank.in) are mostly
JavaScript shells and served little to a fetcher. So this dataset is built from:
1. **Issuer documents read directly.** These are the strongest sources. Read in full: the SBI Cashback revision PDF
   (effective 1 Apr 2026), the SBI domestic-lounge PDF (w.e.f. 10 Jan 2026) and IDFC's FIRST Millennia notice
   (effective 18 Jun 2026). Partly read: the HDFC Millennia and Regalia Gold product pages.
2. **book1a.com card pages.** Each page says when it checked the issuer's terms (3 to 26 Oct 2026) and links the PDF
   it used (MITC, KFS, T&C). Most of the HDFC, SBI, ICICI, Axis, Scapia, Kiwi, Jupiter, IndusInd, Amex, HSBC and BOB
   rows come from here.
3. **cardexpress.in reviews.** Pages updated March to Oct 2026. These pages contradict themselves fairly often, and I
   have flagged where they do. Rows that rest mainly on CardExpress get confidence `medium` or `low`.
4. **Trackers, for the timeline of devaluations:** LiveFromALounge, SaveSage, CredSutra and InsideFlyer.
5. **What I already knew**, only where nothing fresher turned up. Every such case is called out in that card's
   `notes` field.

`verified` is the date I checked the source (2026-11-01). It does not mean a bank confirmed the row. **Re-check
any row against the issuer's MITC before it drives a user-facing recommendation.** Before launch, fetch each
issuer's MITC/KFS PDF and diff it against this file.

**How rates are expressed.** Every `rate` / `baseRate` is the value back in rupees as a % of spend.
- `baseRate` uses the **best common redemption**. That is SmartBuy or Travel EDGE travel, airline-mile transfers
  at about ₹1 per mile, the Gold catalogue, or partner coins. Choose this when the user redeems for travel.
- `baseRateCash` uses **statement credit or cashback**, or the nearest cash-like option. Choose this for a
  conservative "what's it worth in cash" view. It is `null` where no cash route exists or none is published.
- `rate` inside `rules` uses the same valuation as `baseRate`. Where the two valuations differ, the label gives both.

**Point values assumed** (best → cash):

| Currency | Best common | Cash / statement | Basis |
|---|---|---|---|
| HDFC RP: Infinia, Diners Black Metal | ₹1.00 (SmartBuy flights/hotels, up to 70% of the booking) | ₹0.30 | book1a, HDFC FAQ |
| HDFC RP: Regalia Gold | ₹0.50 SmartBuy (₹0.65 Gold catalogue) | lower, not published (assumed ₹0.20) | book1a |
| HDFC CashPoints: Millennia | ₹1.00 statement credit (500 to 3,000 per month, ₹50 fee per redemption) | ₹1.00 | book1a (T&C dated 20 Jul 2026) |
| HDFC CashPoints: MoneyBack+ | ₹0.25 | ₹0.25 | CardExpress |
| IRCTC HDFC RP | ₹1.00, train tickets on SmartBuy only | none | CardExpress |
| NeuCoins (Tata Neu cards) | ₹1.00 inside the Tata Neu ecosystem | none | book1a |
| SBI RP | ₹0.25 | ₹0.25 (statement credit max 60,000 RP a month, in multiples of 4,000, from 1 Apr 2026) | SBI notices |
| ICICI RP | ₹0.25 | ₹0.25 | common valuation |
| ICICI RP: Emeralde Private | ₹1.00 (flights, hotels, premium vouchers) | ₹0.40 | book1a |
| Axis EDGE RP: Neo, MyZone | ₹0.20 | ₹0.20 | book1a |
| Axis EDGE RP: Magnus | ₹0.40 (5:2 transfer, mile at ₹1) | ₹0.20 | book1a / Axis |
| Axis EDGE RP: Magnus for Burgundy | ₹0.80 (5:4 transfer) | ₹0.20 | book1a |
| Axis EDGE Miles: Atlas | ₹1.00 (Travel EDGE, or a 1:2 transfer) | none | book1a |
| IDFC RP | ₹0.25 | ₹0.25 | IDFC notices |
| AU RP | ₹0.25 (assumed; AU does not publish a value) | ₹0.25 | low confidence |
| IndusInd Tiger RP | ₹1.00 (1:1 Maharaja Points) | ₹0.40 | book1a |
| IndusInd Legend RP | ₹0.75 pay-with-points (1 RP = 1 airmile) | ₹0.50 | CardExpress |
| Amex MR | ₹0.50 (18K/24K Gold Collection, Marriott 1:1) | not published | common valuation |
| HSBC TravelOne RP | ₹0.50 (1:1 airline transfers, mile valued conservatively) | not published | assumption |
| YES RP: Marquee | ₹0.25 travel portal | ₹0.10 | CardExpress |
| Kotak League RP | ₹0.10 | ₹0.10 | aggregators (low) |
| OneCard RP | ₹0.10 | ₹0.10 | known structure (low) |
| Scapia coins | ₹0.20 (5 coins = ₹1), Scapia travel only | none | book1a |
| Jupiter Jewels | ₹0.20 (flights, store, vouchers, gold) | ₹0.14 (from 1 Jun 2026) | book1a |
| Kiwis | ₹0.25 | ₹0.25 (to UPI) | Kiwi policy |
| CRED IndusInd RP | ₹1.00 (CRED store, flights, Pay) | ₹0.50 (card bill) | book1a |
| BOB Eterna RP | ₹0.25 | ₹0.25 | book1a |

**Conventions in the JSON**
- `99` in a lounge field means unlimited. `0` means none. A number is the yearly total at full eligibility. Any spend
  condition is in `loungeCondition`.
- `capMonthly` is the cap on **reward value in ₹ per month or statement cycle**, converted at the same valuation as
  `rate`. `capQuarterly` is used where the bank caps per quarter. `capNote` records the cap in points.
- `categoryCapsMonthlyRs` gives monthly ₹ caps on reward value for categories that still earn but are capped
  (grocery, utilities, insurance).
- `reducedRate` lists categories that earn below the base rate.
- `exclusions` lists categories that earn nothing.
- `fees` are excluding GST. `minIncomeMonthly` is the salaried net monthly income. The self-employed rule goes in
  `minIncomeSelfEmployedYearly` (ITR, per year).
- `status` is one of `active`, `paused` (not taking new applications), `closed-new` (closed to new applicants,
  existing cards keep working) or `discontinued`.
- `upi: true` means the card is RuPay and can be linked to UPI. Some cards earn rewards on UPI only through the
  card's own app. Those cases are in the rules or the notes.

## 1. Summary table

Rates are % value back at the best common redemption; the cash value is in brackets where it differs. "Top
accelerated" is the best everyday rule, and its cap is in ₹ value.

| Card | Net. | UPI | Fee (join/annual) | Waiver | Base % | Top accelerated (cap) | Lounge D/I per yr | Forex | Conf. |
|---|---|---|---|---|---|---|---|---|---|
| HDFC Millennia | V/MC | N | 1000/1000 | 1L | 1.0 | 5% on 10 brands (₹1,000/mo) | 0* / 0 | 3.5 | high |
| HDFC Regalia Gold | V/MC | N | 2500/2500 | 4L | 1.25 (0.5) | 5X brands/SmartBuy ≈6.25% (≈₹2,000/mo SmartBuy) | 12† / 6 | 2 | med-high |
| HDFC Infinia | V/MC | N | 12500/12500 | 10L | 3.33 (1.0) | SmartBuy hotels 10X ≈33% (₹15,000/mo; vouchers ₹3,000) | 99 / 99 | 2 | high |
| HDFC Diners Club Black Metal | Diners | N | 10000/10000 | 8L | 3.33 (1.0) | SmartBuy up to 10X (₹10,000/mo) | 99 / 99 | 2 | high |
| HDFC Swiggy BLCK | MC? | N | 1000/1000 | 2L | 1.0 | Swiggy 10% (₹1,500/mo) | 0 / 0 | 3.5 | medium |
| HDFC Swiggy ORNGE | MC? | N | 500/500 (LTF via Swiggy) | 1.5L | 1.0 | Swiggy + online 5% (₹1,500 shared) | 0 / 0 | n/a | medium |
| Tata Neu Infinity HDFC | V/RuPay | Y | 1499/1499 | 3L | 1.5 | Tata Neu 5% | 8† / 4 | 2 | high |
| Tata Neu Plus HDFC | V/RuPay | Y | 499/499 | 1L | 1.0 | Tata Neu 2% | 4† / 0 | 3.5 | medium |
| IRCTC HDFC | RuPay | Y | 500/500 | 1.5L | 1.0 (trains) | IRCTC via SmartBuy 10% (₹2,000/mo) | rail 8 | 3.5? | medium |
| HDFC MoneyBack+ | V/MC/RuPay | Y? | 500/500 | 50k | 0.33 | 10X partners 3.33% (₹625/mo) | 0 / 0 | 3.5 | medium |
| SBI Cashback | Visa | N | 999/999 | 2L | 1.0 offline | 5% online (₹2,000/cycle) | 0 / 0 | 3.5 | high |
| SBI SimplyCLICK | V/MC | N | 499/499 | 1L | 0.25 | 10X partners 2.5% (₹2,500/mo) | 0 / 0 | 3.5 | medium |
| SBI SimplySAVE | V/MC/RuPay | Y | 499/499 | 1L | 0.17 | 10X dining/grocery/movies 1.67% | 0 / 0 | 3.5 | medium |
| SBI BPCL Octane | Visa | N | 1499/1499 | 2L | 0.25 | BPCL fuel 6.25% (+1% surcharge waiver) (₹625/cycle) | 4 / 0 | 3.5 | med-high |
| SBI Elite | V/MC | N | 4999/4999 | 10L | 0.5 | 5X dining/grocery/dept 2.5% | 8 / 6 | 1.99 | medium |
| SBI PRIME | V/MC | N | 2999/2999 | 3L | 0.5 | 5X dining/grocery/dept/movies 2.5% | 8 / 4 | 3.5 | medium |
| Flipkart SBI | V/MC | N | 500/500 | 3.5L | 1.0 | Myntra 7.5% (₹4,000/qtr) | 0 / 0 | 3.5 | medium |
| Amazon Pay ICICI | Visa | N | 0/0 | n/a | 1.0 | Amazon 5% for Prime members (uncapped) | 0 / 0 | 1.99 | high |
| ICICI Coral (RuPay) | RuPay | Y | 500/500 | 1.5L | 0.5 | iShop travel (bonus) | 4† / 0 | 3.5 | medium |
| ICICI Sapphiro | V/MC | N | 6500/3500 | 6L | 0.5 | international 1.0% | 16† / 2 | 3.5 | medium |
| ICICI Emeralde Private Metal | MC | N | 12499/12499 | 10L | 3.0 (1.2) | iShop hotels 12X ≈36% (₹18,000/mo bonus) | 99 / 99 | 2 | med-high |
| Axis Flipkart | Visa | N | 500/500 | 3.5L | 1.0 | Myntra 7.5% (₹4,000/qtr) | 0 / 0 | 3.5 | high |
| Axis Ace | Visa | N | 499/499 | 2L | 1.5 | GPay bills 5% (₹500/cycle shared) | 4† / 0 | 3.5 | medium |
| Axis MyZone | V/RuPay | Y | 500/500 | ? | 0.4 | Swiggy ₹120 off ×2/mo | 4 / 0 | 3.5 | low |
| Axis Neo | V/MC/RuPay | Y | 250/250 | – | 0.1 | Zomato ₹120 off ×2/mo | 0 / 0 | 3.5? | medium |
| Axis Atlas | Visa | N | 5000/5000 | none | 2.0 | travel 5% (to ₹2L spend/mo) | 8 / 4 (Silver) | 3.5 | high |
| Axis Magnus | V/MC | N | 12500/12500 | 25L | 2.4 (1.2) | Travel EDGE 5X ≈12%; 7% above ₹1.5L/mo | 99 / 99 | 2 | medium |
| Axis Magnus for Burgundy | Visa | N | 30000/30000 | 30L | 4.8 (1.2) | 35 ER/₹200 above ₹1.5L ≈14% | 99 / 99 | 2 | med-high |
| Axis Airtel | MC? | N | 500/500 | 2L | 1.0 | Airtel 25% (cap 2× base cashback) | 0 / 0 | 3.5 | medium |
| IDFC FIRST Select | Visa | N | 0/0 | LTF | 0.375 | 1.25% on spend above ₹20k/mo | 4† / 0 | 0 | medium |
| IDFC FIRST Wealth | Visa | N | 0/0 | LTF | 0.375 | 10X dining/travel/intl 1.25% | 4† / 4† | 0 | medium |
| IDFC FIRST Millennia | Visa | N | 0/0 | LTF | 0.375 | 10X dining/travel/intl 1.25% | rail only | 0 | high |
| IDFC FIRST Power+ | RuPay | Y | 499/499 | 1.5L | 0.5 | HPCL 5% (₹600/mo) | 4† / 0 | 0 | medium |
| AU LIT | V/RuPay | ? | 0/0 | LTF | 0.25 | paid add-on 10X 2.5% | add-on | 3.49 | low |
| AU Altura | V/RuPay | ? | 199/199 | 40k | 1.0 | grocery/dept/utilities 2% | rail 8 | 3.49 | low-med |
| IndusInd Tiger | V? | N | 0/0 | LTF | 1.0 (0.4) | 6X above ₹5L/yr | 8 / 2 | 1.5 | medium |
| IndusInd Legend | Visa | N | 0/0 | LTF | 0.75 (0.5) | weekend 1.5% | 0 / 0 | 1.8 | low |
| Kotak 811 DreamDifferent | V/RuPay | Y | 0/0 (FD-backed) | LTF | null | online 4 RP/₹100 | 0 / 0 | ? | low |
| Kotak League Platinum | V/RuPay | ? | 499/499 | 50k | 0.53 | half-yearly milestone | 0 / 0 | 3.5 | low |
| OneCard | V/RuPay | ? | 0/0 | LTF | 0.2 | top 2 categories 5X 1% | 0 / 0 | 1 | low |
| Scapia Federal | Visa (+RuPay) | Y (RuPay) | 0/0 | LTF | 2.0 (Scapia only) | Scapia travel 4% | 99†d / 0 | 0 | med-high |
| Kiwi (YES/PNB/AU RuPay) | RuPay | Y | 0/0 virtual | – | 0.5 | Scan & Pay 1.5% | 0 / 0 | ? | medium |
| Amex MRCC | Amex | N | 1000/4500 | 1.5L | 1.0 | monthly bonuses ≈5% at ₹20k/mo | 0 / 0 | 3.5 | med-high |
| Amex Platinum Travel | Amex | N | 5000/5000 | none | 1.0 | milestones (₹4L, ₹7L) | 8† / 0 | 3.5 | high (paused) |
| Amex Gold Charge | Amex | N | 1000/4500 | ? | 1.0 | 6 × ₹1,000 transactions/mo bonus | 0 / 0 | 3.5 | medium |
| HSBC Live+ | Visa Inf. | N | 999/999 | 2L | 1.5 | dining/food/grocery/shopping/utilities 10% (₹1,200/cycle) | 2 / 1 | 1.99 | high |
| HSBC TravelOne | MC? | N | 4999/4999 | 8L | 1.0 | Rewards Marketplace hotels 12% | 6 / 4 | 3.5 | medium |
| YES Marquee | ? | N | 9999/9999 | 10L | 2.25 (0.9) | online 4.5% (1.8) | 99† / 99† | 1 | medium |
| YES Klick | ? | ? | ? | ? | null | – | – | – | low |
| BOBCARD Eterna | V/RuPay? | ? | 0/2499 | 2.5L | 0.75 | online/travel/dining 3.75% (₹1,250/cycle) | 99† / 0 | 2 | med-high |
| CRED IndusInd RuPay | RuPay | Y | 0/499 | targeted LTF | 1.0 (0.5) | CRED/ecommerce 5% (₹5,000/cycle) | 0 / 0 | ? | medium |
| Jupiter Edge+ (CSB) | RuPay | Y (Jupiter UPI) | 499?/0 | LTF | 1.0 (0.7) | select brands 10% (₹2,000/cycle) | 0 / 0 | ? | medium |

\* Millennia offers either a ₹1,000 voucher or one domestic lounge visit when you spend ₹1L in a quarter.
Sources conflict on whether the lounge option still exists. † Lounge access only with a qualifying spend (see the
JSON). †d Scapia gives unlimited domestic visits in a month after ₹20k spend in the previous month. "rail" means
railway lounges only.

## 2. Devaluations and changes, 2025 to 2026 (by effective date)

| Date | Card(s) | Change | Source quality |
|---|---|---|---|
| 21 Jan 2025 | IndusInd Legend | InterMiles redemption ended | CardExpress |
| 7 Mar 2025 | IndusInd Legend | Lounge access discontinued | CardExpress |
| 1 Apr 2025 | SBI SimplyCLICK | Swiggy cut from 10X to 5X | Business Today, official notice |
| Apr 2025 | YES Marquee | Lounge access made spend-gated; marketing and government spends excluded | CardExpress |
| 12 Jun 2025 | Amex Gold Charge | Fuel stops earning MR; milestone threshold raised (₹10k → ₹15k a month) | CardExpress (low) |
| 10 Jul 2025 | Myntra Kotak | Card discontinued; holders moved to League Platinum or Zen | Business Standard |
| 26 Jul 2025 | SBI (SimplyCLICK and others) | Air and rail accident insurance removed | CardExpress |
| 26 Aug 2025 | Flipkart SBI | Card launched | SBI press |
| 1 Oct 2025 | All HDFC cards | Insurance earning capped (2,000 points a month on MoneyBack+, Tata Neu and others) | CardExpress |
| 11 Oct 2025 | Amazon Pay ICICI | Education, international and non-Amazon utility spends stop earning | book1a |
| 10 Jan 2026 | SBI cards with a ₹1,499 or ₹2,999 fee (PRIME, BPCL Octane, Titan, SELECT co-brands) | Participating domestic lounge list cut sharply. CredSutra also reports visits cut from 8 to 4 | SBI PDF (read) |
| 15 Jan 2026 | ICICI cards | 1% fee on wallet loads of ₹5,000+, 2% on gaming, 1% on transport spend above ₹50k | ICICI notice via tracker |
| 15 Jan 2026 | YES Marquee | 1% fee on utility spend above ₹25k a month | CardExpress |
| 18 Jan 2026 | IDFC FIRST cards | Earn basis moved from per ₹150 to per ₹200 (25% cut). Wealth's 10X threshold cut from ₹30k to ₹20k. FASTag and railway drop to 1X. Wealth lounge cut from 2 to 1 a quarter, domestic and international | IDFC notice PDFs |
| Jan–Feb 2026 | HDFC Infinia | SmartBuy voucher cut announced, then reversed within days | LFAL, Economic Times |
| 10 Feb 2026 | Swiggy HDFC (original) | Closed to new applicants; HDFC now issues Swiggy BLCK and ORNGE | CardExpress |
| 27 Feb 2026 | Scapia | Lounge spend gate raised from ₹10k to ₹20k a month; utilities and insurance stop earning | SaveSage, PickMyCard |
| 9 Mar 2026 | Amex Platinum Travel | ₹1.9L milestone cut from 15k to 7.5k MR | SaveSage |
| 1 Apr 2026 | SBI Cashback | Cap set at ₹2,000 online + ₹2,000 offline per cycle (₹4,000 total, was ₹5,000). Gaming, tolls and government payments excluded | SBI PDF (read) |
| 1 Apr 2026 | All SBI cards except PhonePe and Air India Signature | Statement-credit redemption capped at 60,000 RP a month, in multiples of 4,000 | SBI notice |
| 1 Apr 2026 | HDFC Infinia | Retention needs ₹18L annual spend or ₹50L relationship value | SaveSage |
| 1 Apr 2026 | IndusInd premium cards | Domestic lounge access spend-gated | SaveSage |
| 2 Apr 2026 | Axis Magnus, Atlas, Reserve | Marriott, Accor and Qatar removed as transfer partners (BA, Finnair and Lotusmiles added). In September Accor returned at half value; Cathay, Miles & More and Hilton were added; ITC was removed | Axis notice via tracker |
| 12 Apr 2026 | Axis Airtel | Swiggy and BigBasket 10% removed. Zomato, Blinkit and District capped at ₹200 per partner a month, paid to the partner's wallet. Airtel cap now 2× base cashback, utilities 1×. Lounge access removed | Axis page, SaveSage |
| 17 Apr 2026 | Swiggy HDFC | Swiggy orders under ₹249 earn only 1% | CardExpress |
| 1 May 2026 | SBI BPCL Octane | Fuel accelerator cap reportedly cut from ₹10k to ₹7k of spend (WhichWise). **book1a, on 25 Oct, still shows 2,500 RP, about ₹10k** | conflict |
| 1 May 2026 | Tata Neu HDFC | The 5% NeuCoin bonus on Tata Neu now needs payment with this card | CardExpress (low) |
| 15 May 2026 | HDFC Regalia Gold, Diners Privilege, BizPower | Earn moved from 4 RP/₹150 to 5 RP/₹200 (Diners Privilege to 4 RP/₹200). 1.75% DCC fee added | LFAL, book1a |
| 15 May 2026 | HDFC MoneyBack+ | CardExpress says earning moved from per ₹150 to per ₹200. **LFAL's list of affected cards does not include MoneyBack+** | conflict |
| 1 Jun 2026 | Jupiter Edge+ | Rewards switched to Jewels. Cash value cut from ₹0.20 to ₹0.14. Flights cut from 35X to 25X and capped at 5,000 Jewels. External OTAs drop to base rate | SaveSage, book1a |
| 18 Jun 2026 | IDFC FIRST Millennia, Wealth and others | Rewards capped at the credit limit per cycle. Points now expire after 24 months. Millennia: 10X on dining, travel and international from the first rupee | IDFC PDF (read) |
| 1 Jul 2026 | HDFC SmartBuy (Infinia, DCB, Regalia Gold and others) | Voucher accelerated points capped at 3,000 a month (Infinia was 15,000). The overall SmartBuy caps (15k, 10k, 4k) are unchanged | LFAL, InsideFlyer |
| 1 Jul 2026 | HDFC Regalia Gold | Domestic lounge needs ₹60k spend in the previous quarter (for 3 visits) | HDFC page, LFAL |
| 1 Jul 2026 | PhonePe SBI SELECT BLACK | Caps cut; many categories excluded | SaveSage |
| 1 Jul 2026 | AU cards | 1% fuel fair-usage fee | CardExpress |
| 15 Jul 2026 | BOBCARD Eterna | Unlimited domestic lounge, gated on ₹75k spend in the previous quarter | book1a |
| 26 Jul 2026 | HSBC Live+ | Moved to Visa Infinite. 10% bucket widened (dining, food, grocery, shopping, utilities) with a ₹1,200 cap. 1.5% international cashback removed. Domestic lounge cut from 4 to 2. Forex cut from 3.5% to 1.99% | book1a, SaveSage |
| 28 Aug 2026 | Axis Magnus, Burgundy, Olympus and others | Priority Pass no longer gives free domestic lounge access. DCC fee 2% (Magnus). Tolls stop earning | book1a, SaveSage |
| Sep 2026 | IDFC FIRST (all cards) | Forex markup cut to 0%. A plan to stop rewards on international spends from 26 Oct was reportedly walked back | LFAL, InsideFlyer, IDFC notices |
| 10 Sep 2026 | Amex Platinum Travel | ₹1.9L milestone removed. At ₹7L, the 22.5k MR bonus is removed and the Taj voucher rises from ₹10k to ₹20k | SaveSage, book1a |
| 30 Sep 2026 | Amex India | Reward Multiplier portal closed | book1a, InsideFlyer |
| 1 Oct 2026 | Amex Platinum Travel | Domestic lounge needs ₹1L spend in the previous quarter (₹70k for Q4 2026) | book1a |
| 10 Oct 2026 | Jupiter Edge+ | The 10% shopping rate now needs more than ₹15k spend in the cycle | book1a |
| 15 Nov 2026 (upcoming) | Amex MRCC, Gold and others | Points no longer pooled across cards. MRCC's 50% fee waiver removed (it is now a full waiver at ₹1.5L or nothing). Milestones counted by posting date | LFAL |

## 3. Known conflicts that need checking before launch

1. **SBI BPCL Octane fuel cap.** It is either 2,500 RP per cycle (book1a, issuer PDF checked 25 Oct 2026) or about
   ₹7k of spend from 1 May 2026 (WhichWise). The JSON uses 2,500 RP.
2. **HDFC MoneyBack+ earn basis.** It is either 2 CP per ₹150 or a new per ₹200 basis from 15 May 2026. The JSON
   uses per ₹150 and is marked low confidence.
3. **SBI PRIME and Elite lounge visits.** SBI's 10 Jan 2026 PDF narrows the participating lounges for ₹1,499 and
   ₹2,999 fee cards. CredSutra says visits also fell from 8 to 4. The JSON keeps 8 and records the conflict.
4. **ICICI lounge spend gate.** CardExpress and CardAdvisor say ₹75k a quarter. ICICI's 2024 rule was ₹35k. The JSON
   uses ₹75k, marked unverified.
5. **SBI Elite accelerator cap.** CardExpress says 10,000 RP a month; older terms say 7,500. The JSON uses 10,000.
6. **HDFC Millennia lounge.** The product page offers a voucher or a lounge visit as the milestone. The July 2026
   T&C mentions only the voucher.
7. **Axis Ace availability.** Some sources say new applications are paused. The JSON marks it `paused?`.
8. **IDFC FIRST Wealth and Select structure after 18 Jun 2026.** The Millennia notice was read in full: 10X on
   dining, travel and international from the first rupee. SaveSage says Wealth got the same change. Select is
   assumed to keep the "10X above ₹20k a month" rule.
9. **HSBC TravelOne accelerated cap.** It is either 18,000 or 50,000 RP a month; book1a shows both.
10. **ICICI Emeralde insurance cap.** It is either 5,000 or 1,000 RP per statement; the issuer PDF itself shows both.

## 4. Per-card notes that do not fit the JSON

- **HDFC SmartBuy multipliers.** "5X" or "10X" is the total multiple of base, not base plus 5X. Bonus points need the
  card-specific SmartBuy checkout and count on the settlement date. The voucher sub-cap is 3,000 bonus RP a month
  on premium cards from 1 Jul 2026. Model SmartBuy as a separate "channel" rule, not as a merchant.
- **HDFC exclusions on almost every card:** fuel, rent, government, wallet loads, EasyEMI and SmartEMI, education
  paid through third-party apps, and online skill-gaming. Direct payments to a school or college can earn the base
  rate.
- **HDFC 1% fees** (CardExpress, MITC read 31 Aug 2026): fuel over ₹15k per transaction, education through
  third-party apps (capped at ₹4,999), skill gaming (capped at ₹4,999 a month), rent (1%), and utilities over ₹50k.
- **Axis 1% fees:** rent (per transaction), wallet loads over ₹10k a cycle, utilities over ₹25k a cycle,
  education through third-party apps, and fuel over ₹50k a cycle.
- **SBI fees:** 1% on utility spend above ₹50k a cycle. Rent and wallet earn nothing on most SBI cards.
- **ICICI fees:** 1% on wallet loads of ₹5,000+, 2% on gaming, 1% on transport spend above ₹50k (from 15 Jan 2026).
- **Myntra Kotak:** discontinued 10 Jul 2025, so it is not in the JSON.
- **Original Swiggy HDFC:** closed to new applicants 10 Feb 2026. Existing holders still get 10% on Swiggy (₹1,500 a
  month cap) and 5% on online partners (₹1,500 cap). Rewards go to Swiggy Money. It is in the JSON as `closed-new`.
- **Kiwi:** new cards are issued by YES, PNB or AU, depending on location. Existing Axis KWIK cards move to a separate
  programme from 6 Sep 2026.
- **OneCard** is issued with partner banks (Federal, SBM, BOB, South Indian, CSB and others). The 5X rule applies
  automatically to your top 2 spend categories each cycle.
- **Amex** applications: Platinum Travel is **paused** for new applicants (book1a, Oct 2026).
- **IDFC FIRST** rewards are capped at the credit limit per cycle from 18 Jun 2026.

## 5. JSON

Field additions beyond the requested shape: `status`, `baseRateCash`, `pointValue`, `earnRule`, `capQuarterly`,
`capNote`, `tracking`, `categoryCapsMonthlyRs`, `milestones[].spendQuarterly` and `spendMonthly`,
`loungeCondition`, `minIncomeSelfEmployedYearly`, `devaluations`, `notes`. Unknown values are `null`.

```json
[
  {
    "key": "hdfc-millennia", "bank": "HDFC", "name": "Millennia", "status": "active",
    "networks": ["Visa", "Mastercard"], "upi": false,
    "joiningFee": 1000, "annualFee": 1000, "feeWaiverSpend": 100000,
    "earnRule": "5% / 1% CashPoints; 1 CP = ₹1 statement credit (500–3,000 CP per month, ₹50 + GST fee per redemption)",
    "pointValue": {"best": 1.0, "cash": 1.0},
    "baseRate": 1.0, "baseRateCash": 1.0,
    "rules": [
      {"label": "5% on Amazon, BookMyShow, Cult.fit, Flipkart, Myntra, Sony LIV, Swiggy, Tata CLiQ, Uber, Zomato", "merchants": ["amazon","bookmyshow","cultfit","flipkart","myntra","sonyliv","swiggy","tatacliq","uber","zomato"], "categories": [], "rate": 5.0, "capMonthly": 1000, "capNote": "1,000 CP per calendar month, shared by all 10 merchants", "tracking": "merchant + MCC; non-EMI only"},
      {"label": "1% on all other eligible spends", "merchants": [], "categories": [], "rate": 1.0, "capMonthly": 1000, "capNote": "separate cap of 1,000 CP per calendar month", "tracking": "all eligible retail"}
    ],
    "exclusions": ["fuel","rent","government","wallet","emi","education","gift-vouchers","cash"],
    "reducedRate": {},
    "categoryCapsMonthlyRs": {},
    "milestones": [{"spendQuarterly": 100000, "valueRs": 1000, "label": "₹1,000 gift voucher (or 1 domestic lounge visit, per the product page) on ₹1L spend in a calendar quarter"}],
    "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": "Only as an alternative to the quarterly milestone voucher. The July 2026 T&C says free domestic access ended 1 Dec 2023.",
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": 35000, "minIncomeSelfEmployedYearly": 600000,
    "devaluations": [],
    "verified": "2026-11-01", "confidence": "high",
    "sources": ["https://www.hdfc.bank.in/credit-cards/millennia-credit-card", "https://book1a.com/apply/hdfc-bank/millennia"],
    "notes": "Travel redemption is ₹0.30 per CP; do not use it. Education paid directly to the institution can earn. The income figures are well-known published values; re-check them on the eligibility tab."
  },
  {
    "key": "hdfc-regalia-gold", "bank": "HDFC", "name": "Regalia Gold", "status": "active",
    "networks": ["Visa", "Mastercard"], "upi": false,
    "joiningFee": 2500, "annualFee": 2500, "feeWaiverSpend": 400000,
    "earnRule": "5 RP per ₹200 from 15 May 2026 (was 4 RP per ₹150); max 50,000 RP per statement cycle",
    "pointValue": {"best": 0.5, "cash": null, "goldCatalogue": 0.65},
    "baseRate": 1.25, "baseRateCash": null,
    "rules": [
      {"label": "5X on Myntra, Nykaa, Marks & Spencer, Reliance Digital", "merchants": ["myntra","nykaa","marksandspencer","reliancedigital"], "categories": [], "rate": 6.25, "capMonthly": null, "capNote": "a bonus cap applies; amount not published in sources read", "tracking": "merchant"},
      {"label": "SmartBuy flights 5X", "merchants": ["smartbuy"], "categories": ["flights"], "rate": 6.25, "capMonthly": 2000, "capNote": "overall SmartBuy bonus cap 4,000 RP per month", "tracking": "HDFC SmartBuy portal"},
      {"label": "SmartBuy hotels 10X", "merchants": ["smartbuy"], "categories": ["hotels"], "rate": 12.5, "capMonthly": 2000, "capNote": "shares the 4,000 RP per month SmartBuy cap", "tracking": "HDFC SmartBuy portal"},
      {"label": "SmartBuy vouchers 5X", "merchants": ["smartbuy"], "categories": [], "rate": 6.25, "capMonthly": 1500, "capNote": "3,000 RP per month voucher sub-cap from 1 Jul 2026", "tracking": "SmartBuy GyFTR/Woohoo"}
    ],
    "exclusions": ["fuel","wallet","rent","government","emi","education","gaming"],
    "reducedRate": {},
    "categoryCapsMonthlyRs": {"insurance": null, "groceries": null, "utilities": null, "telecom": null},
    "milestones": [
      {"spendQuarterly": 150000, "valueRs": 1500, "label": "₹1,500 Myntra or Nykaa voucher each quarter"},
      {"spendYearly": 500000, "valueRs": 5000, "label": "₹5,000 flight voucher"},
      {"spendYearly": 750000, "valueRs": 5000, "label": "a further ₹5,000 flight voucher"}
    ],
    "loungeDomesticYear": 12, "loungeIntlYear": 6, "loungeCondition": "Domestic: 3 a quarter after ₹60k spend in the previous quarter (from 1 Jul 2026). International: 6 a year on Priority Pass.",
    "forexMarkup": 2.0, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": 100000, "minIncomeSelfEmployedYearly": 1200000,
    "devaluations": [{"date": "2026-05-15", "change": "Earn cut from 4 RP/₹150 to 5 RP/₹200; 1.75% DCC fee added"}, {"date": "2026-07-01", "change": "Domestic lounge gated at ₹60k per quarter; voucher sub-cap of 3,000 RP"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://www.hdfc.bank.in/credit-cards/regalia-gold-credit-card", "https://book1a.com/apply/hdfc-bank/regalia-gold", "https://livefromalounge.com/hdfc-bank-mid-tier-credit-cards-changes-2026/"],
    "notes": "Grocery, utilities, telecom and insurance are capped, but the amounts were not in the sources read (on other HDFC cards it is usually 2,000 RP). Income is from memory; low confidence on that field."
  },
  {
    "key": "hdfc-infinia", "bank": "HDFC", "name": "Infinia (Metal)", "status": "active",
    "networks": ["Visa", "Mastercard"], "upi": false,
    "joiningFee": 12500, "annualFee": 12500, "feeWaiverSpend": 1000000,
    "earnRule": "5 RP per ₹150; max 2,00,000 RP per statement cycle",
    "pointValue": {"best": 1.0, "cash": 0.30},
    "baseRate": 3.33, "baseRateCash": 1.0,
    "rules": [
      {"label": "SmartBuy hotels 10X", "merchants": ["smartbuy"], "categories": ["hotels"], "rate": 33.3, "capMonthly": 15000, "capNote": "15,000 bonus RP per calendar month across all of SmartBuy", "tracking": "SmartBuy portal"},
      {"label": "SmartBuy flights 5X", "merchants": ["smartbuy"], "categories": ["flights"], "rate": 16.7, "capMonthly": 15000, "capNote": "shares the 15,000 RP cap", "tracking": "SmartBuy portal"},
      {"label": "SmartBuy gift vouchers 5X", "merchants": ["smartbuy"], "categories": [], "rate": 16.7, "capMonthly": 3000, "capNote": "3,000 bonus RP per month from 1 Jul 2026 (was 15,000)", "tracking": "SmartBuy GyFTR/Woohoo"}
    ],
    "exclusions": ["fuel","wallet","rent","government","emi","education","gaming"],
    "reducedRate": {},
    "categoryCapsMonthlyRs": {"groceries": 2000, "utilities": 2000, "telecom": 2000, "insurance": 10000},
    "milestones": [],
    "loungeDomesticYear": 99, "loungeIntlYear": 99, "loungeCondition": "Unlimited for primary and add-on cardholders; no spend condition as of 2026",
    "forexMarkup": 2.0, "fuelSurchargeWaiver": null,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-04-01", "change": "Retention needs ₹18L annual spend or ₹50L relationship value"}, {"date": "2026-07-01", "change": "SmartBuy voucher bonus capped at 3,000 RP per month (was 15,000)"}],
    "verified": "2026-11-01", "confidence": "high",
    "sources": ["https://book1a.com/apply/hdfc-bank/infinia", "https://livefromalounge.com/hdfc-bank-credit-cards-devalues-smartbuy-gift-vouchers-accelerated-rewards-with-new-monthly-cap-effective-today/"],
    "notes": "Invite-only. Category caps are in RP; at ₹1 per RP they equal the ₹ shown. 1% Global Value Programme cashback on international spend, capped at ₹1,000 per cycle."
  },
  {
    "key": "hdfc-diners-black-metal", "bank": "HDFC", "name": "Diners Club Black Metal", "status": "active",
    "networks": ["Diners"], "upi": false,
    "joiningFee": 10000, "annualFee": 10000, "feeWaiverSpend": 800000,
    "earnRule": "5 RP per ₹150; max 75,000 RP per statement cycle",
    "pointValue": {"best": 1.0, "cash": 0.30},
    "baseRate": 3.33, "baseRateCash": 1.0,
    "rules": [
      {"label": "Weekend dining 2X (10 RP per ₹150)", "merchants": [], "categories": ["food"], "rate": 6.67, "capMonthly": null, "capNote": "1,000 bonus RP per day", "tracking": "MCC, Saturday and Sunday"},
      {"label": "SmartBuy flights, hotels, partners up to 10X", "merchants": ["smartbuy"], "categories": ["flights","hotels"], "rate": 33.3, "capMonthly": 10000, "capNote": "10,000 bonus RP per month", "tracking": "SmartBuy portal"},
      {"label": "SmartBuy vouchers", "merchants": ["smartbuy"], "categories": [], "rate": 10.0, "capMonthly": 3000, "capNote": "3,000 RP per month voucher sub-cap from 1 Jul 2026; multiplier is 3X per some sources", "tracking": "SmartBuy"}
    ],
    "exclusions": ["fuel","wallet","rent","government","emi","education","gaming"],
    "reducedRate": {},
    "categoryCapsMonthlyRs": {"insurance": 5000, "groceries": 2000, "utilities": null, "telecom": null},
    "milestones": [{"spendQuarterly": 400000, "valueRs": 10000, "label": "10,000 bonus RP on ₹4L spend in a quarter"}],
    "loungeDomesticYear": 99, "loungeIntlYear": 99, "loungeCondition": "Unlimited for primary and add-on cardholders",
    "forexMarkup": 2.0, "fuelSurchargeWaiver": false,
    "minIncomeMonthly": 250000, "minIncomeSelfEmployedYearly": 3000000,
    "devaluations": [{"date": "2026-07-01", "change": "SmartBuy voucher bonus capped at 3,000 RP per month"}],
    "verified": "2026-11-01", "confidence": "high",
    "sources": ["https://book1a.com/apply/hdfc-bank/dcb-metal"],
    "notes": "Diners acceptance is weaker abroad and at small merchants. Welcome memberships need ₹1.5L spend within 90 days."
  },
  {
    "key": "hdfc-swiggy-blck", "bank": "HDFC", "name": "Swiggy BLCK", "status": "active",
    "networks": ["Mastercard"], "upi": false,
    "joiningFee": 1000, "annualFee": 1000, "feeWaiverSpend": 200000,
    "earnRule": "Cashback paid as statement credit",
    "pointValue": {"best": 1.0, "cash": 1.0},
    "baseRate": 1.0, "baseRateCash": 1.0,
    "rules": [
      {"label": "Swiggy Food, Instamart, Dineout 10% (minimum order ₹249)", "merchants": ["swiggy","instamart","dineout"], "categories": ["food-delivery","groceries"], "rate": 10.0, "capMonthly": 1500, "tracking": "merchant"},
      {"label": "Select online merchants 5%", "merchants": [], "categories": ["shopping-online"], "rate": 5.0, "capMonthly": 1500, "tracking": "online MCC list"},
      {"label": "Other spends 1%", "merchants": [], "categories": [], "rate": 1.0, "capMonthly": 1000, "tracking": "all eligible"}
    ],
    "exclusions": ["wallet","gift-vouchers","rent","government","education","gaming","fuel","jewellery","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {"insurance": null},
    "milestones": [],
    "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": 3.5, "fuelSurchargeWaiver": null,
    "minIncomeMonthly": 100000, "minIncomeSelfEmployedYearly": 1200000,
    "devaluations": [],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://cardexpress.in/reviews/swiggy-blck-hdfc", "https://book1a.com/apply/hdfc-bank/swiggy-blck"],
    "notes": "The network is inferred from a Mastercard golf benefit. The exclusion list is copied from the combined ORNGE/BLCK terms (22 Sep 2026)."
  },
  {
    "key": "hdfc-swiggy-ornge", "bank": "HDFC", "name": "Swiggy ORNGE", "status": "active",
    "networks": ["Mastercard"], "upi": false,
    "joiningFee": 500, "annualFee": 500, "feeWaiverSpend": 150000,
    "earnRule": "Cashback paid as statement credit",
    "pointValue": {"best": 1.0, "cash": 1.0},
    "baseRate": 1.0, "baseRateCash": 1.0,
    "rules": [
      {"label": "Swiggy Food, Instamart, Dineout 5% (minimum ₹249)", "merchants": ["swiggy","instamart","dineout"], "categories": ["food-delivery","groceries"], "rate": 5.0, "capMonthly": 1500, "capNote": "₹1,500 per billing cycle, shared with online 5%", "tracking": "merchant"},
      {"label": "Eligible online MCCs 5% (minimum ₹249)", "merchants": [], "categories": ["shopping-online"], "rate": 5.0, "capMonthly": 1500, "capNote": "shared with Swiggy 5%", "tracking": "online MCC list"},
      {"label": "Other spends 1%", "merchants": [], "categories": [], "rate": 1.0, "capMonthly": 1000, "tracking": "all eligible"}
    ],
    "exclusions": ["wallet","gift-vouchers","rent","government","education","gaming","fuel","jewellery","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [],
    "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": null, "fuelSurchargeWaiver": null,
    "minIncomeMonthly": 20000, "minIncomeSelfEmployedYearly": 600000,
    "devaluations": [{"date": "2026-07-01", "change": "Lifetime free when applied through the Swiggy app (positive change)"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://book1a.com/apply/hdfc-bank/swiggy-ornge"],
    "notes": "SmartPay and SmartBuy transactions, and foreign-currency spends, earn no cashback."
  },
  {
    "key": "hdfc-swiggy-legacy", "bank": "HDFC", "name": "Swiggy HDFC (original)", "status": "closed-new",
    "networks": ["Mastercard"], "upi": false,
    "joiningFee": 500, "annualFee": 500, "feeWaiverSpend": 200000,
    "earnRule": "Cashback paid to Swiggy Money",
    "pointValue": {"best": 1.0, "cash": 1.0},
    "baseRate": 1.0, "baseRateCash": 1.0,
    "rules": [
      {"label": "Swiggy, Instamart, Dineout 10% (orders of ₹249+ from 17 Apr 2026)", "merchants": ["swiggy","instamart","dineout"], "categories": ["food-delivery"], "rate": 10.0, "capMonthly": 1500, "tracking": "merchant"},
      {"label": "Online partners 5% (Amazon, Flipkart, Nykaa, Uber and others)", "merchants": ["amazon","flipkart","nykaa","uber"], "categories": ["shopping-online"], "rate": 5.0, "capMonthly": 1500, "tracking": "online MCC list"},
      {"label": "Other spends 1%", "merchants": [], "categories": [], "rate": 1.0, "capMonthly": 500, "capNote": "₹500 cap, from memory", "tracking": "all"}
    ],
    "exclusions": ["fuel","rent","wallet","emi","government"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {"insurance": null},
    "milestones": [], "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": 15000, "minIncomeSelfEmployedYearly": 600000,
    "devaluations": [{"date": "2026-02-10", "change": "Closed to new applicants"}, {"date": "2026-04-17", "change": "Swiggy orders under ₹249 earn 1%"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://cardexpress.in/reviews/swiggy-hdfc"],
    "notes": "Keep for existing holders only; never recommend to new applicants."
  },
  {
    "key": "hdfc-tata-neu-infinity", "bank": "HDFC", "name": "Tata Neu Infinity", "status": "active",
    "networks": ["Visa", "RuPay"], "upi": true,
    "joiningFee": 1499, "annualFee": 1499, "feeWaiverSpend": 300000,
    "earnRule": "NeuCoins: 1 NeuCoin = ₹1 on Tata Neu",
    "pointValue": {"best": 1.0, "cash": null},
    "baseRate": 1.5, "baseRateCash": null,
    "rules": [
      {"label": "5% on Tata Neu app and partner Tata brands, Air India / AI Express, Tata Pay utilities", "merchants": ["tataneu","bigbasket","croma","tata1mg","tatacliq","westside","titan","tanishq","taj","airindia","airindiaexpress"], "categories": [], "rate": 5.0, "capMonthly": null, "capNote": "subject to fair usage; from 1 May 2026 must be paid with this card", "tracking": "Tata Neu app / partner merchant"},
      {"label": "UPI (RuPay): 0.5% on any UPI ID, 1.5% through a Tata Neu UPI ID", "merchants": ["tataneu-upi"], "categories": ["upi"], "rate": 1.5, "capMonthly": 500, "capNote": "500 NeuCoins per month", "tracking": "UPI handle"}
    ],
    "exclusions": ["fuel","rent","government","gaming","wallet","gift-vouchers","emi","education"],
    "reducedRate": {"upi": 0.5},
    "categoryCapsMonthlyRs": {"groceries": 2000, "insurance": 2000, "utilities": 2000, "telecom": 2000},
    "milestones": [{"spendQuarterly": 50000, "valueRs": null, "label": "2 domestic lounge vouchers after ₹50k spend in a quarter"}],
    "loungeDomesticYear": 8, "loungeIntlYear": 4, "loungeCondition": "Domestic: 2 vouchers a quarter after ₹50k spend in that quarter. International: 1 a quarter (Priority Pass on Visa).",
    "forexMarkup": 2.0, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": 100000, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-05-01", "change": "The 5% Neu bonus now needs payment with this card (CardExpress)"}],
    "verified": "2026-11-01", "confidence": "high",
    "sources": ["https://book1a.com/apply/hdfc-bank/tata-neu-infinity"],
    "notes": "The minimum income is from memory (low confidence). Direct education payments and the original merchant EMI purchase can earn."
  },
  {
    "key": "hdfc-tata-neu-plus", "bank": "HDFC", "name": "Tata Neu Plus", "status": "active",
    "networks": ["Visa", "RuPay"], "upi": true,
    "joiningFee": 499, "annualFee": 499, "feeWaiverSpend": 100000,
    "earnRule": "NeuCoins: 1 = ₹1",
    "pointValue": {"best": 1.0, "cash": null},
    "baseRate": 1.0, "baseRateCash": null,
    "rules": [
      {"label": "2% on Tata Neu and partner Tata brands", "merchants": ["tataneu","bigbasket","croma","tata1mg","tatacliq","westside","titan","tanishq","taj","airindiaexpress"], "categories": [], "rate": 2.0, "capMonthly": null, "tracking": "Tata Neu app / partner"},
      {"label": "UPI on RuPay (higher through a Tata Neu UPI ID)", "merchants": ["tataneu-upi"], "categories": ["upi"], "rate": 1.0, "capMonthly": 500, "capNote": "500 NeuCoins per month", "tracking": "UPI handle"}
    ],
    "exclusions": ["fuel","rent","government","wallet","gift-vouchers","emi"],
    "reducedRate": {},
    "categoryCapsMonthlyRs": {"insurance": 2000, "groceries": null, "utilities": null},
    "milestones": [],
    "loungeDomesticYear": 4, "loungeIntlYear": 0, "loungeCondition": "1 a quarter after ₹50k spend in that quarter",
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": 25000, "minIncomeSelfEmployedYearly": 600000,
    "devaluations": [],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://cardexpress.in/reviews/tata-neu-plus-hdfc"],
    "notes": "CardExpress says 7% on select Tata brands (2% card + 5% NeuPass bonus); the extra 5% is a Tata Neu membership benefit, not a card benefit. It also calls the card RuPay-only; the JSON lists Visa as well because a Visa variant historically existed."
  },
  {
    "key": "hdfc-irctc", "bank": "HDFC", "name": "IRCTC HDFC (RuPay)", "status": "active",
    "networks": ["RuPay"], "upi": true,
    "joiningFee": 500, "annualFee": 500, "feeWaiverSpend": 150000,
    "earnRule": "1 RP per ₹100; 1 RP = ₹1 on train tickets via SmartBuy only (up to 70% of the fare, ₹99 fee per redemption)",
    "pointValue": {"best": 1.0, "cash": null},
    "baseRate": 1.0, "baseRateCash": null,
    "rules": [
      {"label": "IRCTC through HDFC SmartBuy: 5% cashback + 5 RP per ₹100", "merchants": ["irctc","smartbuy"], "categories": ["travel"], "rate": 10.0, "capMonthly": 2000, "capNote": "each half capped at ₹1,000 a month", "tracking": "SmartBuy"},
      {"label": "IRCTC website / Rail Connect app: 5 RP per ₹100", "merchants": ["irctc"], "categories": ["travel"], "rate": 5.0, "capMonthly": 1000, "capNote": "1,000 RP a month", "tracking": "merchant"}
    ],
    "exclusions": ["fuel","rent","wallet","government","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {"insurance": 2000},
    "milestones": [{"spendQuarterly": 30000, "valueRs": 500, "label": "₹500 voucher each quarter (cards issued from 1 Oct 2025)"}],
    "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": "8 IRCTC executive railway lounge visits a year (max 2 a quarter); no airport lounges",
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": 25000, "minIncomeSelfEmployedYearly": 600000,
    "devaluations": [],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://cardexpress.in/reviews/hdfc-irctc"],
    "notes": "Points are only worth something for train tickets, so value general spend at 1% only for users who book trains. The exclusion list is the standard HDFC one (CardExpress lists none). Forex is the standard HDFC 3.5% (assumed)."
  },
  {
    "key": "hdfc-moneyback-plus", "bank": "HDFC", "name": "MoneyBack+", "status": "active",
    "networks": ["Visa", "Mastercard", "RuPay"], "upi": true,
    "joiningFee": 500, "annualFee": 500, "feeWaiverSpend": 50000,
    "earnRule": "2 CashPoints per ₹150 (CardExpress says per ₹200 from 15 May 2026; unconfirmed); 1 CP = ₹0.25",
    "pointValue": {"best": 0.25, "cash": 0.25},
    "baseRate": 0.33, "baseRateCash": 0.33,
    "rules": [
      {"label": "10X on Amazon, BigBasket, Flipkart, Reliance Smart SuperStore, Swiggy", "merchants": ["amazon","bigbasket","flipkart","reliancesmart","swiggy"], "categories": [], "rate": 3.33, "capMonthly": 625, "capNote": "2,500 CP a month", "tracking": "merchant"}
    ],
    "exclusions": ["fuel","rent","government","wallet","education","gaming"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {"insurance": 500},
    "milestones": [{"spendQuarterly": 50000, "valueRs": 500, "label": "₹500 voucher each quarter"}],
    "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": 20000, "minIncomeSelfEmployedYearly": 600000,
    "devaluations": [{"date": "2025-10-01", "change": "Insurance capped at 2,000 CP a month"}],
    "verified": "2026-11-01", "confidence": "low",
    "sources": ["https://cardexpress.in/reviews/hdfc-moneyback-plus"],
    "notes": "The partner list and 2,500 CP cap are from what I already knew, not a 2026 source. CardExpress contradicts itself on the base rate. Verify against the HDFC MoneyBack+ T&C."
  },
  {
    "key": "sbi-cashback", "bank": "SBI Card", "name": "Cashback SBI Card", "status": "active",
    "networks": ["Visa"], "upi": false,
    "joiningFee": 999, "annualFee": 999, "feeWaiverSpend": 200000,
    "earnRule": "Cashback credited automatically after the statement",
    "pointValue": {"best": 1.0, "cash": 1.0},
    "baseRate": 1.0, "baseRateCash": 1.0,
    "rules": [
      {"label": "5% on all online spends", "merchants": [], "categories": ["shopping-online"], "rate": 5.0, "capMonthly": 2000, "capNote": "₹2,000 per statement cycle (₹40k of spend)", "tracking": "online MCC / card-not-present"},
      {"label": "1% offline (point-of-sale)", "merchants": [], "categories": ["shopping"], "rate": 1.0, "capMonthly": 2000, "capNote": "₹2,000 per cycle; ₹4,000 overall per cycle", "tracking": "card-present"}
    ],
    "exclusions": ["fuel","rent","wallet","utilities","insurance","education","jewellery","government","emi","gaming","bills"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [],
    "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-04-01", "change": "Cap cut from ₹5,000 to ₹4,000 (₹2,000 online + ₹2,000 offline). Gaming (MCC 7993/7994/5816), tolls (4784) and government (9222/9311/9402) excluded."}],
    "verified": "2026-11-01", "confidence": "high",
    "sources": ["https://www.sbicard.com/sbi-card-en/assets/docs/pdf/cashback-revised.pdf", "https://book1a.com/apply/sbi-bank/cashback"],
    "notes": "Railways, gift shops and tolls are also excluded. The fuel surcharge waiver is 1% on ₹500–3,000 transactions. International spends count as online if they are card-not-present, but forex is 3.5%."
  },
  {
    "key": "sbi-simplyclick", "bank": "SBI Card", "name": "SimplyCLICK", "status": "active",
    "networks": ["Visa", "Mastercard"], "upi": false,
    "joiningFee": 499, "annualFee": 499, "feeWaiverSpend": 100000,
    "earnRule": "1 RP per ₹100 base; 10X partners; 5X other online; 4 RP = ₹1",
    "pointValue": {"best": 0.25, "cash": 0.25},
    "baseRate": 0.25, "baseRateCash": 0.25,
    "rules": [
      {"label": "10X on Apollo 24x7, BookMyShow, Cleartrip, Domino's, IGP, Myntra, Netmeds, Yatra", "merchants": ["apollo247","bookmyshow","cleartrip","dominos","igp","myntra","netmeds","yatra"], "categories": [], "rate": 2.5, "capMonthly": 2500, "capNote": "10,000 bonus RP a month (from memory; CardExpress says no cap)", "tracking": "partner merchant"},
      {"label": "5X on other online (Swiggy is 5X from 1 Apr 2025)", "merchants": ["swiggy"], "categories": ["shopping-online"], "rate": 1.25, "capMonthly": 2500, "capNote": "10,000 bonus RP a month (from memory)", "tracking": "online MCC"}
    ],
    "exclusions": ["fuel","rent","wallet","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [{"spendYearly": 100000, "valueRs": 2000, "label": "₹2,000 Cleartrip/Yatra voucher"}, {"spendYearly": 200000, "valueRs": 2000, "label": "another ₹2,000 voucher"}],
    "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2025-04-01", "change": "Swiggy cut from 10X to 5X"}, {"date": "2026-04-01", "change": "Statement credit capped at 60k RP a month, in multiples of 4,000"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://cardexpress.in/reviews/sbi-simplyclick", "https://www.businesstoday.in/personal-finance/banking/story/sbi-reduces-reward-points-on-simplyclick-air-india-credit-cards-from-these-dates-468387-2025-03-18"],
    "notes": "CardExpress lists Amazon as a 10X partner, but other sources disagree, so Amazon is left at 5X online here."
  },
  {
    "key": "sbi-simplysave", "bank": "SBI Card", "name": "SimplySAVE", "status": "active",
    "networks": ["Visa", "Mastercard", "RuPay"], "upi": true,
    "joiningFee": 499, "annualFee": 499, "feeWaiverSpend": 100000,
    "earnRule": "1 RP per ₹150; 10 RP per ₹150 on accelerated categories; 4 RP = ₹1",
    "pointValue": {"best": 0.25, "cash": 0.25},
    "baseRate": 0.17, "baseRateCash": 0.17,
    "rules": [
      {"label": "10X on dining, movies, departmental stores, grocery", "merchants": [], "categories": ["food","entertainment","groceries","shopping"], "rate": 1.67, "capMonthly": null, "capNote": "reported 5,000 bonus RP a month (₹1,250); unverified", "tracking": "MCC"}
    ],
    "exclusions": ["fuel","rent","wallet","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [],
    "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-04-01", "change": "SBI statement-credit redemption cap"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://www.sbicard.com/en/personal/credit-cards/shopping/simplysave-sbi-card.page"],
    "notes": "The 'shopping' category stands for departmental stores (MCC 5311). The UPI RuPay variant is called 'SimplySAVE UPI'."
  },
  {
    "key": "sbi-bpcl-octane", "bank": "SBI Card", "name": "BPCL SBI Card OCTANE", "status": "active",
    "networks": ["Visa"], "upi": false,
    "joiningFee": 1499, "annualFee": 1499, "feeWaiverSpend": 200000,
    "earnRule": "1 RP per ₹100 base; 25 RP per ₹100 at BPCL; 10 RP per ₹100 on accelerated categories; 4 RP = ₹1",
    "pointValue": {"best": 0.25, "cash": 0.25},
    "baseRate": 0.25, "baseRateCash": 0.25,
    "rules": [
      {"label": "BPCL fuel 25 RP per ₹100 (plus a 1% surcharge waiver up to ₹4,000 per transaction, ₹100 a cycle)", "merchants": ["bpcl"], "categories": ["fuel"], "rate": 6.25, "capMonthly": 625, "capNote": "2,500 RP per cycle (about ₹10k of fuel). One tracker says the cap became about ₹7k of fuel from 1 May 2026.", "tracking": "BPCL merchant ID; card swipe only, not RuPay UPI"},
      {"label": "Bharatgas (website/app) 25 RP per ₹100", "merchants": ["bharatgas"], "categories": ["utilities"], "rate": 6.25, "capMonthly": 125, "capNote": "500 RP per cycle", "tracking": "merchant"},
      {"label": "Dining, groceries, departmental stores, movies 10 RP per ₹100", "merchants": [], "categories": ["food","groceries","shopping","entertainment"], "rate": 2.5, "capMonthly": 1875, "capNote": "7,500 RP a month", "tracking": "MCC"}
    ],
    "exclusions": ["rent","wallet","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [{"spendYearly": 300000, "valueRs": 2000, "label": "₹2,000 e-voucher"}],
    "loungeDomesticYear": 4, "loungeIntlYear": 0, "loungeCondition": "1 a quarter; reduced participating-lounge list from 10 Jan 2026",
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-01-10", "change": "Fewer participating domestic lounges"}, {"date": "2026-05-01", "change": "Fuel cap cut to about ₹7k of spend (reported, conflicting)"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://book1a.com/apply/sbi-bank/bpcl-octane", "https://www.sbicard.com/sbi-card-en/assets/docs/pdf/loungebenefits.pdf"],
    "notes": "Non-BPCL fuel earns nothing. Treat BPCL as a merchant rule inside the 'fuel' category."
  },
  {
    "key": "sbi-elite", "bank": "SBI Card", "name": "SBI Card ELITE", "status": "active",
    "networks": ["Visa", "Mastercard"], "upi": false,
    "joiningFee": 4999, "annualFee": 4999, "feeWaiverSpend": 1000000,
    "earnRule": "2 RP per ₹100; 10 RP per ₹100 (5X) on dining, departmental stores, grocery; 4 RP = ₹1",
    "pointValue": {"best": 0.25, "cash": 0.25},
    "baseRate": 0.5, "baseRateCash": 0.5,
    "rules": [
      {"label": "5X on dining, departmental stores, grocery", "merchants": [], "categories": ["food","groceries","shopping"], "rate": 2.5, "capMonthly": 2500, "capNote": "10,000 RP a month per CardExpress (older terms said 7,500)", "tracking": "MCC"}
    ],
    "exclusions": ["fuel","rent","wallet","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [
      {"spendYearly": 300000, "valueRs": 2500, "label": "10,000 bonus RP"},
      {"spendYearly": 400000, "valueRs": 2500, "label": "+10,000 bonus RP"},
      {"spendYearly": 500000, "valueRs": 3750, "label": "+15,000 bonus RP"},
      {"spendYearly": 800000, "valueRs": 3750, "label": "+15,000 bonus RP"}
    ],
    "loungeDomesticYear": 8, "loungeIntlYear": 6, "loungeCondition": "Domestic: 2 a quarter. International: 6 a year on Priority Pass.",
    "forexMarkup": 1.99, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-04-01", "change": "Statement credit capped at 60k RP a month, in multiples of 4,000"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://cardexpress.in/reviews/sbi-elite"],
    "notes": "Also gives free movie tickets (₹6,000 a year, from memory). The Club Vistara and Trident memberships were discontinued."
  },
  {
    "key": "sbi-prime", "bank": "SBI Card", "name": "SBI Card PRIME", "status": "active",
    "networks": ["Visa", "Mastercard"], "upi": false,
    "joiningFee": 2999, "annualFee": 2999, "feeWaiverSpend": 300000,
    "earnRule": "2 RP per ₹100; 10 RP per ₹100 on dining, groceries, departmental stores, movies; 4 RP = ₹1",
    "pointValue": {"best": 0.25, "cash": 0.25},
    "baseRate": 0.5, "baseRateCash": 0.5,
    "rules": [
      {"label": "10 RP per ₹100 on dining, groceries, departmental stores, movies", "merchants": [], "categories": ["food","groceries","shopping","entertainment"], "rate": 2.5, "capMonthly": null, "capNote": "a cap may apply; not stated in sources read", "tracking": "MCC"}
    ],
    "exclusions": ["fuel","rent","wallet","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [
      {"spendQuarterly": 50000, "valueRs": 1000, "label": "₹1,000 Pizza Hut e-voucher each quarter"},
      {"spendYearly": 500000, "valueRs": 7000, "label": "₹7,000 Yatra/Pantaloons voucher"}
    ],
    "loungeDomesticYear": 8, "loungeIntlYear": 4, "loungeCondition": "Domestic: 2 a quarter at a reduced list of lounges from 10 Jan 2026 (one tracker says visits fell to 4 a year). International: 4 on Priority Pass.",
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-01-10", "change": "Domestic lounge list cut (₹2,999 fee cards)"}, {"date": "2026-04-01", "change": "Statement-credit redemption cap"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://cardexpress.in/cards/sbi-prime", "https://www.sbicard.com/sbi-card-en/assets/docs/pdf/loungebenefits.pdf"],
    "notes": "20 RP per ₹100 on your birthday (from memory, unverified)."
  },
  {
    "key": "sbi-flipkart", "bank": "SBI Card", "name": "Flipkart SBI Card", "status": "active",
    "networks": ["Visa", "Mastercard"], "upi": false,
    "joiningFee": 500, "annualFee": 500, "feeWaiverSpend": 350000,
    "earnRule": "Cashback",
    "pointValue": {"best": 1.0, "cash": 1.0},
    "baseRate": 1.0, "baseRateCash": 1.0,
    "rules": [
      {"label": "Myntra 7.5%", "merchants": ["myntra"], "categories": [], "rate": 7.5, "capMonthly": null, "capQuarterly": 4000, "tracking": "merchant"},
      {"label": "Flipkart, Shopsy, Cleartrip 5% (each has its own cap)", "merchants": ["flipkart","shopsy","cleartrip"], "categories": [], "rate": 5.0, "capMonthly": null, "capQuarterly": 4000, "capNote": "₹4,000 per calendar quarter per merchant", "tracking": "merchant"},
      {"label": "Preferred merchants 4% (Zomato, Uber, Netmeds, PVR)", "merchants": ["zomato","uber","netmeds","pvr"], "categories": [], "rate": 4.0, "capMonthly": null, "tracking": "merchant"}
    ],
    "exclusions": ["fuel","rent","wallet","utilities","insurance","education","government","jewellery","emi","gift-vouchers"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [], "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2025-08-26", "change": "Card launched"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://www.sbicard.com/sbi-card-en/assets/docs/pdf/who-we-are/news/2025/Business-Standard-20250827.pdf", "https://www.paisabazaar.com/sbi-bank/flipkart-sbi-credit-card/"],
    "notes": "The exclusion list is assumed to mirror the SBI Cashback card; verify it against the T&C."
  },
  {
    "key": "icici-amazon-pay", "bank": "ICICI", "name": "Amazon Pay ICICI", "status": "active",
    "networks": ["Visa"], "upi": false,
    "joiningFee": 0, "annualFee": 0, "feeWaiverSpend": null,
    "earnRule": "Rewards paid to the Amazon Pay balance, 1 point = ₹1",
    "pointValue": {"best": 1.0, "cash": 1.0},
    "baseRate": 1.0, "baseRateCash": 1.0,
    "rules": [
      {"label": "Amazon.in 5% for Prime members (3% for non-Prime)", "merchants": ["amazon"], "categories": [], "rate": 5.0, "capMonthly": null, "tracking": "merchant; set the rate to 3 for non-Prime users"},
      {"label": "2% on Amazon Pay partner merchants and on bills/recharges paid on Amazon", "merchants": ["amazonpay"], "categories": ["bills"], "rate": 2.0, "capMonthly": null, "tracking": "Amazon Pay"}
    ],
    "exclusions": ["fuel","jewellery","government","rent","emi","education","utilities","cash"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [], "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": 1.99, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": 30000, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2025-10-11", "change": "Education, international and non-Amazon utility spends stop earning"}],
    "verified": "2026-11-01", "confidence": "high",
    "sources": ["https://book1a.com/apply/icici-bank/amazon-pay"],
    "notes": "International spends earn nothing even though forex is only 1.99%. Utilities paid on Amazon earn 2%; elsewhere they earn 0."
  },
  {
    "key": "icici-coral-rupay", "bank": "ICICI", "name": "Coral RuPay", "status": "active",
    "networks": ["RuPay"], "upi": true,
    "joiningFee": 500, "annualFee": 500, "feeWaiverSpend": 150000,
    "earnRule": "2 RP per ₹100 (UPI earns the same as card swipes); 1 RP per ₹100 on utilities and insurance; RP valued at ₹0.25",
    "pointValue": {"best": 0.25, "cash": 0.25},
    "baseRate": 0.5, "baseRateCash": 0.5,
    "rules": [],
    "exclusions": ["fuel","rent","wallet","government"],
    "reducedRate": {"utilities": 0.25, "insurance": 0.25},
    "categoryCapsMonthlyRs": {},
    "milestones": [{"spendYearly": 100000, "valueRs": 250, "label": "1,000 RP for each ₹1L spend in a year (max 10,000 RP)"}],
    "loungeDomesticYear": 4, "loungeIntlYear": 0, "loungeCondition": "1 a quarter after a spend threshold in the previous quarter (₹75k per CardExpress, unverified; ICICI's older rule was ₹35k)",
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": 20000, "minIncomeSelfEmployedYearly": 240000,
    "devaluations": [{"date": "2026-01-15", "change": "ICICI-wide fees: 1% on wallet loads of ₹5k+, 2% on gaming, 1% on transport above ₹50k"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://www.icici.bank.in/personal-banking/cards/credit-card/coral-rupay-card", "https://cardexpress.in/reviews/icici-coral"],
    "notes": "Fuel paid by UPI earns nothing. The fuel surcharge waiver applies at HPCL only."
  },
  {
    "key": "icici-sapphiro", "bank": "ICICI", "name": "Sapphiro", "status": "active",
    "networks": ["Visa", "Mastercard"], "upi": false,
    "joiningFee": 6500, "annualFee": 3500, "feeWaiverSpend": 600000,
    "earnRule": "2 RP per ₹100 domestic; 4 RP per ₹100 international; RP valued at ₹0.25",
    "pointValue": {"best": 0.25, "cash": 0.25},
    "baseRate": 0.5, "baseRateCash": 0.5,
    "rules": [
      {"label": "International spends 4 RP per ₹100", "merchants": [], "categories": ["travel"], "rate": 1.0, "capMonthly": null, "tracking": "foreign-currency transactions (markup 3.5%)"}
    ],
    "exclusions": ["fuel","rent","wallet","government"],
    "reducedRate": {"utilities": 0.25, "insurance": 0.25},
    "categoryCapsMonthlyRs": {},
    "milestones": [{"spendYearly": 400000, "valueRs": 1000, "label": "4,000 bonus RP, then 2,000 RP for each further ₹1L"}],
    "loungeDomesticYear": 16, "loungeIntlYear": 2, "loungeCondition": "Domestic: 4 a quarter after ₹75k spend in the previous quarter (CardExpress). International: 2 a year.",
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-01-15", "change": "ICICI-wide fees on wallet, gaming and transport"}],
    "verified": "2026-11-01", "confidence": "low",
    "sources": ["https://cardexpress.in/reviews/icici-sapphiro"],
    "notes": "International earn is tagged 'travel' for lack of an 'international' category key; the engine should treat it as a foreign-currency flag. The utilities/insurance reduced rate is assumed from Coral. CardExpress's ₹75k/month salaried income figure looks wrong and is left null."
  },
  {
    "key": "icici-emeralde-private", "bank": "ICICI", "name": "Emeralde Private Metal", "status": "active",
    "networks": ["Mastercard"], "upi": false,
    "joiningFee": 12499, "annualFee": 12499, "feeWaiverSpend": 1000000,
    "earnRule": "6 RP per ₹200; ₹1 per RP on flights, hotels, premium vouchers; ₹0.40 per RP statement credit (max 50k RP a cycle)",
    "pointValue": {"best": 1.0, "cash": 0.40},
    "baseRate": 3.0, "baseRateCash": 1.2,
    "rules": [
      {"label": "iShop hotels 12X", "merchants": ["ishop"], "categories": ["hotels"], "rate": 36.0, "capMonthly": 18000, "capNote": "18,000 bonus RP a month and 10,000 a day", "tracking": "ICICI iShop portal"},
      {"label": "iShop flights and vouchers 6X", "merchants": ["ishop"], "categories": ["flights"], "rate": 18.0, "capMonthly": 18000, "capNote": "shares the iShop bonus cap", "tracking": "iShop"}
    ],
    "exclusions": ["government","rent","wallet","fuel"],
    "reducedRate": {},
    "categoryCapsMonthlyRs": {"groceries": 1000, "education": 1000, "utilities": 1000, "insurance": 5000},
    "milestones": [{"spendYearly": 400000, "valueRs": 3000, "label": "₹3,000 EaseMyTrip voucher"}, {"spendYearly": 800000, "valueRs": 3000, "label": "another ₹3,000 EaseMyTrip voucher"}],
    "loungeDomesticYear": 99, "loungeIntlYear": 99, "loungeCondition": "Unlimited, including add-on cards",
    "forexMarkup": 2.0, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-01-15", "change": "Accelerated rewards on some iShop vouchers removed; ICICI-wide fees"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://book1a.com/apply/icici-bank/emeralde-private"],
    "notes": "Caps are per statement (RP at ₹1). The insurance cap could be 5,000 or 1,000; the issuer PDF itself conflicts. Invite-only."
  },
  {
    "key": "axis-flipkart", "bank": "Axis", "name": "Flipkart Axis Bank", "status": "active",
    "networks": ["Visa", "Mastercard"], "upi": false,
    "joiningFee": 500, "annualFee": 500, "feeWaiverSpend": 350000,
    "earnRule": "Cashback",
    "pointValue": {"best": 1.0, "cash": 1.0},
    "baseRate": 1.0, "baseRateCash": 1.0,
    "rules": [
      {"label": "Myntra 7.5%", "merchants": ["myntra"], "categories": [], "rate": 7.5, "capMonthly": null, "capQuarterly": 4000, "tracking": "merchant"},
      {"label": "Flipkart 5%", "merchants": ["flipkart"], "categories": [], "rate": 5.0, "capMonthly": null, "capQuarterly": 4000, "tracking": "merchant"},
      {"label": "Cleartrip 5%", "merchants": ["cleartrip"], "categories": [], "rate": 5.0, "capMonthly": null, "capQuarterly": 4000, "tracking": "merchant"},
      {"label": "Preferred merchants 4% (Swiggy food delivery, Uber, PVR, cult.fit; check the current list)", "merchants": ["swiggy","uber","pvr","cultfit"], "categories": [], "rate": 4.0, "capMonthly": null, "tracking": "merchant list; Swiggy Instamart excluded"}
    ],
    "exclusions": ["fuel","utilities","telecom","jewellery","insurance","rent","wallet","education","government","emi","gift-vouchers"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [], "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [],
    "verified": "2026-11-01", "confidence": "high",
    "sources": ["https://book1a.com/apply/axis-bank/flipkart"],
    "notes": "First year free under an offer valid until 31 Oct 2026. Gift cards bought on Flipkart or Myntra earn nothing."
  },
  {
    "key": "axis-ace", "bank": "Axis", "name": "ACE", "status": "paused?",
    "networks": ["Visa"], "upi": false,
    "joiningFee": 499, "annualFee": 499, "feeWaiverSpend": 200000,
    "earnRule": "Cashback",
    "pointValue": {"best": 1.0, "cash": 1.0},
    "baseRate": 1.5, "baseRateCash": 1.5,
    "rules": [
      {"label": "5% on electricity, internet, gas, DTH, mobile recharges paid through Google Pay", "merchants": ["googlepay"], "categories": ["bills","utilities","telecom"], "rate": 5.0, "capMonthly": 500, "capNote": "₹500 per statement cycle, shared with the 4% rule", "tracking": "Google Pay bill payments (Android)"},
      {"label": "4% on Swiggy, Zomato, Ola", "merchants": ["swiggy","zomato","ola"], "categories": [], "rate": 4.0, "capMonthly": 500, "capNote": "shares the ₹500 cap", "tracking": "merchant"}
    ],
    "exclusions": ["fuel","rent","wallet","insurance","jewellery","education","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [],
    "loungeDomesticYear": 4, "loungeIntlYear": 0, "loungeCondition": "After ₹50k spend in the previous quarter",
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://cardexpress.in/reviews/axis-ace", "https://www.axis.bank.in/docs/default-source/default-document-library/credit-card/axis-bank-ace-credit-card-tncs.pdf"],
    "notes": "Some 2026 sources say new applications are paused. The exclusion list is from what I already knew. Axis charges a 1% fee on utilities above ₹25k a cycle."
  },
  {
    "key": "axis-myzone", "bank": "Axis", "name": "MY Zone", "status": "active",
    "networks": ["Visa", "RuPay"], "upi": true,
    "joiningFee": 500, "annualFee": 500, "feeWaiverSpend": null,
    "earnRule": "4 EDGE RP per ₹200; ₹0.20 per point",
    "pointValue": {"best": 0.2, "cash": 0.2},
    "baseRate": 0.4, "baseRateCash": 0.4,
    "rules": [
      {"label": "Swiggy ₹120 off orders of ₹500+, twice a month", "merchants": ["swiggy"], "categories": ["food-delivery"], "rate": null, "capMonthly": 240, "tracking": "coupon code"},
      {"label": "District movies buy 1 get 1, up to ₹200 a month", "merchants": ["district"], "categories": ["entertainment"], "rate": null, "capMonthly": 200, "capNote": "from 28 Aug 2026 needs ₹25k spend in the previous 3 months (reported)", "tracking": "District app code"}
    ],
    "exclusions": ["fuel","rent","wallet","utilities","insurance","government","gift-vouchers"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [],
    "loungeDomesticYear": 4, "loungeIntlYear": 0, "loungeCondition": "1 a quarter; any spend condition unverified",
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-04-01", "change": "SonyLIV renewal benefit replaced by 1,000 EDGE points (reported)"}],
    "verified": "2026-11-01", "confidence": "low",
    "sources": ["https://axis.bank.in/cards/credit-card/axis-bank-my-zone-credit-card"],
    "notes": "This is a discount card: put its fixed-₹ offers in a separate offers engine, not in percentage rules. The exclusion list is assumed to match Axis Neo."
  },
  {
    "key": "axis-neo", "bank": "Axis", "name": "Neo", "status": "active",
    "networks": ["Visa", "Mastercard", "RuPay"], "upi": true,
    "joiningFee": 250, "annualFee": 250, "feeWaiverSpend": null,
    "earnRule": "1 EDGE RP per ₹200; ₹0.20 per point",
    "pointValue": {"best": 0.2, "cash": 0.2},
    "baseRate": 0.1, "baseRateCash": 0.1,
    "rules": [
      {"label": "Zomato ₹120 off orders of ₹499+, twice a month", "merchants": ["zomato"], "categories": ["food-delivery"], "rate": null, "capMonthly": 240, "tracking": "coupon"},
      {"label": "Blinkit 10% off up to ₹250 (minimum ₹750), once a month", "merchants": ["blinkit"], "categories": ["groceries"], "rate": 10.0, "capMonthly": 250, "tracking": "coupon"},
      {"label": "Paytm utilities 5% off up to ₹150, once a month", "merchants": ["paytm"], "categories": ["utilities"], "rate": 5.0, "capMonthly": 150, "tracking": "coupon"},
      {"label": "BookMyShow 10% off up to ₹100 a month", "merchants": ["bookmyshow"], "categories": ["entertainment"], "rate": 10.0, "capMonthly": 100, "capNote": "from Aug 2026 needs ₹25k spend in the previous 3 months (reported)", "tracking": "coupon"}
    ],
    "exclusions": ["fuel","rent","utilities","education","government","insurance","wallet","gift-vouchers"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [], "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://book1a.com/apply/axis-bank/neo"],
    "notes": "First year free; lifetime free through some application channels. Forex is the standard Axis 3.5% (assumed)."
  },
  {
    "key": "axis-atlas", "bank": "Axis", "name": "Atlas", "status": "active",
    "networks": ["Visa"], "upi": false,
    "joiningFee": 5000, "annualFee": 5000, "feeWaiverSpend": null,
    "earnRule": "2 EDGE Miles per ₹100; 5 per ₹100 on travel up to ₹2L a month; 1 mile = ₹1 on Travel EDGE or 1:2 to most transfer partners",
    "pointValue": {"best": 1.0, "cash": null},
    "baseRate": 2.0, "baseRateCash": null,
    "rules": [
      {"label": "Travel 5 miles per ₹100 (airlines, hotels, Travel EDGE)", "merchants": ["traveledge"], "categories": ["travel","flights","hotels"], "rate": 5.0, "capMonthly": null, "capNote": "accelerated on the first ₹2L of travel spend a month; 2 miles per ₹100 above that", "tracking": "airline/hotel MCC + Travel EDGE"}
    ],
    "exclusions": ["jewellery","rent","insurance","government","utilities","telecom","fuel","wallet","gift-vouchers"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [
      {"spendYearly": 300000, "valueRs": 2500, "label": "2,500 EDGE Miles"},
      {"spendYearly": 750000, "valueRs": 2500, "label": "2,500 EDGE Miles"},
      {"spendYearly": 1500000, "valueRs": 5000, "label": "5,000 EDGE Miles"}
    ],
    "loungeDomesticYear": 8, "loungeIntlYear": 4, "loungeCondition": "Silver tier. Gold: 12 domestic, 6 international. Platinum: 18 domestic, 12 international.",
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-04-02", "change": "Marriott, Accor and Qatar transfers removed (Accor later returned at half value)"}, {"date": "2026-08-28", "change": "Tolls stop earning; DCC fee; lounge booking changes"}],
    "verified": "2026-11-01", "confidence": "high",
    "sources": ["https://book1a.com/apply/axis-bank/atlas"],
    "notes": "Transfer caps per year: Group A 30k, Group B 1.2L, 1.5L total. Tolls are excluded."
  },
  {
    "key": "axis-magnus", "bank": "Axis", "name": "Magnus", "status": "active",
    "networks": ["Visa", "Mastercard"], "upi": false,
    "joiningFee": 12500, "annualFee": 12500, "feeWaiverSpend": 2500000,
    "earnRule": "12 EDGE RP per ₹200 up to ₹1.5L a month; 35 per ₹200 above that; transfer 5:2 to partners; ₹0.20 per point on vouchers or Travel EDGE",
    "pointValue": {"best": 0.4, "cash": 0.2},
    "baseRate": 2.4, "baseRateCash": 1.2,
    "rules": [
      {"label": "Spend above ₹1.5L in a calendar month: 35 ER per ₹200", "merchants": [], "categories": [], "rate": 7.0, "capMonthly": null, "capNote": "applies to incremental spend only; cap linked to the credit limit", "tracking": "monthly spend tier"},
      {"label": "Travel EDGE 5X", "merchants": ["traveledge"], "categories": ["flights","hotels"], "rate": 12.0, "capMonthly": null, "capNote": "on up to ₹2L a month", "tracking": "Axis Travel EDGE"}
    ],
    "exclusions": ["fuel","utilities","telecom","wallet","gift-vouchers","government","insurance","jewellery"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [],
    "loungeDomesticYear": 99, "loungeIntlYear": 99, "loungeCondition": "Unlimited. From 28 Aug 2026, domestic access is with the card itself, not Priority Pass.",
    "forexMarkup": 2.0, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-04-02", "change": "Transfer partner changes"}, {"date": "2026-08-28", "change": "2% DCC fee; Priority Pass domestic access ends; tolls excluded"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://book1a.com/apply/axis-bank/magnus-burgundy", "https://savesage.club/blogs/all-major-credit-card-devaluations"],
    "notes": "The regular Magnus earn rule and 5:2 ratio are from what I already knew (the Sept 2024 restructure); no 2026 page for the regular card was readable. Rent earns only up to ₹50k a month."
  },
  {
    "key": "axis-magnus-burgundy", "bank": "Axis", "name": "Magnus for Burgundy", "status": "active",
    "networks": ["Visa"], "upi": false,
    "joiningFee": 30000, "annualFee": 30000, "feeWaiverSpend": 3000000,
    "earnRule": "12 ER per ₹200 up to ₹1.5L a month; 35 per ₹200 above that; Travel EDGE 60 per ₹200 up to ₹2L; transfer 5:4 (5:2 for Accor, BA, Qatar and others)",
    "pointValue": {"best": 0.8, "cash": 0.2},
    "baseRate": 4.8, "baseRateCash": 1.2,
    "rules": [
      {"label": "Spend above ₹1.5L in a month: 35 ER per ₹200", "merchants": [], "categories": [], "rate": 14.0, "capMonthly": null, "capNote": "incremental spend; credit-limit-linked cap", "tracking": "monthly tier"},
      {"label": "Travel EDGE 60 ER per ₹200", "merchants": ["traveledge"], "categories": ["flights","hotels"], "rate": 24.0, "capMonthly": null, "capNote": "on up to ₹2L a month", "tracking": "Axis Travel EDGE"}
    ],
    "exclusions": ["fuel","utilities","telecom","wallet","gift-vouchers","government","insurance","jewellery"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [],
    "loungeDomesticYear": 99, "loungeIntlYear": 99, "loungeCondition": "Unlimited for the primary cardholder; Priority Pass domestic access ended 28 Aug 2026",
    "forexMarkup": 2.0, "fuelSurchargeWaiver": null,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-04-02", "change": "Transfer partner changes"}, {"date": "2026-08-28", "change": "2% DCC fee; Priority Pass domestic access ended"}, {"date": "2026-11-15", "change": "Programme renewal needs explicit consent"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://book1a.com/apply/axis-bank/magnus-burgundy"],
    "notes": "Only for Axis Burgundy (wealth) relationship customers. Rent earns only up to ₹50k a month."
  },
  {
    "key": "axis-airtel", "bank": "Axis", "name": "Airtel Axis Bank", "status": "active",
    "networks": ["Mastercard"], "upi": false,
    "joiningFee": 500, "annualFee": 500, "feeWaiverSpend": 200000,
    "earnRule": "Cashback; the Airtel and utility caps scale with the base cashback earned that month",
    "pointValue": {"best": 1.0, "cash": 1.0},
    "baseRate": 1.0, "baseRateCash": 1.0,
    "rules": [
      {"label": "Airtel mobile, broadband, DTH bills in the Airtel Thanks app 25%", "merchants": ["airtel"], "categories": ["telecom"], "rate": 25.0, "capMonthly": null, "capNote": "capped at 2× that month's base (1%) cashback; ₹0 if there is no general spend", "tracking": "Airtel Thanks app"},
      {"label": "Electricity, gas, water in the Airtel Thanks app 10%", "merchants": ["airtel"], "categories": ["utilities"], "rate": 10.0, "capMonthly": null, "capNote": "capped at 1× that month's base cashback", "tracking": "Airtel Thanks app"},
      {"label": "Zomato, Blinkit, District 10% (minimum order ₹499)", "merchants": ["zomato","blinkit","district"], "categories": [], "rate": 10.0, "capMonthly": 600, "capNote": "₹200 per partner per month, credited to the partner's wallet", "tracking": "merchant"}
    ],
    "exclusions": ["fuel","rent","wallet","insurance","government","education","jewellery","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [], "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": "Lounge access removed 12 Apr 2026",
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-04-12", "change": "Swiggy and BigBasket removed; Zomato, Blinkit, District capped at ₹200 each; Airtel and utility caps now scale with base cashback; lounge removed"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://cardexpress.in/reviews/airtel-axis", "https://savesage.club/blogs/axis-airtel-credit-card-devaluation-from-april-2026"],
    "notes": "Model the Airtel and utility caps as dynamic: cap = 2 × (1% × eligible general spend) for Airtel, and 1 × that for utilities. The network and exclusions are from what I already knew."
  },
  {
    "key": "idfc-first-select", "bank": "IDFC FIRST", "name": "FIRST Select", "status": "active",
    "networks": ["Visa"], "upi": false,
    "joiningFee": 0, "annualFee": 0, "feeWaiverSpend": null,
    "earnRule": "3 RP per ₹200 on the first ₹20k a month; 10 RP per ₹200 on incremental spend above that; 1X on FASTag, railway, utilities, insurance; RP = ₹0.25",
    "pointValue": {"best": 0.25, "cash": 0.25},
    "baseRate": 0.375, "baseRateCash": 0.375,
    "rules": [
      {"label": "10X on monthly spend above ₹20k (and on your birthday)", "merchants": [], "categories": [], "rate": 1.25, "capMonthly": null, "capNote": "rewards capped at the credit limit per cycle (from 18 Jun 2026)", "tracking": "monthly spend tier"}
    ],
    "exclusions": ["fuel","emi","cash"],
    "reducedRate": {"insurance": 0.125, "utilities": 0.125, "travel": 0.125},
    "categoryCapsMonthlyRs": {},
    "milestones": [],
    "loungeDomesticYear": 4, "loungeIntlYear": 0, "loungeCondition": "1 a quarter after ₹20k spend in the previous month (from Apr 2026)",
    "forexMarkup": 0.0, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": 100000, "minIncomeSelfEmployedYearly": 1200000,
    "devaluations": [{"date": "2026-01-18", "change": "Earn basis moved from per ₹150 to per ₹200; FASTag and railway 1X"}, {"date": "2026-04-01", "change": "Lounge halved to 1 a quarter"}, {"date": "2026-09-09", "change": "Forex markup cut to 0% (positive)"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://www.idfcfirst.bank.in/content/dam/idfcfirstbank/pdf/credit-card/Select-Credit-Card.pdf", "https://cardexpress.in/reviews/idfc-first-select", "https://livefromalounge.com/idfc-first-bank-removes-forex-markup-from-all-credit-cards-immediately/"],
    "notes": "'travel' in reducedRate stands for railway/FASTag (MCC 4112/4784). Select may have moved to category 10X on 18 Jun 2026 like Millennia; unverified. Education and wallet earn 3X."
  },
  {
    "key": "idfc-first-wealth", "bank": "IDFC FIRST", "name": "FIRST Wealth", "status": "active",
    "networks": ["Visa"], "upi": false,
    "joiningFee": 0, "annualFee": 0, "feeWaiverSpend": null,
    "earnRule": "3 RP per ₹200; 10 RP per ₹200 on dining, travel, international (no threshold from 18 Jun 2026); 1X on utilities, insurance, railway, FASTag",
    "pointValue": {"best": 0.25, "cash": 0.25},
    "baseRate": 0.375, "baseRateCash": 0.375,
    "rules": [
      {"label": "10X on dining (MCC 5812–5814), travel, international", "merchants": [], "categories": ["food","food-delivery","travel","flights","hotels"], "rate": 1.25, "capMonthly": null, "capNote": "rewards capped at the credit limit per cycle", "tracking": "MCC"}
    ],
    "exclusions": ["fuel","emi","cash"],
    "reducedRate": {"insurance": 0.125, "utilities": 0.125},
    "categoryCapsMonthlyRs": {},
    "milestones": [],
    "loungeDomesticYear": 4, "loungeIntlYear": 4, "loungeCondition": "1 domestic + 1 international a quarter after ₹20k spend in the previous month",
    "forexMarkup": 0.0, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": 300000, "minIncomeSelfEmployedYearly": 3600000,
    "devaluations": [{"date": "2026-01-18", "change": "Per ₹150 to per ₹200; 10X threshold ₹30k to ₹20k; lounge 2 to 1 a quarter"}, {"date": "2026-06-18", "change": "Points expire after 24 months; credit-limit reward cap; 10X categories need no threshold"}, {"date": "2026-09-09", "change": "Forex 0%"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://www.idfcfirst.bank.in/content/dam/idfcfirstbank/pdf/credit-card/Wealth-1-Credit-Card.pdf", "https://savesage.club/blogs/idfc-first-credit-card-devaluation", "https://cardexpress.in/reviews/idfc-wealth"],
    "notes": "The June 2026 category structure is inferred from SaveSage plus the Millennia notice. Whether Wealth still gives 10X on all spend above ₹20k is unclear."
  },
  {
    "key": "idfc-first-millennia", "bank": "IDFC FIRST", "name": "FIRST Millennia", "status": "active",
    "networks": ["Visa"], "upi": false,
    "joiningFee": 0, "annualFee": 0, "feeWaiverSpend": null,
    "earnRule": "10X on dining, travel, international from the first rupee; 3X on everything else; 1X on insurance, utilities, railways, FASTag (per ₹200 assumed after the Jan 2026 change); RP = ₹0.25",
    "pointValue": {"best": 0.25, "cash": 0.25},
    "baseRate": 0.375, "baseRateCash": 0.375,
    "rules": [
      {"label": "10X on dining incl. food delivery (MCC 5812/5813/5814), travel (MCC 3000–3350, 3501–3853, 7011, 4511, 4722, 4723), international", "merchants": [], "categories": ["food","food-delivery","travel","flights","hotels"], "rate": 1.25, "capMonthly": null, "capNote": "rewards capped at the credit limit per cycle", "tracking": "MCC"},
      {"label": "Hotels/flights booked in the IDFC app: +20% / +10% bonus RP", "merchants": ["idfcfirst-app"], "categories": ["hotels","flights"], "rate": 1.5, "capMonthly": null, "tracking": "IDFC app"}
    ],
    "exclusions": ["fuel","emi","cash"],
    "reducedRate": {"insurance": 0.125, "utilities": 0.125},
    "categoryCapsMonthlyRs": {},
    "milestones": [],
    "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": "4 railway lounge visits a quarter after ₹20k spend in the previous month; no airport lounges",
    "forexMarkup": 0.0, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": 25000, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-01-18", "change": "Per ₹150 to per ₹200 (assumed to apply to Millennia, as it did to the other LTF cards)"}, {"date": "2026-06-18", "change": "10X on dining, travel, international with no threshold; 24-month expiry; credit-limit cap"}, {"date": "2026-09-09", "change": "Forex 0%"}],
    "verified": "2026-11-01", "confidence": "high",
    "sources": ["https://www.idfcfirst.bank.in/content/dam/idfcfirstbank/pdf/credit-card/FIRST-Millennia-Credit-Card-Communication-May-26.pdf"],
    "notes": "UPI (FIRST Digital variant): 1X up to ₹2,000 per transaction, 3X above. Fuel surcharge waiver up to ₹200 a month. The minimum income is from memory (low)."
  },
  {
    "key": "idfc-first-power-plus", "bank": "IDFC FIRST", "name": "FIRST Power+ (HPCL)", "status": "active",
    "networks": ["RuPay"], "upi": true,
    "joiningFee": 499, "annualFee": 499, "feeWaiverSpend": 150000,
    "earnRule": "3X per ₹150 base; 30X per ₹150 at HPCL; RP = ₹0.25",
    "pointValue": {"best": 0.25, "cash": 0.25},
    "baseRate": 0.5, "baseRateCash": 0.5,
    "rules": [
      {"label": "HPCL fuel 5% (6.5% via HP Pay including Happy Coins)", "merchants": ["hpcl"], "categories": ["fuel"], "rate": 5.0, "capMonthly": 600, "capNote": "2,400 RP a month (about ₹12k of fuel)", "tracking": "HPCL merchant IDs registered with IDFC"},
      {"label": "Grocery and utilities 5%", "merchants": [], "categories": ["groceries","utilities"], "rate": 5.0, "capMonthly": 100, "capNote": "400 RP a month", "tracking": "MCC"},
      {"label": "IDFC FASTag recharge 5%", "merchants": ["idfc-fastag"], "categories": [], "rate": 5.0, "capMonthly": 50, "tracking": "IDFC app"}
    ],
    "exclusions": ["emi","cash","insurance"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [],
    "loungeDomesticYear": 4, "loungeIntlYear": 0, "loungeCondition": "1 a quarter after ₹20k monthly spend",
    "forexMarkup": 0.0, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-01-18", "change": "IDFC-wide cut (the basis shown by CardExpress may still be per ₹150; verify)"}, {"date": "2026-06-18", "change": "Credit-limit reward cap; movie offer needs activity in the previous month"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://cardexpress.in/reviews/idfc-power-plus", "https://www.idfcfirst.bank.in/content/dam/idfcfirstbank/pdf/FIRST-Power-plus-Product-Guide-26th-Sept.pdf"],
    "notes": "Transactions under ₹150 earn nothing. 1% fee on fuel above ₹30k a cycle."
  },
  {
    "key": "au-lit", "bank": "AU SFB", "name": "LIT", "status": "active",
    "networks": ["Visa", "RuPay"], "upi": null,
    "joiningFee": 0, "annualFee": 0, "feeWaiverSpend": null,
    "earnRule": "1 RP per ₹100; paid add-on gives 10X on one chosen online or offline sub-category for 90 days; RP value not published (₹0.25 assumed)",
    "pointValue": {"best": 0.25, "cash": 0.25},
    "baseRate": 0.25, "baseRateCash": 0.25,
    "rules": [
      {"label": "Paid feature: 10X on a chosen online or offline sub-category", "merchants": [], "categories": [], "rate": 2.5, "capMonthly": null, "capNote": "cap per 90-day cycle, amount not stated; feature costs from ₹49 per 90 days", "tracking": "opt-in feature"}
    ],
    "exclusions": ["rent","fuel","education"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {"utilities": null},
    "milestones": [], "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": "Paid add-on only",
    "forexMarkup": 3.49, "fuelSurchargeWaiver": false,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-07-01", "change": "1% fuel fair-usage fee once fuel exceeds ₹25k a month or ₹10k in one transaction"}],
    "verified": "2026-11-01", "confidence": "low",
    "sources": ["https://cardexpress.in/reviews/au-lit"],
    "notes": "Utilities earn 1 RP per ₹100, capped at 100 RP per transaction. The fuel surcharge waiver is a paid add-on. The networks are from memory."
  },
  {
    "key": "au-altura", "bank": "AU SFB", "name": "Altura", "status": "active",
    "networks": ["Visa", "RuPay"], "upi": null,
    "joiningFee": 199, "annualFee": 199, "feeWaiverSpend": 40000,
    "earnRule": "Cashback",
    "pointValue": {"best": 1.0, "cash": 1.0},
    "baseRate": 1.0, "baseRateCash": 1.0,
    "rules": [
      {"label": "2% on groceries, departmental stores, utility bills", "merchants": [], "categories": ["groceries","shopping","utilities"], "rate": 2.0, "capMonthly": null, "capNote": "AU publishes no cap (CardExpress); I recall ₹50 per statement, unverified", "tracking": "MCC"}
    ],
    "exclusions": ["rent","education","fuel"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [{"spendMonthly": 10000, "valueRs": 50, "label": "₹50 cashback each statement cycle with ₹10k spend"}],
    "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": "8 railway lounge visits a year; no airport lounges",
    "forexMarkup": 3.49, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-07-01", "change": "1% fuel fair-usage fee"}],
    "verified": "2026-11-01", "confidence": "low",
    "sources": ["https://cardexpress.in/reviews/au-altura"],
    "notes": "1% fee on utilities above ₹50k a month."
  },
  {
    "key": "indusind-tiger", "bank": "IndusInd", "name": "Tiger", "status": "active",
    "networks": ["Visa"], "upi": false,
    "joiningFee": 0, "annualFee": 0, "feeWaiverSpend": null,
    "earnRule": "1 RP per ₹100 base; multiplier by yearly spend slab (1X to ₹1L, 2X on the next ₹1.5L, 4X on the next ₹2.5L, 6X above ₹5L); 1 RP = 1 Maharaja Point or ₹0.40 cash",
    "pointValue": {"best": 1.0, "cash": 0.4},
    "baseRate": 1.0, "baseRateCash": 0.4,
    "rules": [
      {"label": "Yearly spend ₹1L–2.5L: 2X", "merchants": [], "categories": [], "rate": 2.0, "capMonthly": null, "tracking": "anniversary-year spend slab"},
      {"label": "Yearly spend ₹2.5L–5L: 4X", "merchants": [], "categories": [], "rate": 4.0, "capMonthly": null, "tracking": "spend slab"},
      {"label": "Yearly spend above ₹5L: 6X", "merchants": [], "categories": [], "rate": 6.0, "capMonthly": null, "tracking": "spend slab"}
    ],
    "exclusions": ["fuel","emi"],
    "reducedRate": {"utilities": 1.0, "insurance": 1.0, "government": 1.0, "education": 1.0, "rent": 1.0},
    "categoryCapsMonthlyRs": {},
    "milestones": [],
    "loungeDomesticYear": 8, "loungeIntlYear": 2, "loungeCondition": "Domestic up to 2 a quarter; international on Priority Pass",
    "forexMarkup": 1.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://book1a.com/apply/indusind-bank/tiger"],
    "notes": "The slab rates are for each slab, not blended. reducedRate means these categories never get the multiplier (they earn base only). Cash redemption max 5,000 RP a month. The network is from memory."
  },
  {
    "key": "indusind-legend", "bank": "IndusInd", "name": "Legend", "status": "active",
    "networks": ["Visa"], "upi": false,
    "joiningFee": 0, "annualFee": 0, "feeWaiverSpend": null,
    "earnRule": "1 RP per ₹100 on weekdays, 2 RP per ₹100 at weekends; pay with points ₹0.75; cash ₹0.50 (max 5,000 RP a month)",
    "pointValue": {"best": 0.75, "cash": 0.5},
    "baseRate": 0.75, "baseRateCash": 0.5,
    "rules": [
      {"label": "Weekend (Sat–Sun) 2 RP per ₹100", "merchants": [], "categories": [], "rate": 1.5, "capMonthly": null, "tracking": "transaction day"}
    ],
    "exclusions": ["fuel","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [{"spendYearly": 500000, "valueRs": 2250, "label": "3,000 bonus RP"}],
    "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": "Discontinued 7 Mar 2025",
    "forexMarkup": 1.8, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2025-01-21", "change": "InterMiles redemption ended"}, {"date": "2025-03-07", "change": "Lounge access discontinued"}],
    "verified": "2026-11-01", "confidence": "low",
    "sources": ["https://cardexpress.in/reviews/indusind-legend"],
    "notes": "CardExpress calls it lifetime free; it historically had a fee. Verify. 1% fee on education above ₹45k a cycle."
  },
  {
    "key": "kotak-811", "bank": "Kotak", "name": "811 #DreamDifferent (FD-backed)", "status": "active",
    "networks": ["Visa", "RuPay"], "upi": true,
    "joiningFee": 0, "annualFee": 0, "feeWaiverSpend": null,
    "earnRule": "4 RP per ₹100 online, 1 RP per ₹100 offline (CardExpress; unverified); point value not published",
    "pointValue": {"best": null, "cash": null},
    "baseRate": null, "baseRateCash": null,
    "rules": [],
    "exclusions": ["fuel","travel","emi","cash"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [{"spendYearly": 72000, "valueRs": 1000, "label": "₹1,000 Amazon voucher (RuPay variant)"}],
    "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": null, "fuelSurchargeWaiver": null,
    "minIncomeMonthly": 0, "minIncomeSelfEmployedYearly": 0,
    "devaluations": [],
    "verified": "2026-11-01", "confidence": "low",
    "sources": ["https://cardexpress.in/reviews/kotak-811-dreamdifferent"],
    "notes": "Secured card: the limit is 90% of the FD (minimum FD ₹10k). 'travel' in exclusions stands for railways."
  },
  {
    "key": "kotak-league-platinum", "bank": "Kotak", "name": "League Platinum", "status": "active",
    "networks": ["Visa", "RuPay"], "upi": null,
    "joiningFee": 499, "annualFee": 499, "feeWaiverSpend": 50000,
    "earnRule": "8 RP per ₹150; point value about ₹0.10 (sources range ₹0.10–0.25)",
    "pointValue": {"best": 0.1, "cash": 0.1},
    "baseRate": 0.53, "baseRateCash": 0.53,
    "rules": [],
    "exclusions": ["fuel","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [{"spendYearly": 250000, "valueRs": 2000, "label": "4 PVR tickets or 10,000 RP for each ₹1.25L spent in six months"}],
    "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": 3.5, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [],
    "verified": "2026-11-01", "confidence": "low",
    "sources": ["https://www.kotak.bank.in/en/personal-banking/cards/credit-cards/league-platinum-card/value-chart.html"],
    "notes": "The milestone is modelled as ₹2.5L a year giving 2 × 10k RP (₹2,000). Myntra Kotak holders were moved to this card or Zen in July 2025."
  },
  {
    "key": "onecard", "bank": "OneCard (Federal / SBM / BOB / South Indian / CSB and others)", "name": "OneCard Metal", "status": "active",
    "networks": ["Visa", "RuPay"], "upi": null,
    "joiningFee": 0, "annualFee": 0, "feeWaiverSpend": null,
    "earnRule": "1 RP per ₹50; 5X on your top 2 spend categories each cycle; 1 RP = ₹0.10",
    "pointValue": {"best": 0.1, "cash": 0.1},
    "baseRate": 0.2, "baseRateCash": 0.2,
    "rules": [
      {"label": "5X on your top 2 spend categories each cycle (chosen automatically)", "merchants": [], "categories": [], "rate": 1.0, "capMonthly": null, "capNote": "a monthly bonus cap exists; amount not stated", "tracking": "the user's dynamic top 2 categories"}
    ],
    "exclusions": ["fuel","rent","wallet","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [], "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": 1.0, "fuelSurchargeWaiver": null,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [],
    "verified": "2026-11-01", "confidence": "low",
    "sources": ["https://cardexpress.in/reviews/onecard-metal"],
    "notes": "The point value and exclusions are from what I already knew. CardExpress writes the earn as '2 pts per ₹100', which is the same rate."
  },
  {
    "key": "scapia-federal", "bank": "Federal", "name": "Scapia", "status": "active",
    "networks": ["Visa", "RuPay"], "upi": true,
    "joiningFee": 0, "annualFee": 0, "feeWaiverSpend": null,
    "earnRule": "Visa: 10% in Scapia coins (5 coins = ₹1, so 2%); 20% on Scapia app travel (4%); RuPay/UPI: 5% coins on spends above ₹500 (1%)",
    "pointValue": {"best": 0.2, "cash": null},
    "baseRate": 2.0, "baseRateCash": null,
    "rules": [
      {"label": "Travel booked in the Scapia app", "merchants": ["scapia"], "categories": ["flights","hotels","travel"], "rate": 4.0, "capMonthly": null, "tracking": "Scapia app"},
      {"label": "RuPay variant / UPI (spends above ₹500)", "merchants": [], "categories": ["upi"], "rate": 1.0, "capMonthly": null, "tracking": "RuPay"}
    ],
    "exclusions": ["fuel","utilities","telecom","insurance","education","government","rent","emi","wallet","gift-vouchers"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [],
    "loungeDomesticYear": 99, "loungeIntlYear": 0, "loungeCondition": "Unlimited domestic in a month after ₹20k spend in the previous month (from 27 Feb 2026)",
    "forexMarkup": 0.0, "fuelSurchargeWaiver": null,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-02-27", "change": "Lounge gate raised from ₹10k to ₹20k; utilities and insurance stop earning"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://book1a.com/apply/scapia"],
    "notes": "Coins redeem only for Scapia travel. Foreign-currency spends earn no coins (but there is no markup). A BOBCARD variant exists with separate terms."
  },
  {
    "key": "kiwi-rupay", "bank": "YES / PNB / AU (via Kiwi)", "name": "Kiwi RuPay", "status": "active",
    "networks": ["RuPay"], "upi": true,
    "joiningFee": 0, "annualFee": 0, "feeWaiverSpend": 150000,
    "earnRule": "6 Kiwis per ₹100 on Kiwi Scan & Pay; 2 per ₹100 online; 1 Kiwi = ₹0.25 (to UPI, multiples of 500)",
    "pointValue": {"best": 0.25, "cash": 0.25},
    "baseRate": 0.5, "baseRateCash": 0.5,
    "rules": [
      {"label": "Kiwi app UPI Scan & Pay", "merchants": ["kiwi"], "categories": ["upi"], "rate": 1.5, "capMonthly": null, "capNote": "monthly cap is 1% of the credit limit; with Neon (₹999 a year): 2%, rising to 5% via milestones", "tracking": "Kiwi app UPI"}
    ],
    "exclusions": ["fuel","government","utilities","telecom","education","insurance","jewellery","gift-vouchers","wallet","rent"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [], "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": "Neon members can unlock up to 3 domestic visits a year",
    "forexMarkup": null, "fuelSurchargeWaiver": null,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-09-06", "change": "Axis KWIK holders moved to a separate rewards programme"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://book1a.com/apply/kiwi/rupay", "https://gokiwi.in/rewards-policy-v2/"],
    "notes": "Fees are issuer-specific: the PNB physical card is ₹500 joining + ₹750 annual (waived at ₹1.5L); virtual cards and AU are free."
  },
  {
    "key": "amex-mrcc", "bank": "American Express", "name": "Membership Rewards Credit Card", "status": "active",
    "networks": ["Amex"], "upi": false,
    "joiningFee": 1000, "annualFee": 4500, "feeWaiverSpend": 150000,
    "earnRule": "1 MR per ₹50; +1,000 MR for 4 transactions of ₹1,500+ in a month; +1,000 MR for ₹20k spend in a month; MR valued at about ₹0.50",
    "pointValue": {"best": 0.5, "cash": null},
    "baseRate": 1.0, "baseRateCash": null,
    "rules": [],
    "exclusions": ["fuel","insurance","utilities","cash","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [
      {"spendMonthly": 6000, "valueRs": 500, "label": "1,000 MR for 4 transactions of ₹1,500+ in a calendar month"},
      {"spendMonthly": 20000, "valueRs": 500, "label": "1,000 MR for ₹20k spend in a calendar month"}
    ],
    "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": 3.5, "fuelSurchargeWaiver": false,
    "minIncomeMonthly": 50000, "minIncomeSelfEmployedYearly": 600000,
    "devaluations": [{"date": "2026-09-30", "change": "Reward Multiplier portal closed"}, {"date": "2026-11-15", "change": "50% fee waiver (₹90k–1.5L) removed; points no longer pooled across cards; milestones counted by posting date"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://livefromalounge.com/american-express-membership-rewards-india-changes-coming-october-11-2026"],
    "notes": "The earn rule and exclusions are from what I already knew. Earning about 5% needs exactly ₹20k a month in 4+ transactions. The income figure is a commonly cited value."
  },
  {
    "key": "amex-platinum-travel", "bank": "American Express", "name": "Platinum Travel", "status": "paused",
    "networks": ["Amex"], "upi": false,
    "joiningFee": 5000, "annualFee": 5000, "feeWaiverSpend": null,
    "earnRule": "1 MR per ₹50; MR valued at about ₹0.50",
    "pointValue": {"best": 0.5, "cash": null},
    "baseRate": 1.0, "baseRateCash": null,
    "rules": [],
    "exclusions": ["fuel","insurance","utilities","cash","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [
      {"spendYearly": 400000, "valueRs": 5000, "label": "10,000 MR"},
      {"spendYearly": 700000, "valueRs": 20000, "label": "₹20,000 Taj voucher (from 10 Sep 2026)"}
    ],
    "loungeDomesticYear": 8, "loungeIntlYear": 0, "loungeCondition": "2 domestic a quarter after ₹1L spend in the previous quarter (₹70k for Oct–Dec 2026)",
    "forexMarkup": 3.5, "fuelSurchargeWaiver": false,
    "minIncomeMonthly": 50000, "minIncomeSelfEmployedYearly": 600000,
    "devaluations": [{"date": "2026-03-09", "change": "₹1.9L milestone halved"}, {"date": "2026-07-01", "change": "Etihad transfers removed"}, {"date": "2026-09-10", "change": "₹1.9L milestone removed; 22.5k MR at ₹7L removed; Taj voucher raised to ₹20k"}, {"date": "2026-10-01", "change": "Domestic lounge spend-gated"}],
    "verified": "2026-11-01", "confidence": "high",
    "sources": ["https://book1a.com/apply/amex/platinum-travel", "https://savesage.club/blogs/all-major-credit-card-devaluations"],
    "notes": "New applications are paused. The income figure is from memory."
  },
  {
    "key": "amex-gold-charge", "bank": "American Express", "name": "Gold Charge Card", "status": "active",
    "networks": ["Amex"], "upi": false,
    "joiningFee": 1000, "annualFee": 4500, "feeWaiverSpend": null,
    "earnRule": "1 MR per ₹50; +1,000 MR for 6 transactions of ₹1,000+ in a calendar month",
    "pointValue": {"best": 0.5, "cash": null},
    "baseRate": 1.0, "baseRateCash": null,
    "rules": [],
    "exclusions": ["fuel","insurance","utilities","cash","emi"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [{"spendMonthly": 6000, "valueRs": 500, "label": "1,000 MR for 6 transactions of ₹1,000+ in a month"}],
    "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": 3.5, "fuelSurchargeWaiver": false,
    "minIncomeMonthly": 50000, "minIncomeSelfEmployedYearly": 600000,
    "devaluations": [{"date": "2025-06-12", "change": "Fuel earns no MR (CardExpress)"}, {"date": "2026-11-15", "change": "Points no longer pooled; milestones counted by posting date"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://cardexpress.in/reviews/amex-gold", "https://livefromalounge.com/american-express-membership-rewards-india-changes-coming-october-11-2026"],
    "notes": "A charge card: the balance must be paid in full. CardExpress's milestone description (12k MR at ₹1.8L) is unverified and not included."
  },
  {
    "key": "hsbc-live-plus", "bank": "HSBC", "name": "Live+", "status": "active",
    "networks": ["Visa"], "upi": false,
    "joiningFee": 999, "annualFee": 999, "feeWaiverSpend": 200000,
    "earnRule": "Cashback",
    "pointValue": {"best": 1.0, "cash": 1.0},
    "baseRate": 1.5, "baseRateCash": 1.5,
    "rules": [
      {"label": "10% on dining, food delivery, groceries, shopping, utilities (one shared bucket)", "merchants": [], "categories": ["food","food-delivery","groceries","shopping","shopping-online","utilities"], "rate": 10.0, "capMonthly": 1200, "capNote": "₹1,200 per billing cycle", "tracking": "MCC (from 26 Jul 2026)"}
    ],
    "exclusions": ["fuel","wallet","rent","education","government","insurance","jewellery","health"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [{"spendQuarterly": 10000, "valueRs": 250, "label": "₹250 contactless fuel cashback each quarter (max ₹1,000 a year)"}],
    "loungeDomesticYear": 2, "loungeIntlYear": 1, "loungeCondition": null,
    "forexMarkup": 1.99, "fuelSurchargeWaiver": null,
    "minIncomeMonthly": 50000, "minIncomeSelfEmployedYearly": 1200000,
    "devaluations": [{"date": "2026-07-26", "change": "Moved to Visa Infinite; 10% bucket widened with a ₹1,200 cap; 1.5% international cashback removed; domestic lounge cut from 4 to 2; forex cut from 3.5% to 1.99%"}],
    "verified": "2026-11-01", "confidence": "high",
    "sources": ["https://book1a.com/apply/hsbc/live-plus", "https://savesage.club/blogs/all-major-credit-card-devaluations"],
    "notes": "Fuel and wallet loads earn nothing (Airtel, pickmycard, savesage listings, checked 1 Nov 2026; a reported quarterly contactless-fuel bonus is unconfirmed). 'health' stands for hospitals (MCC 8062), medical supplies (5047) and pharma wholesale (5122). The Myntra 10% promotion ended 31 Oct 2026. Amazon and Flipkart earn 1.5%. Whether 'shopping' covers all retail is unclear; book1a lists 'shopping' in the bucket."
  },
  {
    "key": "hsbc-travelone", "bank": "HSBC", "name": "TravelOne", "status": "active",
    "networks": ["Mastercard"], "upi": false,
    "joiningFee": 4999, "annualFee": 4999, "feeWaiverSpend": 800000,
    "earnRule": "2 RP per ₹100; 4 RP per ₹100 on flights, travel agencies, forex; transfer 1:1 to most airline and hotel partners (valued at ₹0.50)",
    "pointValue": {"best": 0.5, "cash": null},
    "baseRate": 1.0, "baseRateCash": null,
    "rules": [
      {"label": "Flights, travel agencies, foreign currency: 4 RP per ₹100", "merchants": [], "categories": ["flights","travel"], "rate": 2.0, "capMonthly": null, "capNote": "accelerated cap 50,000 RP a month (one table) or 18,000 (Marketplace)", "tracking": "MCC"},
      {"label": "HSBC Rewards Marketplace: flights 16, hotels 24, car rental 8 RP per ₹100", "merchants": ["hsbc-marketplace"], "categories": ["hotels","flights"], "rate": 12.0, "capMonthly": 9000, "capNote": "18,000 RP a month; rate shown is for hotels (flights 8%)", "tracking": "HSBC Rewards Marketplace"}
    ],
    "exclusions": ["fuel","rent","wallet","utilities","insurance","education","government","jewellery"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [{"spendYearly": 1200000, "valueRs": 5000, "label": "10,000 bonus RP"}],
    "loungeDomesticYear": 6, "loungeIntlYear": 4, "loungeCondition": "International on LoungeKey",
    "forexMarkup": 3.5, "fuelSurchargeWaiver": null,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://book1a.com/apply/hsbc/travel-one"],
    "notes": "Forex markup was waived 15 Aug–31 Oct 2026 (offer ended). The network is from memory."
  },
  {
    "key": "yes-marquee", "bank": "YES Bank", "name": "Marquee", "status": "active",
    "networks": [], "upi": false,
    "joiningFee": 9999, "annualFee": 9999, "feeWaiverSpend": 1000000,
    "earnRule": "36 RP per ₹200 online; 18 RP per ₹200 offline; ₹0.25 on the travel portal, ₹0.15 vouchers, ₹0.10 statement credit",
    "pointValue": {"best": 0.25, "cash": 0.1},
    "baseRate": 2.25, "baseRateCash": 0.9,
    "rules": [
      {"label": "Online spends 36 RP per ₹200", "merchants": [], "categories": ["shopping-online"], "rate": 4.5, "capMonthly": 25000, "capNote": "1 lakh RP a month (as reported)", "tracking": "online MCC"}
    ],
    "exclusions": ["government","fuel","rent","wallet"],
    "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [],
    "loungeDomesticYear": 99, "loungeIntlYear": 99, "loungeCondition": "Unlimited after ₹1L spend in the previous quarter",
    "forexMarkup": 1.0, "fuelSurchargeWaiver": null,
    "minIncomeMonthly": 300000, "minIncomeSelfEmployedYearly": 3600000,
    "devaluations": [{"date": "2025-04-01", "change": "Lounge spend-gated; marketing/government excluded"}, {"date": "2025-01-01", "change": "Voucher value cut from ₹0.25 to ₹0.15 (2025, exact date unknown)"}, {"date": "2026-01-15", "change": "1% fee on utilities above ₹25k a month"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://cardexpress.in/reviews/yes-marquee"],
    "notes": "The network is not stated. The voucher-cut date is a placeholder (only the year is known). Fuel, rent and wallet exclusions are assumed."
  },
  {
    "key": "yes-klick", "bank": "YES Bank", "name": "Klick", "status": "active",
    "networks": [], "upi": null,
    "joiningFee": null, "annualFee": null, "feeWaiverSpend": null,
    "earnRule": "Reported 2 RP per ₹200 on non-UPI spends; no reliable 2026 source",
    "pointValue": {"best": null, "cash": null},
    "baseRate": null, "baseRateCash": null,
    "rules": [], "exclusions": [], "reducedRate": {}, "categoryCapsMonthlyRs": {},
    "milestones": [], "loungeDomesticYear": null, "loungeIntlYear": null, "loungeCondition": null,
    "forexMarkup": null, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [],
    "verified": "2026-11-01", "confidence": "low",
    "sources": ["https://www.paisabazaar.com/yes-bank/klick-credit-card"],
    "notes": "Placeholder; do not recommend until filled from the YES MITC."
  },
  {
    "key": "bob-eterna", "bank": "Bank of Baroda (BOBCARD)", "name": "Eterna", "status": "active",
    "networks": ["Visa", "RuPay"], "upi": null,
    "joiningFee": 0, "annualFee": 2499, "feeWaiverSpend": 250000,
    "earnRule": "3 RP per ₹100; 15 RP per ₹100 on online shopping, travel, dining, movies, international; 1 RP = ₹0.25",
    "pointValue": {"best": 0.25, "cash": 0.25},
    "baseRate": 0.75, "baseRateCash": 0.75,
    "rules": [
      {"label": "15 RP per ₹100 on online shopping, travel, dining, movies, international", "merchants": [], "categories": ["shopping-online","travel","flights","hotels","food","entertainment"], "rate": 3.75, "capMonthly": 1250, "capNote": "5,000 RP per statement cycle", "tracking": "MCC"}
    ],
    "exclusions": ["fuel","rent","wallet","government","insurance","education"],
    "reducedRate": {"groceries": 0.0},
    "categoryCapsMonthlyRs": {},
    "milestones": [{"spendYearly": 500000, "valueRs": 5000, "label": "20,000 bonus RP"}],
    "loungeDomesticYear": 99, "loungeIntlYear": 0, "loungeCondition": "Unlimited domestic after ₹75k spend in the previous quarter (from 15 Jul 2026)",
    "forexMarkup": 2.0, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-07-15", "change": "Lounge gate at ₹75k a quarter"}, {"date": "2026-09-01", "change": "Joining fee and first-year fee now ₹0 (positive)"}, {"date": "2026-04-01", "change": "BOBCARD fees: 1% on education via apps, tolls, railways above ₹30k"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://book1a.com/apply/bob/eterna"],
    "notes": "Supermarkets, convenience stores, fast food, transport, railways, tolls and hospitals are excluded. 'groceries: 0' marks the supermarket exclusion. Utilities (MCC 4900) earn base rate only. The networks are from memory."
  },
  {
    "key": "cred-indusind-rupay", "bank": "IndusInd", "name": "CRED IndusInd RuPay", "status": "active",
    "networks": ["RuPay"], "upi": true,
    "joiningFee": 0, "annualFee": 499, "feeWaiverSpend": null,
    "earnRule": "1 RP per ₹100 base; 5 RP per ₹100 accelerated; ₹1 per RP on CRED flights, hotels, store, Pay; ₹0.50 against the card bill",
    "pointValue": {"best": 1.0, "cash": 0.5},
    "baseRate": 1.0, "baseRateCash": 0.5,
    "rules": [
      {"label": "5 RP per ₹100 on e-commerce, CRED Pay/travel/store/gift cards, CRED online UPI (minimum ₹100)", "merchants": ["cred"], "categories": ["shopping-online"], "rate": 5.0, "capMonthly": 5000, "capNote": "5,000 RP per statement cycle", "tracking": "CRED app / online MCC"}
    ],
    "exclusions": ["fuel","travel","emi","education","government","wallet","rent","jewellery"],
    "reducedRate": {"utilities": 0.0, "insurance": 0.0, "upi": 0.0},
    "categoryCapsMonthlyRs": {},
    "milestones": [], "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": null, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://book1a.com/apply/indusind/cred-rupay"],
    "notes": "Utilities, insurance and UPI Scan & Pay earn 1 RP per ₹100 only when paid through CRED; outside CRED they earn 0 (the reducedRate shows the outside-CRED value). 'travel' in exclusions means transport and tolls. Targeted lifetime-free offers exist."
  },
  {
    "key": "jupiter-edge-plus", "bank": "CSB (via Jupiter)", "name": "Edge+ RuPay", "status": "active",
    "networks": ["RuPay"], "upi": true,
    "joiningFee": 499, "annualFee": 0, "feeWaiverSpend": null,
    "earnRule": "Jewels: 5% base, 25% on Jupiter Flights, 50% at select brands; ₹0.20 per Jewel (flights, store, vouchers, gold), ₹0.14 for statement credit",
    "pointValue": {"best": 0.2, "cash": 0.14},
    "baseRate": 1.0, "baseRateCash": 0.7,
    "rules": [
      {"label": "Select shopping brands 50% Jewels (needs more than ₹15k qualifying spend in the cycle from 10 Oct 2026)", "merchants": [], "categories": ["shopping-online"], "rate": 10.0, "capMonthly": 2000, "capNote": "10,000 Jewels a cycle, 3,000 per merchant, 1,000 per transaction", "tracking": "Jupiter brand list"},
      {"label": "Jupiter Flights 25% Jewels", "merchants": ["jupiter-flights"], "categories": ["flights"], "rate": 5.0, "capMonthly": 1000, "capNote": "5,000 Jewels a cycle", "tracking": "Jupiter app"}
    ],
    "exclusions": ["fuel","government","rent","utilities","telecom","wallet","gift-vouchers","insurance","emi","gaming"],
    "reducedRate": {},
    "categoryCapsMonthlyRs": {},
    "milestones": [], "loungeDomesticYear": 0, "loungeIntlYear": 0, "loungeCondition": null,
    "forexMarkup": null, "fuelSurchargeWaiver": true,
    "minIncomeMonthly": null, "minIncomeSelfEmployedYearly": null,
    "devaluations": [{"date": "2026-06-01", "change": "Cash value cut from ₹0.20 to ₹0.14; flights 35X to 25X, capped; external OTAs at base rate"}, {"date": "2026-10-10", "change": "Shopping rate needs ₹15k cycle spend"}],
    "verified": "2026-11-01", "confidence": "medium",
    "sources": ["https://book1a.com/apply/jupiter/edge-plus", "https://savesage.club/blogs/all-major-credit-card-devaluations"],
    "notes": "UPI earns only through Jupiter UPI. The joining fee varies by cohort. The brand list for the 50% rule was not captured."
  }
]
```

## 6. Main sources

- book1a.com card pages (issuer terms checked 3–26 Oct 2026): https://book1a.com/apply
- CardExpress reviews (updated Mar–Oct 2026): https://cardexpress.in/reviews
- SBI Cashback revision PDF (1 Apr 2026): https://www.sbicard.com/sbi-card-en/assets/docs/pdf/cashback-revised.pdf
- SBI domestic lounge PDF (w.e.f. 10 Jan 2026): https://www.sbicard.com/sbi-card-en/assets/docs/pdf/loungebenefits.pdf
- IDFC FIRST Millennia notice (18 Jun 2026): https://www.idfcfirst.bank.in/content/dam/idfcfirstbank/pdf/credit-card/FIRST-Millennia-Credit-Card-Communication-May-26.pdf
- IDFC Select/Wealth notices (Jan 2026): https://www.idfcfirst.bank.in/content/dam/idfcfirstbank/pdf/credit-card/Select-Credit-Card.pdf and https://www.idfcfirst.bank.in/content/dam/idfcfirstbank/pdf/credit-card/Wealth-1-Credit-Card.pdf
- LiveFromALounge, HDFC mid-tier changes 2026: https://livefromalounge.com/hdfc-bank-mid-tier-credit-cards-changes-2026/
- LiveFromALounge, HDFC SmartBuy voucher cap: https://livefromalounge.com/hdfc-bank-credit-cards-devalues-smartbuy-gift-vouchers-accelerated-rewards-with-new-monthly-cap-effective-today/
- LiveFromALounge, Amex MR changes: https://livefromalounge.com/american-express-membership-rewards-india-changes-coming-october-11-2026
- LiveFromALounge, IDFC zero forex: https://livefromalounge.com/idfc-first-bank-removes-forex-markup-from-all-credit-cards-immediately/
- SaveSage, all 2026 devaluations: https://savesage.club/blogs/all-major-credit-card-devaluations
- SaveSage, IDFC 2026: https://savesage.club/blogs/idfc-first-credit-card-devaluation
- CredSutra tracker: https://credsutra.in/blog/credit-card-devaluation-tracker-2026/
- Flipkart SBI launch (Business Standard copy on sbicard.com): https://www.sbicard.com/sbi-card-en/assets/docs/pdf/who-we-are/news/2025/Business-Standard-20250827.pdf
