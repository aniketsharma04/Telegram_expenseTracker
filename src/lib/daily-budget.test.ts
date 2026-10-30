import { describe, expect, it } from "vitest";
import {
  computeDailyStatus,
  eveningReport,
  morningBrief,
  isBigSpend,
  scopeExpenses,
  spendLine,
} from "./daily-budget";

const e = (
  amount: number,
  category: string,
  merchant: string | null,
  expense_date: string,
  budget_scope: "daily" | "fixed" | "savings" | null = null,
) => ({ amount, category, merchant, expense_date, budget_scope });

const plan = { monthly_income: 100000, savings_goal: 15000 };
const commitments = [
  {
    id: "rent",
    name: "Rent",
    amount: 25000,
    category: "Utilities & bills",
    match: "rent",
  },
  {
    id: "emi",
    name: "EMI",
    amount: 10000,
    category: "Loans & EMI",
    match: null,
  },
];

describe("computeDailyStatus", () => {
  it("takes fixed costs and savings off the top (30-day month)", () => {
    const s = computeDailyStatus({
      plan,
      commitments,
      expenses: [e(25000, "Utilities & bills", "rent", "2026-09-01")],
      today: "2026-09-01",
    });
    expect(s.pool).toBe(50000);
    expect(s.todayBudget).toBe(1667);
    expect(s.todaySpent).toBe(0); // rent doesn't touch the day
  });

  it("rolls yesterday's overspend into the days ahead", () => {
    const s = computeDailyStatus({
      plan,
      commitments,
      expenses: [
        e(200, "Dining out", "Starbucks", "2026-09-01"),
        e(400, "Groceries", "Blinkit", "2026-09-01"),
        e(600, "Food delivery", "Swiggy", "2026-09-01"),
        e(600, "Shopping", "Amazon", "2026-09-01"),
      ],
      today: "2026-09-02",
    });
    expect(s.history[0]).toEqual({
      date: "2026-09-01",
      budget: 1667,
      spent: 1800,
    });
    expect(s.todayBudget).toBe(Math.round((50000 - 1800) / 29)); // 1662
    expect(s.streak).toBe(0);
  });

  it("doesn't count days before tracking started toward the streak", () => {
    // Joined on the 28th: the empty days before it aren't days "under budget".
    const fresh = computeDailyStatus({
      plan,
      commitments,
      expenses: [],
      today: "2026-09-30",
      trackingSince: "2026-09-28",
    });
    expect(fresh.streak).toBe(2); // the 28th and 29th
    const joinedToday = computeDailyStatus({
      plan,
      commitments,
      expenses: [],
      today: "2026-09-30",
      trackingSince: "2026-09-30",
    });
    expect(joinedToday.streak).toBe(0);
    // Without a start date it behaves as before.
    const legacy = computeDailyStatus({
      plan,
      commitments,
      expenses: [],
      today: "2026-09-30",
    });
    expect(legacy.streak).toBe(29);
  });

  it("spreads a big purchase, and 'from savings' leaves the day alone", () => {
    const base = { plan, commitments, today: "2026-09-10" };
    const spread = computeDailyStatus({
      ...base,
      expenses: [e(12000, "Shopping", "Phone", "2026-09-10")],
    });
    expect(spread.todayLeft).toBeLessThan(0);
    expect(spread.tomorrowBudget).toBe(Math.round((50000 - 12000) / 20));

    const saved = computeDailyStatus({
      ...base,
      expenses: [e(12000, "Shopping", "Phone", "2026-09-10", "savings")],
    });
    expect(saved.todaySpent).toBe(0);
    expect(saved.savedFromSavings).toBe(12000);
  });

  it("asks for an income when there's none", () => {
    const s = computeDailyStatus({
      plan: null,
      commitments: [],
      expenses: [],
      today: "2026-09-05",
    });
    expect(s.ready).toBe(false);
    expect(s.reason).toBe("no_income");
  });

  it("falls back to last month's income", () => {
    const s = computeDailyStatus({
      plan: null,
      commitments: [],
      expenses: [],
      today: "2026-09-01",
      lastMonthIncome: 30000,
    });
    expect(s.incomeSource).toBe("last_month");
    expect(s.todayBudget).toBe(1000);
  });
});

describe("scopeExpenses", () => {
  it("counts only the over-plan part of a fixed cost", () => {
    const [bill] = scopeExpenses(
      [e(3000, "Utilities & bills", "BSES", "2026-09-05")],
      [
        {
          id: "el",
          name: "Electricity",
          amount: 2000,
          category: "Utilities & bills",
          match: "bses",
        },
      ],
    );
    expect(bill.scope).toBe("fixed");
    expect(bill.dailyAmount).toBe(1000);
  });

  it("lets a category+amount commitment claim only one expense a month", () => {
    const netflix = [
      {
        id: "nf",
        name: "Netflix",
        amount: 649,
        category: "Entertainment",
        match: null,
      },
    ];
    const [a, b] = scopeExpenses(
      [
        e(649, "Entertainment", "NFLX", "2026-09-03"),
        e(600, "Entertainment", "PVR", "2026-09-04"),
      ],
      netflix,
    );
    expect(a.scope).toBe("fixed");
    expect(b.scope).toBe("daily");
  });

  it("keeps investments and EMI out of everyday spending", () => {
    const rows = scopeExpenses(
      [
        e(5000, "Investments", "Groww", "2026-09-05"),
        e(8000, "Loans & EMI", "CRED", "2026-09-05"),
      ],
      [],
    );
    expect(rows.map((r) => r.dailyAmount)).toEqual([0, 0]);
  });
});

describe("spend messages", () => {
  it("offers 'from savings' for a big daily spend", () => {
    const s = computeDailyStatus({
      plan,
      commitments,
      today: "2026-09-10",
      expenses: [e(12000, "Shopping", "Phone", "2026-09-10")],
    });
    expect(isBigSpend(12000, s.todayBudget)).toBe(true);
    expect(spendLine(s.today[0], s)).toContain("/fromsavings");
  });
});

describe("morning and night messages", () => {
  const s = computeDailyStatus({
    plan,
    commitments,
    today: "2026-09-02",
    expenses: [
      e(25000, "Utilities & bills", "rent", "2026-09-01"),
      e(1800, "Shopping", "Amazon", "2026-09-01"),
      e(200, "Dining out", "Starbucks", "2026-09-02"),
    ],
  });

  it("leads the morning with today's number and yesterday's result", () => {
    const text = morningBrief(s, "Aniket", s.history[0]);
    expect(text).toContain("Good morning, Aniket");
    expect(text).toContain("<b>₹1,662</b>");
    expect(text).toContain("₹133 over");
  });

  it("lists today's spends at night and leaves fixed costs out", () => {
    const text = eveningReport(s, "2026-09-02");
    expect(text).toContain("Starbucks −₹200");
    expect(text).toContain("Tomorrow's budget");
    expect(text).not.toContain("rent");
  });

  it("asks for an income instead of inventing a number", () => {
    const empty = computeDailyStatus({
      plan: null,
      commitments: [],
      expenses: [],
      today: "2026-09-02",
    });
    expect(morningBrief(empty, null, null)).toContain("/plan 100000");
  });
});

describe("push text", () => {
  it("puts the number in the title and offers savings for big spends", async () => {
    const { morningPush, spendPush } = await import("./daily-budget");
    const s = computeDailyStatus({
      plan,
      commitments,
      today: "2026-09-10",
      expenses: [
        {
          id: "x",
          amount: 12000,
          category: "Shopping",
          merchant: "Phone",
          expense_date: "2026-09-10",
          budget_scope: null,
        },
      ],
    });
    expect(morningPush(s, null).title).toBe(
      `Today you can spend ₹${s.todayBudget.toLocaleString("en-IN")}`,
    );
    const push = spendPush(s.today[0], s);
    expect(push.title).toBe("Phone −₹12,000");
    expect(push.bigSpend).toBe(true);
    expect(push.body).not.toContain("/fromsavings"); // app wording, not bot commands
  });
});

describe("salary cycles", () => {
  it("is the calendar month without a payday", async () => {
    const { cycleFor } = await import("./daily-budget");
    expect(cycleFor("2026-10-24", null)).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
      days: 31,
      dayIndex: 24,
    });
  });

  it("runs payday to the day before the next payday", async () => {
    const { cycleFor } = await import("./daily-budget");
    expect(cycleFor("2026-10-24", 30)).toEqual({
      start: "2026-09-30",
      end: "2026-10-29",
      days: 30,
      dayIndex: 25,
    });
    expect(cycleFor("2026-10-30", 30)).toMatchObject({
      start: "2026-10-30",
      dayIndex: 1,
    });
  });

  it("pays on the last day when the month is short", async () => {
    const { cycleFor } = await import("./daily-budget");
    // Paid on the 31st → in February that's the 28th.
    expect(cycleFor("2027-03-05", 31)).toEqual({
      start: "2027-02-28",
      end: "2027-03-30",
      days: 31,
      dayIndex: 6,
    });
    expect(cycleFor("2027-02-27", 31)).toMatchObject({
      start: "2027-01-31",
      end: "2027-02-27",
    });
  });

  it("budgets across the month boundary", () => {
    const s = computeDailyStatus({
      plan: { monthly_income: 60000, savings_goal: 0, payday: 25 },
      commitments: [],
      today: "2026-11-02",
      expenses: [
        e(1000, "Dining out", "Cafe", "2026-10-25"),
        e(500, "Dining out", "Cafe", "2026-10-24"), // last cycle — doesn't count
      ],
    });
    expect(s.cycleStart).toBe("2026-10-25");
    expect(s.daysInMonth).toBe(31); // 25 Oct → 24 Nov
    expect(s.dayOfMonth).toBe(9);
    expect(s.poolSpent).toBe(1000);
    expect(s.history[0].date).toBe("2026-10-25");
  });
});
