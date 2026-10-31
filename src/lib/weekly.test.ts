import { describe, expect, it } from "vitest";
import { composeWeeklyReview, isReviewDay } from "./weekly";

const e = (
  expense_date: string,
  amount: number,
  category: string,
  merchant: string | null = null,
) => ({
  expense_date,
  amount,
  category,
  merchant,
});

// Review sent Mon 2 Nov 2026 covers Mon 26 Oct – Sun 1 Nov.
const TODAY = "2026-11-02";

/** Four earlier weeks of ₹1,400 dining + ₹2,000 groceries. */
function history() {
  const out = [];
  for (const start of [
    "2026-09-28",
    "2026-10-05",
    "2026-10-12",
    "2026-10-19",
  ]) {
    out.push(
      e(start, 1400, "Dining out", "Cafe"),
      e(start, 2000, "Groceries", "DMart"),
    );
  }
  return out;
}

describe("composeWeeklyReview", () => {
  it("sends nothing for a week with no spending", () => {
    expect(
      composeWeeklyReview({ expenses: history(), today: TODAY }),
    ).toBeNull();
  });

  it("flags the category that ran over and suggests a cap", () => {
    const r = composeWeeklyReview({
      expenses: [
        ...history(),
        e("2026-10-26", 3200, "Dining out", "Barbeque Nation"),
        e("2026-10-28", 2000, "Groceries", "DMart"),
        e("2026-10-30", 50000, "Investments", "SIP"),
      ],
      today: TODAY,
    })!;
    expect(r.total).toBe(5200);
    expect(r.usual).toBe(3400);
    expect(r.html).toContain("26 Oct – 1 Nov");
    expect(r.html).toContain("₹1,800 more than your usual week");
    expect(r.html).toContain("Dining out ₹3,200 (↑ ₹1,800)");
    expect(r.html).toContain("Biggest: ₹3,200 at Barbeque Nation (Mon)");
    expect(r.html).toContain("Logged on 3 of 7 days.");
    expect(r.html).toContain("Try keeping Dining out under ₹1,400 this week");
    expect(r.html).not.toContain("Investments");
  });

  it("congratulates a lighter week and points the saving at a goal", () => {
    const r = composeWeeklyReview({
      expenses: [...history(), e("2026-10-27", 1000, "Groceries", "Zepto")],
      today: TODAY,
      goalNames: ["Goa trip"],
      subscriptions: { monthly: 768, count: 2, undecided: 1 },
    })!;
    expect(r.html).toContain("₹2,400 less than your usual week 👏");
    expect(r.html).toContain("towards <b>Goa trip</b>");
    expect(r.html).toContain("Subscriptions: 2 · ₹768 a month · 1 to review");
  });

  it("explains there's no comparison yet for a new user", () => {
    const r = composeWeeklyReview({
      expenses: [e("2026-10-29", 450, "Food delivery", "Swiggy")],
      today: TODAY,
    })!;
    expect(r.usual).toBeNull();
    expect(r.html).not.toContain("usual week");
    expect(r.html).toContain("from next week I'll compare");
  });

  it("celebrates logging every day and escapes names", () => {
    const days = [
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ];
    const r = composeWeeklyReview({
      expenses: days.map((d) => e(d, 100, "Dining out", "A&B <Cafe>")),
      today: TODAY,
    })!;
    expect(r.html).toContain("Logged every day");
    expect(r.html).toContain("A&amp;B &lt;Cafe&gt;");
  });
});

describe("isReviewDay", () => {
  it("is Monday only", () => {
    expect(isReviewDay("2026-11-02")).toBe(true);
    expect(isReviewDay("2026-11-01")).toBe(false);
  });
});
