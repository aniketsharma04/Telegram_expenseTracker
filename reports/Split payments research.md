# Split payments: research and design

Aaj can make splitting better than Splitwise for Indian users by doing what a
standalone splitter can't: start from the payment the app already captured,
count only the user's own share against the daily budget, and recognise the
friend's repayment when it lands in the bank. The current split feature is
too narrow to build on as it is (equal splits with registered family members
only, one expense row per person) and it has two accounting bugs that make
the daily number wrong. The plan below fixes those first, then adds friends
who don't use the app, flexible split methods, UPI payment links for settling
up, and automatic matching of repayments.

## What exists today

- **Schema (v4):** a split creates one `expenses` row per participant for
  their share, grouped by `split_id`, with `paid_by` = the payer. Participants
  must be family members with accounts.
- **Methods:** equal only; the payer absorbs rounding
  (`src/lib/log-expense.ts` `logSplitExpense`, `POST /api/expense` with
  `split: true`).
- **Entry:** only from "Add expense" (manual). An auto-captured bank payment
  cannot be split afterwards.
- **Balances:** `mobile/lib/settle.ts` nets pairwise "who owes whom" on the
  Family tab. Nothing records a settlement, so balances can't go back to zero
  except by deleting rows.

### Two bugs in the current flow (verified in code)

1. **Double counting.** You pay ₹3,000 for dinner for four and add it as a
   split. Your row is ₹750. The bank alert for ₹3,000 then arrives. The
   duplicate check (`findManualTwin` in `src/lib/ingest.ts`) looks for a
   manual row with the _same amount_ on the same day, finds none (₹750 ≠
   ₹3,000), and logs a second expense of ₹3,000. Your daily budget is charged
   ₹3,750.
2. **Repayments counted as income.** When a friend sends back ₹750, the
   captured credit is logged as income. Income, savings rate and the month's
   picture all inflate, and the balance on the Family tab doesn't change.

## What the market shows

- **Splitwise** is the default, but its free plan now caps entries per day
  (reports vary from 3 to 5), shows ads, and puts itemised receipt scanning
  behind Pro (about $40–50 a year). Reviews and a Play feedback analysis
  centre on those limits
  ([Finny](https://getfinny.app/blog/splitwise-pricing-2026),
  [Kimola](https://kimola.com/reports/splitwise-app-feedback-report-uncover-user-insights-google-play-en-144452)).
  The sources are mostly competitors' blogs; treat exact numbers as rough.
- **Tricount** (owned by bunq) wins on "no account needed": anyone with the
  link can view and add expenses. It minimises the number of repayments and
  supports unequal splits, but it doesn't move money; its own India blog says
  to settle by UPI outside the app
  ([Tricount](https://tricount.com/blog/top-splitwise-alternatives-in-india-2025-which-app-should-you-switch-to)).
- **Google Pay** has had bill splitting in groups since 2021 (up to 20
  people); only the creator sees who has paid
  ([Google Pay help](https://support.google.com/pay/india/answer/11420982?hl=EN)).
  It only knows Google Pay payments, not cash, cards or other UPI apps.
- **No splitter knows the user's bank.** Every one of them needs the expense
  typed in, and none of them can tell when a friend has actually paid.
  Aaj already sees both sides in the bank alerts. That is the advantage.

### The UPI constraint that shapes settlement

NPCI stopped **person-to-person collect requests** from 1 October 2025 to
fight fraud ([Outlook Money](https://www.outlookmoney.com/banking/npci-to-end-upi-p2p-collect-requests-from-october-1-to-reduce-fraud),
[YourStory](https://yourstory.com/2025/08/npci-to-ends-p2p-collect-requests-on-upi-by-october-amid-fraud-concerns)).
So "request ₹750 from Rahul" can no longer be a UPI request. What still
works, and needs no licence, is a **`upi://pay` link** with the payee's UPI
ID and the amount filled in: the friend taps it (sent over WhatsApp) and pays
in their own UPI app. The roadmap report already relies on the same UPI
Intent hand-off for bills. Aaj never touches the money and gets no callback;
the repayment is confirmed from the bank alert instead.

## Recommended design

### Principle: the bank payment is the truth, the split is a note on it

Keep one expense row for what actually left the account (₹3,000), and record
the split _alongside_ it. Don't create one expense row per person. Then:

- the duplicate check has nothing to trip over;
- the daily budget counts **your share** (₹750) and treats the other ₹2,250
  as money lent, not spent;
- a split can be added to any expense at any time, including one the app
  captured automatically.

### Data model (new migration)

All money in **paise** (integers) to avoid rounding drift.

| Table                    | Key columns                                                                                                                                           | Notes                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `people`                 | `id`, `owner_id`, `name`, `upi_id?`, `phone?`, `linked_user_id?`                                                                                      | Friends who may not use Aaj. Store only what's needed (DPDP: these are other people's data). Family members link via `linked_user_id`. |
| `splits`                 | `id`, `owner_id`, `expense_id?`, `total`, `paid_by` (`me` or a person), `method`, `note`, `date`, `group_id?`                                         | `expense_id` links the bank payment when you paid. When a friend paid, there's no bank row; your share becomes an expense of its own.  |
| `split_shares`           | `split_id`, `person_id` (null = me), `amount`, `weight?`                                                                                              | Amounts are final paise after rounding; `weight` kept for "shares" and percentages so edits recompute.                                 |
| `settlements`            | `id`, `owner_id`, `person_id`, `direction` (they paid me / I paid them), `amount`, `date`, `method` (upi / cash / other), `income_id?`, `expense_id?` | Links the captured credit or debit so it isn't counted as income or spending.                                                          |
| `split_groups` (phase 2) | `id`, `owner_id`, `name`, `members`                                                                                                                   | Trips and flats.                                                                                                                       |

The balance with each person is **computed**, never stored: what they owe
from shares, minus what's been settled. That way editing a split or deleting
a settlement can never leave a stale balance.

### How it touches the daily budget

`computeDailyStatus` already gives each expense a `dailyAmount`. Add one rule:

- An expense you paid that has a split counts only **your share** as
  `dailyAmount`. The rest is "lent" and stays out of everyday spending.
- When a friend paid, your share is a normal expense on that day (it counts).
- A **settlement** (their credit, or your payment to them) never counts as
  income or spending: it's a transfer of money already accounted for.
- **Write-off:** if a friend never pays, "forgive" turns the open amount into
  your own expense (a gift) on the day you forgive it. It counts then, not
  retroactively.
- A shared fixed cost (flat rent split with a flatmate) should store **your
  share** as the commitment amount; a recurring split can set that
  automatically in phase 3.

### Split methods

1. **Equal** (default), with chosen people. "Me" can be left out: you paid for
   others entirely.
2. **Exact amounts**: must add up to the total; the UI shows what's left to
   assign.
3. **Shares** (2:1:1, for a couple plus one) and **percentages**.
4. **Itemised from a receipt photo.** Aaj already stores receipt line items
   (v10 `receipt_items`). Assign items to people, then spread tax, service
   charge and tip in proportion. Splitwise charges for this.

**Rounding:** work in paise and give out leftover paise by largest remainder,
in a fixed order (payer first). ₹1,000 split three ways is ₹333.34, ₹333.33
and ₹333.33, never ₹999.99 in total. Show the split amounts before saving.

### Settling up

- Each person shows one line: "Rahul owes you ₹750" or "You owe Rahul ₹400".
- **They owe you:** "Share payment link" opens the share sheet with
  `upi://pay?pa=<your UPI ID>&pn=<your name>&am=750.00&tn=Dinner (Aaj)` and a
  plain message. This needs your own UPI ID, asked once.
- **You owe them:** "Pay ₹400" opens your UPI app with their UPI ID and amount
  (if saved); otherwise "mark as paid".
- **Mark as settled** for cash or anything else, with a partial amount
  allowed.
- **Simplify debts** inside a group: the greedy method (largest creditor
  against largest debtor) is what most apps describe and is fine for groups of
  a few people. It isn't always the minimum (balances −3, −2, −2, +3, +4 need
  three transfers, greedy finds four), and the exact minimum is NP-hard, so
  for groups of up to about 10, an exact search over subsets whose balances
  sum to zero is affordable; above that use greedy
  ([Medium](https://medium.com/@mithunmk93/algorithm-behind-splitwises-debt-simplification-feature-8ac485e97688),
  [Stack Overflow counterexample](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/60907405/optimality-of-greedy-transaction-minimisation-algorithm)).
  Keep simplification **inside one group**. Netting across groups confuses
  people ("why do I pay Amit for Goa?").

### Matching repayments automatically

This is the feature no splitter has. When a captured **credit** arrives:

1. Find people with an open balance owed to you.
2. Score by amount (exact or a clean partial) and name (the bank's payer name
   against the person's name; "RAHUL K SHARMA" ↔ "Rahul").
3. Never decide silently. Ask, the same way the new "Is this your rent?" card
   does: "₹750 from RAHUL K SHARMA: is this Rahul paying you back?"
   **Yes** records a settlement linked to the credit (not income).
   **No** keeps it as income. Remember the bank name on the person after a
   yes, so next time the match is certain.

Do the same for **debits** to a person you owe, so paying them back isn't
counted as new spending.

## Edge cases to design for

**Amounts and rounding**

- Shares that don't divide evenly (handled in paise with largest remainder).
- Exact amounts that don't add up: block saving and show the gap.
- Zero or negative shares: disallow; "not included" instead of ₹0.
- Tip, GST, service charge, discounts and coupons on itemised splits: spread
  in proportion to items.

**Who paid**

- You paid for everyone and aren't included (all of it is lent).
- A friend paid (no bank row for you; your share is your expense).
- Two people paid parts of one bill (phase 2: multiple payers).
- The bill was on a credit card: the split hangs off the card expense; the
  card bill payment later is still "Loans & EMI" and must not count again.
- An EMI purchase shared with someone (rare; split the monthly EMI as a
  recurring split instead).

**Changing things later**

- Editing a split after part of it has been settled: recompute balances; if
  someone is now overpaid, show "you owe Rahul ₹50 back" rather than a
  negative debt.
- Deleting the underlying expense: ask whether to keep the split (cash
  settled outside) or remove both.
- A refund from the merchant on a split purchase: reduce everyone's share in
  proportion and show who is owed what back.
- A failed or reversed UPI payment: the reversal credit must cancel the split,
  not count as a repayment.
- The split date and the budget month: a split entered on 2 December for a
  dinner on 29 November changes November's history; the daily number must
  recompute (it already re-walks the month).

**Settlement**

- Partial payments, overpayments (credit balance carries forward), and a round
  number ("₹700, keep the change").
- Paying in cash, or through a third person.
- A friend sends money for something unrelated: why matching always asks.
- Two friends with the same first name, or the bank showing a parent's name.
- Money from a friend who has no open balance: stays income, no prompt.

**People**

- The same friend added twice: allow merging.
- A friend later joins Aaj: offer to link (with their consent) so both sides
  see the same balance (phase 3).
- Deleting a person with an open balance: block, or settle or forgive first.
- Family members who already have accounts: same `people` model, linked.

**Privacy and law**

- Friends are third parties under DPDP. Store a name and, only if the user
  adds them, a UPI ID or phone. No contact-list upload. Include them in the
  export and delete flows, and mention them in the privacy policy.
- Aaj doesn't move or hold money, so no payment licence: the payment link is
  a hand-off, the same as bills.
- No SMS or messages sent to friends by Aaj; the user shares the link
  themselves.

**Old data**

- Existing `split_id` rows (one per family member) need a one-off migration
  into `splits` and `split_shares`. Few users have them, but the migration
  must keep balances identical; test it by comparing `settleUp` before and
  after.

## Phased plan

| Phase              | What                                                                                                                                                                                                                                               | Why first                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **0. Fix** (small) | Duplicate check treats a split's total as the twin of the bank debit; offer "is this Rahul paying you back?" for credits matching an open family balance                                                                                           | Stops the two bugs in today's feature               |
| **1. Core**        | `people`, `splits`, `split_shares`, `settlements`; split any expense, including captured ones; equal, exact and shares; only your share counts in the budget; balances per person; UPI payment link to share; mark settled; migrate old split rows | The everyday "dinner with friends" flow, done right |
| **2. Smart**       | Automatic repayment matching for credits and debits; groups and trips with simplified debts; itemised receipt split; multiple payers; refunds                                                                                                      | What no other splitter can do                       |
| **3. Social**      | Link friends who use Aaj (both see one balance, with consent); recurring splits for rent and subscriptions feeding fixed costs                                                                                                                     | Needs phase 1 data in real use first                |

## Decisions needed before phase 1

1. **Friends without accounts** as `people` (recommended), or keep splits to
   family members who have accounts?
2. **Groups and trips** in phase 1, or one-off splits first (recommended:
   one-off first; most splits are a single meal or cab)?
3. **Your UPI ID**: OK to ask for it once, stored on the server, to build
   payment links?

## Sources

- Splitwise limits and pricing: [Finny](https://getfinny.app/blog/splitwise-pricing-2026), [Finny alternatives](https://getfinny.app/blog/best-splitwise-alternatives-2026), [Kimola Play feedback](https://kimola.com/reports/splitwise-app-feedback-report-uncover-user-insights-google-play-en-144452)
- Tricount: [Tricount India blog](https://tricount.com/blog/top-splitwise-alternatives-in-india-2025-which-app-should-you-switch-to), [Tricount glossary](https://tricount.com/glossary)
- Google Pay split: [Google Pay help](https://support.google.com/pay/india/answer/11420982?hl=EN), [XDA](https://www.xda-developers.com/google-pay-india-split-bill/)
- UPI collect ending: [Outlook Money](https://www.outlookmoney.com/banking/npci-to-end-upi-p2p-collect-requests-from-october-1-to-reduce-fraud), [YourStory](https://yourstory.com/2025/08/npci-to-ends-p2p-collect-requests-on-upi-by-october-amid-fraud-concerns), [Business Today](https://www.businesstoday.in/personal-finance/banking/story/npci-to-tighten-upi-rules-peer-to-peer-collect-feature-to-end-in-october-489244-2025-08-13)
- Debt simplification: [Medium](https://medium.com/@mithunmk93/algorithm-behind-splitwises-debt-simplification-feature-8ac485e97688), [Stack Overflow counterexample](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/60907405/optimality-of-greedy-transaction-minimisation-algorithm), [techinterview.org](https://www.techinterview.org/post/3233474468/system-design-design-splitwise-expense-sharing-debt-simplification-group-balances-payment-integration-currency-conversion/)

## Addendum: paying from the app (v25)

**Splitwise doesn't run payments in India.** It once integrated Paytm for
rupee balances ([PBN](https://pbn.com/?p=158275)), and UPI was a long-running
feature request on its forum
([Splitwise UserVoice](https://splitwise.uservoice.com/users/342679843-abhay));
in practice users settle outside the app. Running our own payments would mean
an RBI payment-aggregator licence (₹15 crore net worth), so the right design
is a hand-off to the user's own UPI app, which is what Aaj does.

**How it works.** "Pay" fires a `upi://pay` intent with no target app, so
Android's own chooser lists only the UPI apps installed on the phone (no
`<queries>` manifest change needed, so it ships over the air). The chosen app
returns NPCI's `response` string (`Status=SUCCESS|FAILURE|SUBMITTED`):
success records the payment at once; unclear asks "did it go through?";
failure offers paying by hand (UPI ID shown, long-press to copy).

**Known risk.** Developers widely report Google Pay declining person-to-person
payments started by another app ("declined for security reasons"); Google
documents the intent flow for merchant apps
([Google Pay docs](https://developers.google.com/pay/india/api/android/in-app-payments),
[EasyUpiPayment #109](https://github.com/PatilShreyas/EasyUpiPayment-Android/issues/109)).
That's why the fallback (pay the UPI ID yourself, then "I've paid") is always
one tap away.

**No double counting.** A Pay-button payment is stored with `via = 'upi'`.
When its bank alert is captured (same amount, within a day), it's filed as
"Settle up", not spending. Payments recorded by hand are `via = 'cash'` and
never auto-linked. With two same-amount payments pending, the payee name
decides; if it can't, nothing is linked.

**In person.** "Show QR" draws a UPI QR for your UPI ID and the amount owed;
the friend scans it with any UPI app, and the credit is matched by the
"paying you back?" prompt.

**Still needs a native build.** Listing UPI apps in our own picker, and
opening a specific app's home screen (the Bills fallback), need `<queries>`
package entries in the Android manifest.
