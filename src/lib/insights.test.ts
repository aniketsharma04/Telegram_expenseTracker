import { describe, expect, it } from "vitest";
import {
  budgetProgress,
  detectAnomalies,
  detectRecurring,
  settleUp,
} from "./insights";

const e = (
  amount: number,
  category: string,
  merchant: string | null,
  expense_date: string,
  user_id?: number,
  paid_by?: number,
) => ({ amount, category, merchant, expense_date, user_id, paid_by });

describe("budgetProgress", () => {
  const budgets = [
    { id: "b1", category: null, monthly_cap: 10000 },
    { id: "b2", category: "Groceries", monthly_cap: 3000 },
  ];

  it("tracks category and overall caps, excluding investments from overall", () => {
    const progress = budgetProgress(
      budgets,
      [
        e(2000, "Groceries", null, "2026-08-05"),
        e(3000, "Food delivery", null, "2026-08-10"),
        e(5000, "Investments", null, "2026-08-11"), // not "spending"
        e(999, "Groceries", null, "2026-07-30"), // last month
      ],
      "2026-08-22",
    );
    expect(progress[0].spent).toBe(5000);
    expect(progress[0].pct).toBeCloseTo(0.5);
    expect(progress[1].spent).toBe(2000);
  });
});

describe("detectRecurring", () => {
  it("finds a monthly charge and predicts the next date", () => {
    const found = detectRecurring(
      [
        e(649, "Entertainment", "Netflix", "2026-06-24"),
        e(649, "Entertainment", "Netflix", "2026-07-24"),
        e(649, "Entertainment", "Netflix", "2026-08-24"),
      ],
      "2026-08-26",
    );
    expect(found).toHaveLength(1);
    expect(found[0].nextDate).toBe("2026-09-24"); // last + rounded median gap (median of [30,31] → 31)
    expect(found[0].amount).toBe(649);
  });

  it("ignores irregular gaps and varying amounts", () => {
    expect(
      detectRecurring(
        [
          e(500, "Food delivery", "Zomato", "2026-08-01"),
          e(300, "Food delivery", "Zomato", "2026-08-04"),
          e(800, "Food delivery", "Zomato", "2026-08-19"),
        ],
        "2026-08-22",
      ),
    ).toHaveLength(0);
  });

  it("needs a merchant", () => {
    expect(
      detectRecurring(
        [e(649, "Entertainment", null, "2026-07-24"), e(649, "Entertainment", null, "2026-08-24")],
        "2026-08-26",
      ),
    ).toHaveLength(0);
  });
});

describe("detectAnomalies", () => {
  it("flags a category at double its usual pace", () => {
    const anomalies = detectAnomalies(
      [
        // history: ~1500/month
        e(1500, "Food delivery", null, "2026-06-15"),
        e(1400, "Food delivery", null, "2026-07-15"),
        // this month: 3000 by the 15th (~pace 6000)
        e(3000, "Food delivery", null, "2026-08-10"),
      ],
      "2026-08-15",
    );
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].category).toBe("Food delivery");
  });

  it("stays quiet without enough history or below thresholds", () => {
    expect(
      detectAnomalies([e(3000, "Food delivery", null, "2026-08-10")], "2026-08-15"),
    ).toHaveLength(0);
    expect(
      detectAnomalies(
        [
          e(1500, "Groceries", null, "2026-06-15"),
          e(1400, "Groceries", null, "2026-07-15"),
          e(900, "Groceries", null, "2026-08-10"), // above pace but < ₹1000
        ],
        "2026-08-15",
      ),
    ).toHaveLength(0);
  });

  it("never flags EMI/investments", () => {
    expect(
      detectAnomalies(
        [
          e(5000, "Loans & EMI", null, "2026-06-05"),
          e(5000, "Loans & EMI", null, "2026-07-05"),
          e(20000, "Loans & EMI", null, "2026-08-05"),
        ],
        "2026-08-15",
      ),
    ).toHaveLength(0);
  });
});

describe("settleUp", () => {
  it("nets pairwise balances from split rows", () => {
    const entries = settleUp([
      // A(1) paid 1200, split with B(2): B's share row says B owes A 600
      e(600, "Food delivery", "Dinner", "2026-08-20", 2, 1),
      e(600, "Food delivery", "Dinner", "2026-08-20", 1, 1), // A's own share — ignored
      // B paid 400, A's share 200 → A owes B 200; nets to B owes A 400
      e(200, "Transport", "Cab", "2026-08-21", 1, 2),
    ]);
    expect(entries).toEqual([{ from: 2, to: 1, amount: 400 }]);
  });

  it("returns nothing when settled", () => {
    expect(
      settleUp([
        e(300, "Groceries", null, "2026-08-20", 2, 1),
        e(300, "Groceries", null, "2026-08-21", 1, 2),
      ]),
    ).toHaveLength(0);
  });
});
