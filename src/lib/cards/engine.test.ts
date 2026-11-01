import { describe, expect, it } from "vitest";
import {
  allocate,
  cardHealth,
  debtStress,
  eligibility,
  missedRewards,
  nextCards,
  rateFor,
  readTxn,
  spendTip,
  useFor,
} from "./engine";
import { cardOf, detectCards, isCreditCardMessage } from "./detect";
import type { CardProduct, CardTxn, HeldCard } from "./types";

const card = (p: Partial<CardProduct> & { key: string }): CardProduct => ({
  bank: "Test",
  name: p.key,
  networks: ["Visa"],
  upi: false,
  joiningFee: 0,
  annualFee: 0,
  feeWaiverSpend: null,
  baseRate: 1,
  rules: [],
  exclusions: [],
  verified: "2026-11-01",
  confidence: "high",
  ...p,
});

const plain = card({
  key: "plain",
  baseRate: 1,
  exclusions: ["fuel", "rent", "wallet"],
});
const swiggyCard = card({
  key: "swiggy5",
  baseRate: 1,
  rules: [
    {
      label: "10% on Swiggy",
      merchants: ["swiggy"],
      rate: 10,
      capMonthly: 1500,
    },
  ],
  exclusions: ["fuel"],
  annualFee: 500,
  feeWaiverSpend: 200000,
});
const amazonCard = card({
  key: "amazon5",
  rules: [
    { label: "5% on Amazon", merchants: ["amazon"], rate: 5, capMonthly: null },
  ],
  baseRate: 1,
});
const rupay = card({
  key: "rupay",
  upi: true,
  upiRate: 0.5,
  baseRate: 1,
  rules: [
    {
      label: "1.5% on UPI",
      categories: ["groceries", "food"],
      rate: 1.5,
      upiOnly: true,
    },
  ],
});

let n = 0;
const txn = (p: Partial<CardTxn>): CardTxn => ({
  id: `t${++n}`,
  amount: 1000,
  date: "2026-10-10",
  merchant: null,
  category: "Shopping",
  channel: "card",
  ...p,
});

describe("reading a spend", () => {
  it("finds the merchant brand and its buckets", () => {
    const r = readTxn(
      txn({ merchant: "Swiggy Instamart", category: "Groceries" }),
    );
    expect(r.buckets.has("groceries")).toBe(true);
    expect(r.cardAble).toBe(true);
  });
  it("leaves out investments and EMIs", () => {
    expect(readTxn(txn({ category: "Investments" })).skip).toBe(true);
    expect(readTxn(txn({ category: "Loans & EMI" })).skip).toBe(true);
  });
  it("a UPI spend at the corner shop can't move to a card; one at Swiggy can", () => {
    expect(
      readTxn(txn({ channel: "upi", merchant: "Sharma General Store" }))
        .cardAble,
    ).toBe(false);
    expect(readTxn(txn({ channel: "upi", merchant: "Swiggy" })).cardAble).toBe(
      true,
    );
  });
});

describe("what a card pays", () => {
  it("a merchant rule beats the base rate", () => {
    expect(
      rateFor(swiggyCard, readTxn(txn({ merchant: "Swiggy" })), "card").rate,
    ).toBe(10);
    expect(
      rateFor(swiggyCard, readTxn(txn({ merchant: "Zara" })), "card").rate,
    ).toBe(1);
  });
  it("exclusions pay nothing", () => {
    expect(
      rateFor(
        plain,
        readTxn(txn({ merchant: "HPCL Petrol Pump", category: "Transport" })),
        "card",
      ).rate,
    ).toBe(0);
  });
  it("'ola' never matches 'coca cola'", () => {
    const olaCard = card({
      key: "ola",
      rules: [{ label: "Ola", merchants: ["ola"], rate: 7 }],
    });
    expect(
      rateFor(olaCard, readTxn(txn({ merchant: "Coca Cola Store" })), "card")
        .rate,
    ).toBe(1);
    expect(
      rateFor(olaCard, readTxn(txn({ merchant: "Ola" })), "card").rate,
    ).toBe(7);
  });
  it("UPI-only shops: only a RuPay card can take it, at its UPI rules", () => {
    const shop = readTxn(
      txn({ channel: "upi", merchant: "Kirana Mart", category: "Groceries" }),
    );
    expect(rateFor(plain, shop, "upi").rate).toBe(0);
    expect(rateFor(rupay, shop, "upi").rate).toBe(1.5);
    const misc = readTxn(
      txn({ channel: "upi", merchant: "Tea stall", category: "Shopping" }),
    );
    expect(rateFor(rupay, misc, "upi").rate).toBe(0.5);
  });
});

describe("allocation respects monthly caps", () => {
  it("stops paying 10% once the ₹1,500 cap is used, then the next card wins", () => {
    const txns = [
      txn({ merchant: "Swiggy", amount: 10000, date: "2026-10-01" }),
      txn({ merchant: "Swiggy", amount: 10000, date: "2026-10-02" }),
    ];
    const a = allocate([{ id: "s", product: swiggyCard }], txns);
    // ₹1,000 on the first, ₹500 left of the cap on the second.
    expect(a.total).toBe(1500);
    const b = allocate(
      [
        { id: "s", product: swiggyCard },
        { id: "p", product: plain },
      ],
      txns,
    );
    // Second spend: ₹500 capped on Swiggy card vs ₹100 on plain → Swiggy card.
    expect(b.total).toBe(1500);
  });
  it("the cap resets each month", () => {
    const txns = [
      txn({ merchant: "Swiggy", amount: 20000, date: "2026-09-05" }),
      txn({ merchant: "Swiggy", amount: 20000, date: "2026-10-05" }),
    ];
    expect(allocate([{ id: "s", product: swiggyCard }], txns).total).toBe(3000);
  });
});

describe("1. missed rewards on cards you hold", () => {
  const held: HeldCard[] = [
    { id: "A", bank: "Test", last4: "1111", product: plain },
    { id: "B", bank: "Test", last4: "2222", product: swiggyCard },
  ];
  it("“your Swiggy spend on card A earned 1%; card B pays 10%”", () => {
    const txns = [
      txn({ merchant: "Swiggy", amount: 2000, cardId: "A" }),
      txn({ merchant: "Swiggy", amount: 1000, cardId: "A" }),
      txn({ merchant: "Zara", amount: 5000, cardId: "A" }),
    ];
    const r = missedRewards(held, txns, 30);
    expect(r.cardSpend).toBe(8000);
    expect(r.earned).toBe(80);
    expect(r.missed).toBe(270);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({
      label: "Swiggy",
      spend: 3000,
      paidWith: "A",
      bestCard: "B",
      missed: 270,
      count: 2,
    });
  });
  it("nothing missed when the right card was used", () => {
    const r = missedRewards(
      held,
      [txn({ merchant: "Swiggy", amount: 2000, cardId: "B" })],
      30,
    );
    expect(r.missed).toBe(0);
    expect(r.lines).toEqual([]);
  });
  it("counts card spends on a card whose product is unknown", () => {
    const r = missedRewards(
      [...held, { id: "C", bank: "SBI", last4: "0543", product: null }],
      [txn({ amount: 700, cardId: "C" })],
      30,
    );
    expect(r.unknownCardSpend).toBe(700);
  });
  it("UPI spends a held RuPay card could have earned on", () => {
    const r = missedRewards(
      [{ id: "R", bank: "Test", last4: "3333", product: rupay }],
      [
        txn({
          channel: "upi",
          merchant: "Kirana Mart",
          category: "Groceries",
          amount: 2000,
        }),
      ],
      30,
    );
    expect(r.upi).toEqual({ spend: 2000, value: 30, cardId: "R" });
  });
});

describe("2. next card, ranked by what it adds", () => {
  const txns = Array.from({ length: 3 }, (_, i) => [
    txn({
      merchant: "Swiggy",
      amount: 3000,
      date: `2026-0${8 + i}-05`,
      cardId: "A",
    }),
    txn({
      merchant: "Amazon",
      amount: 4000,
      date: `2026-0${8 + i}-06`,
      cardId: "A",
    }),
  ]).flat();
  const held: HeldCard[] = [
    { id: "A", bank: "Test", last4: "1111", product: plain },
  ];

  it("ranks by extra ₹/year over your current best card, after fee + GST", () => {
    const out = nextCards([swiggyCard, amazonCard], held, txns, 90, {
      monthlyIncome: 80000,
      score: "750+",
    });
    expect(out.map((c) => c.product.key)).toEqual(["swiggy5", "amazon5"]);
    const s = out[0];
    // Swiggy: (10% − 1%) × ₹9,000 over 90 days → ₹810 → ×365/90 ≈ ₹3,285, minus ₹500 × 1.18.
    expect(s.rewardsYearly).toBe(3285);
    expect(s.feeYearly).toBe(590);
    expect(s.netYearly).toBe(2695);
    expect(s.wins[0].label).toBe("Swiggy");
    expect(out[1].netYearly).toBe(1947); // (5% − 1%) × ₹12,000 × 365/90, no fee
  });
  it("never suggests a card you already hold", () => {
    const out = nextCards([plain, swiggyCard], held, txns, 90, {
      monthlyIncome: null,
      score: "unknown",
    });
    expect(out.find((c) => c.product.key === "plain")).toBeUndefined();
  });
  it("drops a card that doesn't pay for its fee", () => {
    const pricey = card({ key: "pricey", baseRate: 1.2, annualFee: 5000 });
    expect(
      nextCards([pricey], held, txns, 90, {
        monthlyIncome: null,
        score: "unknown",
      }),
    ).toEqual([]);
  });
  it("a fee waived by spend isn't charged", () => {
    const waived = card({
      key: "w",
      baseRate: 2,
      annualFee: 500,
      feeWaiverSpend: 50000,
    });
    const [w] = nextCards([waived], held, txns, 90, {
      monthlyIncome: null,
      score: "unknown",
    });
    expect(w.feeWaived).toBe(true);
    expect(w.feeYearly).toBe(0);
  });
});

describe("approval chances: likely / stretch / unlikely, never 'pre-approved'", () => {
  const c = card({ key: "c", minIncomeMonthly: 50000 });
  it("income over the bar → likely", () =>
    expect(eligibility(c, 60000, "750+").chance).toBe("likely"));
  it("a little under → stretch", () =>
    expect(eligibility(c, 40000, "750+").chance).toBe("stretch"));
  it("far under → unlikely", () =>
    expect(eligibility(c, 20000, "750+").chance).toBe("unlikely"));
  it("no income → stretch, asking for it", () => {
    const e = eligibility(c, null, "unknown");
    expect(e.chance).toBe("stretch");
    expect(e.reasons.join(" ")).toMatch(/income/);
  });
  it("a low score → unlikely; 650–699 lowers one step", () => {
    expect(eligibility(c, 90000, "below-650").chance).toBe("unlikely");
    expect(eligibility(c, 90000, "650-699").chance).toBe("stretch");
  });
});

describe("3. debt stress hides every apply button", () => {
  const m = (
    body: string,
    date = "2026-10-10",
    amount: number | null = null,
  ) => ({ body, date, amount });
  it("a late fee charged", () => {
    expect(
      debtStress([
        m(
          "Late payment fee of Rs.750 has been levied on your HDFC Bank Credit Card XX1234.",
        ),
      ])[0].kind,
    ).toBe("late_fee");
  });
  it("an EMI bounce", () => {
    expect(
      debtStress([
        m(
          "Your EMI of Rs 4,500 for loan XX12 has bounced due to insufficient funds.",
        ),
      ])[0].kind,
    ).toBe("bounce");
  });
  it("a reminder to avoid a late fee is not stress", () => {
    expect(
      debtStress([
        m(
          "Pay your SBI Card bill of Rs 12,000 by 05-Nov to avoid late payment charges. Min amount due Rs 600.",
        ),
      ]),
    ).toEqual([]);
  });
  it("only the minimum due paid", () => {
    const out = debtStress([
      m(
        "Your ICICI Credit Card XX4321 statement: Total Amount Due Rs 24,000.00, Minimum Amount Due Rs 1,200.00, due by 10-Nov.",
        "2026-10-20",
      ),
      m(
        "Payment of Rs 1,200.00 received towards your ICICI Bank Credit Card XX4321. Thank you.",
        "2026-11-08",
        1200,
      ),
    ]);
    expect(out.map((s) => s.kind)).toEqual(["min_due_only"]);
  });
  it("the full bill paid is not stress", () => {
    expect(
      debtStress([
        m(
          "Total Amount Due Rs 24,000.00, Minimum Amount Due Rs 1,200.00 on your Credit Card XX4321",
          "2026-10-20",
        ),
        m(
          "Payment of Rs 24,000.00 received towards your Credit Card XX4321.",
          "2026-11-08",
          24000,
        ),
      ]),
    ).toEqual([]);
  });
});

describe("finding cards in bank messages", () => {
  it("“SBI Credit Card ending 0543”", () => {
    expect(
      cardOf(
        "Rs.244.00 spent on your SBI Credit Card ending 0543 at DOMINOS on 28/10/26.",
      ),
    ).toEqual({ bank: "SBI", last4: "0543" });
  });
  it("HDFC “Credit Card XX1234”, ICICI “Card XX9876”", () => {
    expect(
      cardOf(
        "Rs.499 spent on HDFC Bank Credit Card XX1234 at SWIGGY on 2026-10-30",
      ),
    ).toEqual({ bank: "HDFC", last4: "1234" });
    expect(
      cardOf(
        "INR 1,250.00 spent using ICICI Bank Credit Card XX9876 on 30-Oct-26 on AMAZON.",
      ),
    ).toEqual({ bank: "ICICI", last4: "9876" });
  });
  it("debit cards are not credit cards", () => {
    expect(
      isCreditCardMessage(
        "Rs 500 spent on your HDFC Bank Debit Card XX1234 at DMART",
      ),
    ).toBe(false);
  });
  it("groups spends per card and guesses the product from the alert", () => {
    const out = detectCards([
      {
        id: "1",
        body: "Rs.244.00 spent on your SBI Credit Card ending 0543 at DOMINOS",
        received_at: "2026-10-28T10:00:00Z",
        expense_id: "e1",
      },
      {
        id: "2",
        body: "Rs.131.24 spent on your SBI Credit Card ending 0543 at RESTAURANTBRANDSASIA",
        received_at: "2026-10-29T10:00:00Z",
        expense_id: "e2",
      },
      {
        id: "3",
        body: "INR 999 spent on Amazon Pay ICICI Credit Card XX4321 at AMAZON",
        received_at: "2026-10-27T10:00:00Z",
        expense_id: "e3",
      },
    ]);
    expect(out).toEqual([
      {
        bank: "SBI",
        last4: "0543",
        productGuess: null,
        spends: 2,
        lastSeen: "2026-10-29T10:00:00Z",
      },
      {
        bank: "ICICI",
        last4: "4321",
        productGuess: "icici-amazon-pay",
        spends: 1,
        lastSeen: "2026-10-27T10:00:00Z",
      },
    ]);
  });
});

describe("cards survive the masking applied before storage", () => {
  it("keeps bank and last four after redactForAI", async () => {
    const { redactForAI } = await import("../redact");
    const body = redactForAI(
      "Rs.244.00 spent on your SBI Credit Card ending 0543 at DOMINOS on 28/10/26. Call 18001801290 if not you.",
    );
    expect(cardOf(body)).toEqual({ bank: "SBI", last4: "0543" });
    const hdfc = redactForAI(
      "Rs.499 spent on HDFC Bank Credit Card XX1234 at SWIGGY on 2026-10-30. Not you? Call 18002586161",
    );
    expect(cardOf(hdfc)).toEqual({ bank: "HDFC", last4: "1234" });
  });
});

describe("salary estimate for approval chances", () => {
  it("averages credits named salary per month, ignoring transfers from people", async () => {
    const { salaryPerMonth } = await import("./service");
    expect(
      salaryPerMonth([
        { amount: 60000, source: "Salary", income_date: "2026-09-01" },
        {
          amount: 62000,
          source: "SALARY ACME PVT LTD",
          income_date: "2026-10-01",
        },
        { amount: 31000, source: "Mridul Sharma", income_date: "2026-10-30" },
      ]),
    ).toBe(61000);
    expect(
      salaryPerMonth([
        { amount: 31000, source: "Mridul Sharma", income_date: "2026-10-30" },
      ]),
    ).toBeNull();
  });
});

describe("use this card for…", () => {
  const held: HeldCard[] = [
    { id: "A", bank: "Test", last4: "1111", product: plain },
    { id: "B", bank: "Test", last4: "2222", product: swiggyCard },
  ];
  it("picks your best card for each top place you spend", () => {
    const out = useFor(held, [
      txn({ merchant: "Swiggy", amount: 3000 }),
      txn({ merchant: "Zara", amount: 1000 }),
      txn({ merchant: "HPCL Petrol", category: "Transport", amount: 2000 }),
    ]);
    expect(out[0]).toMatchObject({
      label: "Swiggy",
      cardId: "B",
      rate: 10,
      runnerUp: { cardId: "A", rate: 1 },
    });
    // Fuel: both cards exclude it, so it isn't listed.
    expect(out.find((u) => u.label === "HPCL Petrol")).toBeUndefined();
  });
  it("needs two cards to be useful", () => {
    expect(useFor([held[0]], [txn({ merchant: "Swiggy" })])).toEqual([]);
  });
});

describe("the card catalogue", () => {
  it("every product hint in bank alerts names a real catalogue card", async () => {
    const { productByKey, CATALOG } = await import("./catalog");
    const src = (await import("node:fs")).readFileSync(
      new URL("./detect.ts", import.meta.url),
      "utf8",
    );
    const keys = [...src.matchAll(/\/i, "([a-z0-9-]+)"\]/g)]
      .map((m) => m[1])
      .filter((k) => k.includes("-") || k === "onecard");
    expect(keys.length).toBeGreaterThan(10);
    for (const k of keys) expect(productByKey(k), k).not.toBeNull();
    expect(CATALOG.length).toBeGreaterThan(40);
  });
  it("every rule is usable: a rate, and something to match", async () => {
    const { CATALOG } = await import("./catalog");
    for (const c of CATALOG) {
      expect(c.baseRate, c.key).toBeGreaterThanOrEqual(0);
      for (const r of c.rules) {
        expect(typeof r.rate, `${c.key}: ${r.label}`).toBe("number");
        expect(
          (r.merchants?.length ?? 0) + (r.categories?.length ?? 0),
          `${c.key}: ${r.label}`,
        ).toBeGreaterThan(0);
      }
    }
  });
  it("keys are unique", async () => {
    const { CATALOG } = await import("./catalog");
    expect(new Set(CATALOG.map((c) => c.key)).size).toBe(CATALOG.length);
  });
});

describe("one-off big purchases don't drive yearly estimates", () => {
  it("a single ₹1.5 lakh laptop is left out of next-card projections", () => {
    const held: HeldCard[] = [];
    const txns = [
      txn({ merchant: "Laptop", amount: 150000, date: "2026-08-31" }),
      txn({ merchant: "Swiggy", amount: 3000 }),
    ];
    const [best] = nextCards(
      [swiggyCard, card({ key: "flat2", baseRate: 2 })],
      held,
      txns,
      90,
      { monthlyIncome: null, score: "unknown" },
    );
    // Without the laptop, the Swiggy card wins; with it, a 2% flat card would.
    expect(best.product.key).toBe("swiggy5");
  });
  it("big repeated spends (rent-like) stay", async () => {
    const { withoutOneOffs } = await import("./engine");
    const out = withoutOneOffs([
      txn({ merchant: "Landlord", amount: 25000, date: "2026-09-01" }),
      txn({ merchant: "Landlord", amount: 25000, date: "2026-10-01" }),
      txn({ merchant: "iPhone", amount: 80000 }),
    ]);
    expect(out.map((t) => t.merchant)).toEqual(["Landlord", "Landlord"]);
  });
});

describe("merchant rules stay with their merchants", () => {
  it("“10% on Swiggy” with a food-delivery tag doesn't pay 10% on Zomato or Zepto", () => {
    const c = card({
      key: "sw",
      rules: [
        {
          label: "10% on Swiggy",
          merchants: ["swiggy"],
          categories: ["food-delivery", "groceries"],
          rate: 10,
        },
      ],
    });
    expect(
      rateFor(
        c,
        readTxn(txn({ merchant: "Swiggy", category: "Food delivery" })),
        "card",
      ).rate,
    ).toBe(10);
    expect(
      rateFor(
        c,
        readTxn(txn({ merchant: "Zomato", category: "Food delivery" })),
        "card",
      ).rate,
    ).toBe(1);
    expect(
      rateFor(
        c,
        readTxn(txn({ merchant: "Zepto Marketplace", category: "Groceries" })),
        "card",
      ).rate,
    ).toBe(1);
  });
});

describe("breakdown: every card you hold, side by side", () => {
  it("a missed line lists what each held card pays there and the spends behind it", () => {
    const held: HeldCard[] = [
      { id: "A", bank: "Test", last4: "1111", product: plain },
      { id: "B", bank: "Test", last4: "2222", product: swiggyCard },
    ];
    const r = missedRewards(
      held,
      [
        txn({
          merchant: "Swiggy",
          amount: 400,
          date: "2026-10-02",
          cardId: "A",
        }),
        txn({
          merchant: "Swiggy",
          amount: 600,
          date: "2026-10-20",
          cardId: "A",
        }),
      ],
      30,
    );
    expect(r.lines[0].options).toEqual([
      { cardId: "B", rate: 10, why: "10% on Swiggy" },
      { cardId: "A", rate: 1, why: expect.any(String) },
    ]);
    expect(r.lines[0].spends).toEqual([
      { date: "2026-10-20", amount: 600 },
      { date: "2026-10-02", amount: 400 },
    ]);
  });
});

describe("card health: fee waiver, milestones, rule changes", () => {
  const product = card({
    key: "health",
    annualFee: 1000,
    feeWaiverSpend: 100000,
    milestones: [
      {
        spendYearly: 300000,
        valueRs: 1500,
        label: "₹1,500 voucher at ₹3L a year",
      },
    ],
    changes: [
      { date: "2027-01-01", change: "Swiggy orders under ₹249 earn 1%" },
      {
        date: "2026-09-01",
        change: "Insurance capped at 2,000 points a month",
      },
      { date: "2025-01-01", change: "Old change, more than a year ago" },
    ],
  });
  const spends = [
    txn({ amount: 9000, merchant: "Swiggy", date: "2026-10-05" }),
    txn({ amount: 9000, merchant: "Amazon", date: "2026-10-20" }),
  ];
  const h = cardHealth(product, spends, 60, "2026-11-01", [
    "Swiggy",
    "Amazon",
    "Other spends",
  ]);
  it("projects the pace of spending over a year", () => {
    expect(h.spend).toBe(18000);
    expect(h.yearlyPace).toBe(109500);
  });
  it("says whether that pace waives the fee and reaches milestones", () => {
    expect(h.feeWaiver).toEqual({
      target: 100000,
      pace: 109500,
      onTrack: true,
    });
    expect(h.milestones[0]).toMatchObject({
      target: 300000,
      valueRs: 1500,
      onTrack: false,
    });
  });
  it("keeps the last year of changes, flags upcoming ones and those touching your spends", () => {
    expect(h.changes).toHaveLength(2);
    expect(h.changes[0]).toMatchObject({
      upcoming: true,
      recent: false,
      affectsYou: true,
    });
    expect(h.changes[1]).toMatchObject({
      upcoming: false,
      recent: true,
      affectsYou: false,
    });
  });
  it("one-off big purchases don't make the fee look waived", () => {
    const big = cardHealth(
      product,
      [txn({ amount: 150000, merchant: "Laptop" })],
      60,
      "2026-11-01",
    );
    expect(big.feeWaiver?.onTrack).toBe(false);
  });
  it("no fee waiver line for a card without a fee", () => {
    expect(cardHealth(plain, spends, 60, "2026-11-01").feeWaiver).toBeNull();
  });
});

describe("spend tip: next time here, use this card", () => {
  const held: HeldCard[] = [
    { id: "p", bank: "Test", last4: "1111", product: plain },
    { id: "s", bank: "Test", last4: "2222", product: swiggyCard },
  ];
  it("names the better card, its cap, and the rupees more", () => {
    const tip = spendTip(
      held,
      txn({
        merchant: "Swiggy",
        category: "Food delivery",
        amount: 600,
        cardId: "p",
      }),
    );
    expect(tip).toMatchObject({
      cardId: "s",
      rate: 10,
      capMonthly: 1500,
      paidWith: "p",
      paidRate: 1,
      extra: 54,
    });
  });
  it("silent when you already used the best card", () => {
    expect(
      spendTip(held, txn({ merchant: "Swiggy", amount: 600, cardId: "s" })),
    ).toBeNull();
  });
  it("silent below ₹10 more, or on excluded and skipped spends", () => {
    expect(
      spendTip(held, txn({ merchant: "Swiggy", amount: 90, cardId: "p" })),
    ).toBeNull();
    expect(
      spendTip(
        held,
        txn({ category: "Investments", amount: 9000, cardId: "p" }),
      ),
    ).toBeNull();
  });
  it("silent with one named card or an unknown card", () => {
    expect(
      spendTip(
        held.slice(0, 1),
        txn({ merchant: "Swiggy", amount: 600, cardId: "p" }),
      ),
    ).toBeNull();
    expect(
      spendTip(held, txn({ merchant: "Swiggy", amount: 600, cardId: null })),
    ).toBeNull();
  });
  it("UPI in Swiggy's app: tip to pay by card; UPI at a shop: nothing", () => {
    expect(
      spendTip(held, txn({ merchant: "Swiggy", amount: 600, channel: "upi" })),
    ).toMatchObject({ cardId: "s", paidWith: "upi", extra: 60 });
    expect(
      spendTip(
        held,
        txn({ merchant: "Sharma Kirana", amount: 2000, channel: "upi" }),
      ),
    ).toBeNull();
  });
  it("no UPI tip when a card of yours works on UPI (it may have been paid by card)", () => {
    const withRupay = [
      ...held,
      { id: "r", bank: "T", last4: "3333", product: rupay },
    ];
    expect(
      spendTip(
        withRupay,
        txn({ merchant: "Swiggy", amount: 600, channel: "upi" }),
      ),
    ).toBeNull();
  });
});
