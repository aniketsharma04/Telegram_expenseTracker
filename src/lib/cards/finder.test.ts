import { describe, expect, it } from "vitest";
import { CATALOG, productByKey } from "./catalog";
import { CARD_ART, CARD_ART_HOSTS } from "./art";
import {
  findCards,
  parseAnswers,
  realSpendingUsable,
  spendFromAnswers,
  SPEND_OF_BAND,
  strengths,
  type FinderAnswers,
} from "./finder";
import type { CardProduct, CardTxn } from "./types";

const PROFILE = { monthlyIncome: 80000, score: "750+" as const };
const base: FinderAnswers = {
  goal: "value",
  fee: "any",
  platform: "mix",
  upi: false,
  spend: "15-50",
  useMySpending: false,
};
const run = (
  a: Partial<FinderAnswers>,
  extra: Partial<Parameters<typeof findCards>[0]> = {},
) =>
  findCards({
    catalog: CATALOG,
    answers: { ...base, ...a },
    txns: [],
    days: 0,
    held: [],
    profile: PROFILE,
    ...extra,
  });

describe("spending from the answers", () => {
  it("adds up to the chosen monthly spend, three months of it", () => {
    for (const spend of ["lt15", "15-50", "50-100", "100plus"] as const) {
      const txns = spendFromAnswers({ ...base, spend });
      const total = txns.reduce((s, t) => s + t.amount, 0);
      expect(Math.abs(total - SPEND_OF_BAND[spend] * 3)).toBeLessThan(60);
      expect(new Set(txns.map((t) => t.date.slice(0, 7))).size).toBe(3);
    }
  });

  it("the goal tilts the mix toward it", () => {
    const share = (a: FinderAnswers, re: RegExp) => {
      const t = spendFromAnswers(a);
      const all = t.reduce((s, x) => s + x.amount, 0);
      return (
        t
          .filter((x) => re.test(x.merchant ?? ""))
          .reduce((s, x) => s + x.amount, 0) / all
      );
    };
    expect(share({ ...base, goal: "fuel" }, /petrol/i)).toBeGreaterThan(
      2 * share(base, /petrol/i),
    );
    expect(
      share({ ...base, goal: "travel" }, /flights|hotel/i),
    ).toBeGreaterThan(2 * share(base, /flights|hotel/i));
  });

  it("the platform names where online shopping goes", () => {
    const t = spendFromAnswers({ ...base, platform: "amazon" });
    expect(t.some((x) => x.merchant === "Amazon")).toBe(true);
    expect(t.some((x) => x.merchant === "Flipkart")).toBe(false);
  });

  it("wanting UPI means small shops are paid by UPI — only RuPay cards earn there", () => {
    const upi = spendFromAnswers({ ...base, upi: true });
    expect(
      upi.filter((t) => t.channel === "upi").map((t) => t.merchant),
    ).toContain("Grocery shops");
    expect(spendFromAnswers(base).every((t) => t.channel === "card")).toBe(
      true,
    );
  });
});

describe("findCards", () => {
  it("returns three picks ranked by net value, all making money", () => {
    const r = run({});
    expect(r.basis).toBe("answers");
    expect(r.picks).toHaveLength(3);
    const nets = r.picks.map((p) => p.netYearly);
    expect(nets).toEqual([...nets].sort((a, b) => b - a));
    for (const p of r.picks) {
      expect(p.netYearly).toBeGreaterThan(0);
      expect(p.netYearly).toBe(
        p.rewardsYearly + p.milestonesYearly - p.feeYearly,
      );
    }
  });

  it("never suggests a closed or low-confidence card", () => {
    const r = run({ spend: "100plus" });
    for (const p of [...r.picks, ...r.more]) {
      expect(p.product.status ?? "active").toBe("active");
      expect(p.product.confidence).not.toBe("low");
    }
  });

  it("fee band and UPI are hard filters while cards are left", () => {
    const free = run({ fee: "free" });
    expect(free.picks.every((p) => p.product.annualFee === 0)).toBe(true);
    const upi = run({ upi: true });
    expect(upi.picks.every((p) => p.product.upi)).toBe(true);
    const cheap = run({ fee: "500" });
    expect(cheap.picks.every((p) => p.product.annualFee <= 500)).toBe(true);
  });

  it("goal-matching cards come first; fillers are marked closest fit and the relax is reported", () => {
    const r = run({ goal: "fuel", fee: "500" });
    expect(r.picks[0].strengths).toContain("fuel");
    expect(r.picks[0].closestFit).toBe(false);
    const fillers = r.picks.filter((p) => p.closestFit);
    if (fillers.length) expect(r.relaxed).toContain("goal");
    for (const p of fillers) expect(p.strengths).not.toContain("fuel");
  });

  it("a shopper on Flipkart is shown a Flipkart card", () => {
    const r = run({ goal: "shopping", platform: "flipkart", fee: "500" });
    const keys = r.picks.map((p) => p.product.key);
    expect(keys.some((k) => /flipkart/.test(k))).toBe(true);
    const fk = r.picks.find((p) => /flipkart/.test(p.product.key))!;
    expect(fk.wins[0].label).toBe("Flipkart");
  });

  it("a traveller gets travel perks spelled out", () => {
    const r = run({ goal: "travel", spend: "100plus" });
    expect(r.picks.every((p) => p.strengths.includes("travel"))).toBe(true);
    expect(r.picks.some((p) => p.fits.some((f) => /lounge/.test(f)))).toBe(
      true,
    );
  });

  it("watch-outs name exclusions that hit the spending, and caps it would reach", () => {
    const r = run({ goal: "food", platform: "food-apps", fee: "2000" });
    const all = [...r.picks, ...r.more];
    expect(
      all.some((p) => p.watchOuts.some((w) => /^No rewards on fuel/.test(w))),
    ).toBe(true);
    expect(
      all.some((p) =>
        p.watchOuts.some((w) =>
          /a month, and your spending would reach that/.test(w),
        ),
      ),
    ).toBe(true);
  });

  it("an annual fee the spending doesn't waive is a watch-out and is subtracted", () => {
    const fee: CardProduct = {
      ...productByKey("hdfc-millennia")!,
      key: "test-fee",
      annualFee: 5000,
      feeWaiverSpend: 10_000_000,
      milestones: [],
    };
    const r = findCards({
      catalog: [fee],
      answers: { ...base, spend: "100plus" },
      txns: [],
      days: 0,
      held: [],
      profile: PROFILE,
    });
    const p = r.picks[0] ?? r.more[0];
    expect(p.feeYearly).toBe(5900); // GST included
    expect(
      p.watchOuts.some((w) => /₹5,000 \+ GST a year unless you spend/.test(w)),
    ).toBe(true);
  });

  it("a card that loses money on this spending is not a pick", () => {
    const pricey: CardProduct = {
      ...productByKey("hdfc-millennia")!,
      key: "test-pricey",
      annualFee: 50_000,
      feeWaiverSpend: null,
    };
    const r = findCards({
      catalog: [pricey],
      answers: { ...base, spend: "lt15" },
      txns: [],
      days: 0,
      held: [],
      profile: PROFILE,
    });
    expect(r.picks).toEqual([]);
  });

  it("real spending is used when there's enough, and the answers' spend band is ignored", () => {
    const txns: CardTxn[] = [];
    for (let d = 0; d < 60; d += 2)
      txns.push({
        id: `t${d}`,
        amount: 600,
        date: `2026-${d < 30 ? "09" : "10"}-${String((d % 28) + 1).padStart(2, "0")}`,
        merchant: "Swiggy",
        category: "Food delivery",
        channel: "card",
      });
    expect(realSpendingUsable(txns, 60)).toBe(true);
    const r = run(
      { useMySpending: true, spend: "100plus" },
      { txns, days: 60 },
    );
    expect(r.basis).toBe("real");
    expect(r.monthlySpend).toBeLessThan(20_000);
    expect(r.picks[0].wins[0].label).toBe("Swiggy");
    // Too little history: the answers decide.
    expect(realSpendingUsable(txns.slice(0, 3), 10)).toBe(false);
  });

  it("marks a card the user already holds", () => {
    const top = run({}).picks[0].product;
    const r = run(
      {},
      { held: [{ id: "h1", bank: top.bank, last4: "1111", product: top }] },
    );
    expect(r.picks.find((p) => p.product.key === top.key)?.held).toBe(true);
  });

  it("approval chance follows income and score, and unlikely cards drop below the rest", () => {
    const r = run(
      { spend: "100plus" },
      { profile: { monthlyIncome: 20000, score: "650-699" } },
    );
    const order = r.picks.map((p) => p.eligibility.chance);
    const firstUnlikely = order.indexOf("unlikely");
    if (firstUnlikely >= 0)
      expect(order.slice(firstUnlikely).every((c) => c === "unlikely")).toBe(
        true,
      );
  });
});

describe("strengths", () => {
  it("reads what a card is good at from its rules and perks", () => {
    expect(strengths(productByKey("hdfc-swiggy-blck")!)).toContain("food");
    expect(strengths(productByKey("axis-flipkart")!)).toContain("shopping");
    expect(strengths(productByKey("axis-atlas")!)).toContain("travel");
  });
});

describe("parseAnswers", () => {
  it("accepts good answers and fills safe defaults", () => {
    expect(parseAnswers({ goal: "food", fee: "free" })).toEqual({
      goal: "food",
      fee: "free",
      platform: "mix",
      upi: false,
      spend: "15-50",
      useMySpending: true,
    });
  });
  it("rejects anything else with a reason", () => {
    expect(() => parseAnswers({ goal: "food", fee: "cheap" })).toThrow(
      /fee must be one of/,
    );
    expect(() => parseAnswers(null)).toThrow(/goal/);
  });
});

describe("card art", () => {
  it("every entry is a catalogue card; images are https from the bank's own hosts", () => {
    for (const [key, art] of Object.entries(CARD_ART)) {
      expect(productByKey(key), key).not.toBeNull();
      if (art.image) expect(art.image).toMatch(/^https:\/\//);
      if (art.page) expect(art.page).toMatch(/^https:\/\//);
      if (art.page) expect(art.page).not.toMatch(/utm_|aff|ref=|\.pdf$/i);
    }
    expect(CARD_ART_HOSTS.length).toBeGreaterThan(5);
    // No third-party aggregator in the image hosts.
    for (const h of CARD_ART_HOSTS)
      expect(h).not.toMatch(
        /monzy|cardinsider|paisabazaar|bankbazaar|great\.cards/,
      );
  });
});
