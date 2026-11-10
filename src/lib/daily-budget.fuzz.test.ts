import { describe, expect, it } from "vitest";
import {
  computeDailyStatus,
  eveningPush,
  eveningReport,
  morningBrief,
  morningPush,
  spendLine,
  spendPush,
  type BudgetExpense,
  type CommitmentLike,
} from "./daily-budget";

/**
 * Randomised months (seeded, so failures reproduce): every payday, short
 * months, leap years, joiners mid-month, overspends, fixed costs typed by
 * hand. Checks the rules the daily number must never break.
 */

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

const DAY = 86_400_000;
const add = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

const CATS = [
  "Food",
  "Shopping",
  "Transport",
  "Entertainment",
  "Utilities & bills",
];
const PAYEES = [
  "Swiggy",
  "Zomato",
  "Uber",
  "Amazon",
  "SHARMA PROPERTIES",
  "Cafe",
  null,
];

function scenario(seed: number) {
  const r = rng(seed);
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const income = Math.round(20000 + r() * 180000);
  const plan = {
    monthly_income: r() < 0.05 ? null : income,
    savings_goal: Math.round(r() * income * 0.3),
    payday: r() < 0.4 ? null : 1 + Math.floor(r() * 31),
  };
  const commitments: CommitmentLike[] = Array.from(
    { length: Math.floor(r() * 4) },
    (_, i) => ({
      id: `c${i}`,
      name: pick(["Rent", "EMI", "Netflix", "SIP", "Gym"]),
      amount: Math.round(300 + r() * 25000),
      category: r() < 0.5 ? null : pick(CATS),
      match: r() < 0.5 ? null : pick(["rent", "netflix", "sharma", "gym"]),
    }),
  );
  // Any day 2024-01-01 … 2028-12-31: covers leap Februaries.
  const today = add("2024-01-01", Math.floor(r() * 1826));
  const expenses: BudgetExpense[] = [];
  for (let d = -40; d <= 0; d++) {
    const n = Math.floor(r() * 4);
    for (let k = 0; k < n; k++)
      expenses.push({
        id: `e${d}-${k}`,
        amount: Math.round(r() < 0.05 ? 5000 + r() * 40000 : 20 + r() * 1500),
        category: pick([...CATS, "Investments", "Loans & EMI"]),
        merchant: pick(PAYEES),
        expense_date: add(today, d),
        budget_scope:
          r() < 0.1 ? pick(["daily", "fixed", "savings"] as const) : null,
      });
  }
  const trackingSince =
    r() < 0.3 ? add(today, -Math.floor(r() * 40)) : undefined;
  // A new user usually has nothing before joining; sometimes an email import backfilled it.
  const logged =
    trackingSince && r() < 0.8
      ? expenses.filter((e) => e.expense_date >= trackingSince)
      : expenses;
  return {
    plan,
    commitments,
    expenses: logged,
    today,
    trackingSince,
    goalsMonthly: r() < 0.3 ? Math.round(r() * 5000) : 0,
  };
}

const RUNS = 3000;

describe("daily budget invariants (randomised)", () => {
  it("never produces a broken number", () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const input = scenario(seed);
      const s = computeDailyStatus(input);
      const ctx = `seed ${seed} (${input.today})`;

      for (const v of [
        s.todayBudget,
        s.todaySpent,
        s.pool,
        s.poolLeft,
        s.projectedLeftover,
        s.fullPool,
      ])
        expect(Number.isFinite(v), ctx).toBe(true);
      expect(s.todayBudget, ctx).toBeGreaterThanOrEqual(0);
      expect(s.todayLeft, ctx).toBe(s.todayBudget - s.todaySpent);
      expect(s.pool, ctx).toBeLessThanOrEqual(s.fullPool);
      expect(s.daysLeft, ctx).toBe(s.daysInMonth - s.dayOfMonth + 1);
      expect(
        s.cycleStart <= input.today && input.today <= s.cycleEnd,
        ctx,
      ).toBe(true);
      expect(s.daysInMonth, ctx).toBeGreaterThanOrEqual(28);
      expect(s.daysInMonth, ctx).toBeLessThanOrEqual(31);

      // The history adds up to what the month says was spent.
      const histSpent = s.history.reduce((a, h) => a + h.spent, 0);
      expect(Math.abs(histSpent - s.poolSpent), ctx).toBeLessThanOrEqual(
        s.history.length,
      );
      expect(s.history.at(-1)?.date, ctx).toBe(input.today);
      if (s.countingFrom) expect(s.history[0].date, ctx).toBe(s.countingFrom);

      // Overspent ⇔ nothing left to hand out (given there's money at all).
      if (s.overspent)
        expect(s.todayBudget === 0 || s.poolLeft < 0, ctx).toBe(true);
      if (s.ready && s.fullPool > 0 && s.poolLeft - -s.todaySpent > s.daysLeft)
        expect(s.todayBudget, ctx).toBeGreaterThan(0);

      // Every message renders without leaking NaN/undefined.
      const texts = [
        morningBrief(s, "A", s.history.at(-2) ?? null),
        eveningReport(s, input.today),
        JSON.stringify(morningPush(s, null)),
        JSON.stringify(eveningPush(s)),
        ...s.today.map((e) => spendLine(e, s)),
        ...s.today.map((e) => JSON.stringify(spendPush(e, s))),
      ];
      for (const t of texts)
        expect(t, ctx).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it("hands out exactly the month's money to someone who spends their number", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const { plan, commitments, today, trackingSince } = scenario(seed);
      if (!plan.monthly_income) continue;
      // Walk a whole cycle, spending the day's number to the rupee.
      const first = computeDailyStatus({
        plan,
        commitments,
        expenses: [],
        today,
        trackingSince,
      });
      const spends: BudgetExpense[] = [];
      let s = first;
      for (
        let day = first.countingFrom ?? first.cycleStart;
        day <= first.cycleEnd;
        day = add(day, 1)
      ) {
        s = computeDailyStatus({
          plan,
          commitments,
          expenses: spends,
          today: day,
          trackingSince,
        });
        if (s.todayBudget > 0)
          spends.push({
            amount: s.todayBudget,
            category: "Food",
            merchant: "Lunch",
            expense_date: day,
          });
      }
      s = computeDailyStatus({
        plan,
        commitments,
        expenses: spends,
        today: first.cycleEnd,
        trackingSince,
      });
      // Rounding to whole rupees each day: within ₹1 a day.
      expect(Math.abs(s.poolLeft), `seed ${seed}`).toBeLessThanOrEqual(
        s.history.length,
      );
      expect(
        s.overspent && s.poolLeft < -s.history.length,
        `seed ${seed}`,
      ).toBe(false);
    }
  });
});
