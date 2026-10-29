import { describe, expect, it } from "vitest";
import {
  emi,
  fill,
  goalAdvice,
  guessGoalKind,
  maxLoanFor,
  salarySplit,
} from "./money-rules";

describe("salary split", () => {
  it("checks a plan against 50/30/20", () => {
    // The user's own plan: ₹30k income, ₹6k fixed, ₹9k saved.
    const s = salarySplit({
      income: 30000,
      fixed: 6000,
      savingsGoal: 9000,
      goals: 0,
    })!;
    expect(s.rule).toBe("50/30/20");
    expect(s.pct).toEqual({ needs: 20, wants: 50, save: 30 });
    expect(s.status).toBe("good");
    expect(s.suggestSavingsGoal).toBeNull();
  });

  it("suggests lifting saving to 20% out of wants", () => {
    const s = salarySplit({
      income: 50000,
      fixed: 20000,
      savingsGoal: 2000,
      goals: 1000,
    })!;
    expect(s.status).toBe("low_savings");
    // 20% of 50k = 10k; 3k saved already, so the savings goal grows by 7k.
    expect(s.suggestSavingsGoal).toBe(9000);
  });

  it("switches to 60/20/20 when needs pass half the income", () => {
    const s = salarySplit({
      income: 40000,
      fixed: 22000,
      savingsGoal: 8000,
      goals: 0,
    })!;
    expect(s.rule).toBe("60/20/20");
    expect(s.target).toEqual({ needs: 60, wants: 20, save: 20 });
    expect(s.status).toBe("good");
  });

  it("flags needs above 60% and only suggests what wants can give", () => {
    const s = salarySplit({
      income: 30000,
      fixed: 27000,
      savingsGoal: 1000,
      goals: 0,
    })!;
    expect(s.status).toBe("high_needs");
    expect(s.amounts.wants).toBe(2000);
    expect(s.suggestSavingsGoal).toBe(3000);
  });

  it("has nothing to say without an income", () => {
    expect(
      salarySplit({ income: 0, fixed: 0, savingsGoal: 0, goals: 0 }),
    ).toBeNull();
  });
});

describe("loan maths", () => {
  it("matches the standard EMI formula", () => {
    // ₹5.6L at 8% for 48 months ≈ ₹13,670 (Money9's worked example says ~₹13,500).
    expect(Math.round(emi(560000, 8, 48))).toBe(13671);
  });

  it("maxLoanFor inverts emi", () => {
    const loan = maxLoanFor(10000, 9, 48);
    expect(Math.round(emi(loan, 9, 48))).toBe(10000);
  });
});

describe("goal kinds", () => {
  it("reads the kind from the goal's name", () => {
    expect(guessGoalKind("New car")).toBe("car");
    expect(guessGoalKind("Nexon EV")).toBe("car");
    expect(guessGoalKind("Royal Enfield")).toBe("bike");
    expect(guessGoalKind("Activa")).toBe("bike");
    expect(guessGoalKind("2BHK flat")).toBe("home");
    expect(guessGoalKind("iPhone 17")).toBe("gadget");
    expect(guessGoalKind("Goa trip")).toBe("trip");
    expect(guessGoalKind("Emergency fund")).toBe("emergency");
    expect(guessGoalKind("Wedding")).toBe("other");
  });
});

describe("goal advice", () => {
  it("applies 20/4/10 to a car that fits", () => {
    const a = goalAdvice({
      kind: "car",
      target: 400000,
      income: 100000,
      monthlySpend: 0,
    });
    expect(a?.kind).toBe("car");
    if (a?.kind !== "car") return;
    expect(a.down).toBe(80000);
    expect(a.months).toBe(48);
    expect(a.emiCap).toBe(10000);
    expect(a.fits).toBe(true);
    expect(a.suggestTarget).toBe(80000);
  });

  it("finds the car that fits when the price doesn't", () => {
    // Money9: a ₹7L car on ₹1L a month breaks the rule.
    const a = goalAdvice({
      kind: "car",
      target: 700000,
      income: 100000,
      monthlySpend: 0,
    });
    if (a?.kind !== "car") throw new Error("expected car advice");
    expect(a.fits).toBe(false);
    expect(a.maxPrice).toBeGreaterThan(450000);
    expect(a.maxPrice).toBeLessThan(560000);
    expect(a.suggestTarget).toBe(Math.ceil((a.maxPrice * 0.2) / 1000) * 1000);
  });

  it("says pay cash for a bike worth two months' pay or less", () => {
    const a = goalAdvice({
      kind: "bike",
      target: 90000,
      income: 50000,
      monthlySpend: 0,
    });
    expect(a?.kind === "bike" && a.cashOk).toBe(true);
  });

  it("applies 20/30/40 to a home", () => {
    const a = goalAdvice({
      kind: "home",
      target: 5000000,
      income: 100000,
      monthlySpend: 0,
    });
    if (a?.kind !== "home") throw new Error("expected home advice");
    expect(a.rule).toBe("20/30/40");
    expect(a.down).toBe(1000000);
    expect(a.emiCap).toBe(30000);
    expect(a.incomeYears).toBe(4.2);
  });

  it("sizes an emergency fund at six months of spending", () => {
    const a = goalAdvice({
      kind: "emergency",
      target: 0,
      income: 30000,
      monthlySpend: 21000,
    });
    expect(a).toEqual({
      kind: "emergency",
      monthlySpend: 21000,
      suggestTarget: 126000,
    });
  });

  it("needs a price and an income for the rest", () => {
    expect(
      goalAdvice({ kind: "car", target: 0, income: 50000, monthlySpend: 0 }),
    ).toBeNull();
    expect(
      goalAdvice({ kind: "trip", target: 60000, income: 0, monthlySpend: 0 }),
    ).toBeNull();
    expect(
      goalAdvice({
        kind: "other",
        target: 60000,
        income: 50000,
        monthlySpend: 0,
      }),
    ).toBeNull();
  });
});

describe("fill", () => {
  it("fills placeholders and leaves unknown ones", () => {
    expect(fill("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });
});
