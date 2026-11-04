# Aaj Card Finder: research and design

Date: 2026-11-02. Builds on `research_notes/Monzy and Indian card recommenders/monzy.md` (Monzy teardown, 2026-11-01) and `research_notes/Aaj Cards app design/ux.md`.

## What Monzy does, and where Aaj can beat it

|             | Monzy (monzy.co)                                                                                                                      | Aaj Card Finder                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Input       | About 6 multiple-choice questions                                                                                                     | 5 questions; spend comes from the user's real messages when there are at least 30 days and ₹3,000/month of it                      |
| Ranking     | Preference-weighted attribute match plus hard filters (fee band, cashback vs points, UPI)                                             | Rupees: what each card alone would pay in a year on the same spending, after caps, exclusions, milestones and the fee with 18% GST |
| Output      | One "perfect match" (and a #2)                                                                                                        | One best match, two runners-up, 5 more on request, side-by-side compare                                                            |
| Eligibility | Not checked (just labels such as "No CIBIL check needed")                                                                             | likely / stretch / unlikely from income (salary credits or entered) and score band; never "pre-approved"                           |
| Card art    | **Not real card images**: a template card with bank and network logos (`/images/banks/*.png`), checked on monzy.co/cards/* 2026-11-02 | Real card faces from each bank's own site (38 of 52 cards); drawn card for the rest                                                |
| Links       | Bank product page + `?utm_source=monzy`                                                                                               | Bank product page, no tracking parameter                                                                                           |
| Debt stress | Not considered                                                                                                                        | Late fee / minimum-due signals hide all picks                                                                                      |

## Questions (and why each one)

1. **What do you want most?** Shopping / food and dining / travel and lounges / fuel / bills and everyday UPI / most value. It tilts the spending mix (×1.3–3 on that slice) and is a "fit" filter: a card must be strong at it (boosted rule ≥ max(2%, 1.5× base), or lounges ≥ 4/yr or forex ≤ 2% for travel, or UPI for bills).
2. **Where do you shop online most?** Amazon / Flipkart / Myntra / Swiggy and Zomato / Tata Neu apps / a mix. Co-branded cards pay most on their partner (Monzy asks the same).
3. **Fee you're OK with.** Free / ≤₹500 / ≤₹2,000 / ≤₹5,000 / any. Hard filter on the headline annual fee.
4. **UPI?** Yes → RuPay credit only. Also moves small-shop spends (groceries, dining, stores, pharmacy) to UPI, where only RuPay cards earn.
5. **Monthly spend.** "Use my real spending" (recommended, prefilled) or a band: <₹15k (scored as ₹10k), ₹15–50k (₹30k), ₹50k–1L (₹70k), >₹1L (₹1.4L).

When strict filters leave fewer than 3 cards, the goal is relaxed first, then the fee, then UPI. Fillers are marked "closest match" and the app says which wish couldn't be met. A card that loses money (fee > rewards) is never a pick.

Synthetic mix (shares of monthly spend, before the goal tilt): online 18%, groceries 14%, food delivery 10%, dining 7%, electricity 10%, phone 3%, fuel 8% (split HPCL/BPCL/IOCL), cabs 4%, flights 4%, hotels 3%, movies 3%, OTT 1%, stores 12%, health 3%. It's an assumption, not data; real spending replaces it as soon as it exists.

## Card images

- **Coverage:** all 52 catalogue cards have a real card face (2026-11-04). The first pass (2026-11-02) had 38; the other 14 fell back to a drawn card, which is what the app showed for HSBC Live+, Jupiter Edge+ and Scapia.
- **Source:** each issuer's own product, listing or brand page, never an aggregator (`source` in `src/lib/cards/art.ts`). Pages that render with JavaScript (HDFC Tata Neu, YES, IndusInd, Axis Burgundy, AU, Jupiter, OneCard) were opened in headless Chrome to find the image files.
- **Clean-up:** each image is trimmed to the card. Where the bank shows the card at an angle in a banner (HSBC Live+, Tata Neu Infinity and Plus, YES Marquee), it is straightened into a flat card. Cards cut out of a banner (TravelOne, Kotak League, IDFC Millennia, Kiwi) get rounded corners. Every result was checked by eye on a contact sheet.
- **Judgement calls:** IDFC shows Millennia as two designs; the first is used. Scapia comes in Visa and RuPay; the Visa face is used. Jupiter's red Edge+ is the RuPay one (the green one carries Mastercard). Axis's Burgundy page shows the standard Magnus card for Magnus for Burgundy, so both use that face. Kiwi's face is its card art from the gokiwi.in home page.
- **Delivery:** the faces are stored in `public/cards/<key>.webp` (52 files, about 1.1 MB) and served by Aaj. The Next.js image optimiser (`images.localPatterns`) resizes them for the app and caches each size for 30 days. Nothing is fetched from a bank at runtime, so a bank renaming a file, blocking servers (Bank of Baroda did) or going down can't break an image.
- **Rights:** card designs are the banks' trademarks and copyright. Showing them to identify a card in a comparison is common practice (comparison sites do it), but it is not a licence. The app credits "Card image and details from {bank}'s website", links only to the bank, and drops an image on any bank's request.
- **Upkeep:** when a bank redesigns a card, replace its file and `source`. A test checks that every catalogue card has an image file.

## Also fixed

Catalogue product links that pointed to PDFs, a bank's generic card listing, or nothing (Infinia, Diners, Swiggy, Tata Neu, IRCTC, MoneyBack+, Amazon Pay, Sapphiro, SBI Cashback/BPCL/Prime/Flipkart, AU, Kotak 811, Amex, YES, BOB, OneCard, Scapia, Kiwi, Jupiter) now go to the card's own page (`art.ts` `page` overrides `url`).

## Not done / next

- A full catalogue browser with filters (Monzy's /cards) — the matcher already lists every card; a filterable browse screen is the next step.
- "Did this help?" feedback, and saved shortlists.
- Weighting perks (lounge visits, forex) in rupees: today they are "fits" and filters, not money, so a travel card is never ranked on value it doesn't pay in cash.
