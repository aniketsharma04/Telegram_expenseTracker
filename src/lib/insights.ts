/**
 * Pure analytics over a user's expense history — no DB, no channels.
 * Shared by the /api/data payload (app cards), the daily cron (reminders),
 * and the monthly digest.
 */

export interface ExpenseLike {
  amount: number;
  category: string;
  merchant: string | null;
  expense_date: string; // YYYY-MM-DD
  user_id?: number | null;
}

export interface BudgetLike {
  id: string;
  category: string | null; // null = overall
  monthly_cap: number;
}

export interface BudgetProgress extends BudgetLike {
  spent: number;
  pct: number; // 0..∞, 1 = at cap
}

export interface RecurringCharge {
  merchant: string;
  category: string;
  amount: number; // median of observed amounts
  nextDate: string; // predicted YYYY-MM-DD
  daysUntil: number; // relative to `today`
}

export interface Anomaly {
  category: string;
  mtd: number; // spent so far this month
  expected: number; // usual pace for this point in the month
}

/** Categories that are deliberate money movements, not "spending". */
export const NON_SPEND_CATEGORIES = new Set(["Investments"]);
/** Fixed obligations — excluded from anomaly nudges (they're *supposed* to repeat). */
const STEADY_CATEGORIES = new Set(["Investments", "Loans & EMI"]);

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS,
  );
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** "spent" for budget purposes excludes investments (matches bot reports). */
function countsTowardOverall(category: string): boolean {
  return !NON_SPEND_CATEGORIES.has(category);
}

/** Month-to-date progress against each budget. Expenses must already be the user's own. */
export function budgetProgress(
  budgets: BudgetLike[],
  expenses: ExpenseLike[],
  today: string,
): BudgetProgress[] {
  const monthStart = `${today.slice(0, 7)}-01`;
  const month = expenses.filter(
    (e) => e.expense_date >= monthStart && e.expense_date <= today,
  );
  return budgets.map((b) => {
    const spent = month
      .filter((e) =>
        b.category ? e.category === b.category : countsTowardOverall(e.category),
      )
      .reduce((s, e) => s + Number(e.amount), 0);
    return { ...b, spent, pct: b.monthly_cap > 0 ? spent / b.monthly_cap : 0 };
  });
}

/**
 * Detect monthly recurring charges: same merchant+category, entries spaced
 * roughly a month apart (24–38 days), amounts within ±25% of the median.
 * Predicts the next occurrence from the last entry + median gap.
 */
export function detectRecurring(
  expenses: ExpenseLike[],
  today: string,
): RecurringCharge[] {
  const groups = new Map<string, ExpenseLike[]>();
  for (const e of expenses) {
    if (!e.merchant) continue;
    const key = `${e.merchant.trim().toLowerCase()}|${e.category}`;
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }

  const out: RecurringCharge[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) =>
      a.expense_date < b.expense_date ? -1 : 1,
    );
    // Collapse same-day duplicates (e.g. re-logged) to one occurrence.
    const dates: ExpenseLike[] = [];
    for (const e of sorted) {
      if (dates.length === 0 || dates[dates.length - 1].expense_date !== e.expense_date)
        dates.push(e);
    }
    if (dates.length < 2) continue;

    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++)
      gaps.push(daysBetween(dates[i - 1].expense_date, dates[i].expense_date));
    if (!gaps.every((g) => g >= 24 && g <= 38)) continue;

    const amounts = dates.map((e) => Number(e.amount));
    const med = median(amounts);
    if (med <= 0) continue;
    if (!amounts.every((a) => Math.abs(a - med) / med <= 0.25)) continue;

    const gap = Math.round(median(gaps));
    const last = dates[dates.length - 1];
    let nextDate = addDays(last.expense_date, gap);
    // If the predicted date already passed (charge may just be late), roll forward.
    while (daysBetween(today, nextDate) < -5) nextDate = addDays(nextDate, gap);

    out.push({
      merchant: last.merchant!,
      category: last.category,
      amount: Math.round(med),
      nextDate,
      daysUntil: daysBetween(today, nextDate),
    });
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * Categories running well above their usual pace this month.
 * Baseline = average of the previous 3 full months (needs ≥2 months of history),
 * prorated to today's position in the month. Flags at ≥2× the expected pace
 * and at least ₹1,000 spent.
 */
export function detectAnomalies(
  expenses: ExpenseLike[],
  today: string,
): Anomaly[] {
  const thisMonth = today.slice(0, 7);
  const dayOfMonth = Number(today.slice(8, 10));
  const daysInMonth = new Date(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)),
    0,
  ).getDate();

  const prevMonths: string[] = [];
  let [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  for (let i = 0; i < 3; i++) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    prevMonths.push(`${y}-${String(m).padStart(2, "0")}`);
  }

  const mtd = new Map<string, number>();
  const history = new Map<string, Map<string, number>>(); // category → month → total
  for (const e of expenses) {
    if (STEADY_CATEGORIES.has(e.category)) continue;
    const month = e.expense_date.slice(0, 7);
    if (month === thisMonth && e.expense_date <= today) {
      mtd.set(e.category, (mtd.get(e.category) ?? 0) + Number(e.amount));
    } else if (prevMonths.includes(month)) {
      let byMonth = history.get(e.category);
      if (!byMonth) history.set(e.category, (byMonth = new Map()));
      byMonth.set(month, (byMonth.get(month) ?? 0) + Number(e.amount));
    }
  }

  const out: Anomaly[] = [];
  for (const [category, spent] of mtd) {
    const byMonth = history.get(category);
    if (!byMonth || byMonth.size < 2) continue; // not enough history to call it unusual
    const totals = [...byMonth.values()];
    const baseline = totals.reduce((s, n) => s + n, 0) / totals.length;
    const expected = baseline * (dayOfMonth / daysInMonth);
    if (spent >= 1000 && expected > 0 && spent >= 2 * expected) {
      out.push({ category, mtd: spent, expected: Math.round(expected) });
    }
  }
  return out.sort((a, b) => b.mtd - a.mtd);
}

/** Net pairwise balances from split rows: "who owes whom" within the visible set. */
export interface SettleEntry {
  from: number; // owes
  to: number; // is owed
  amount: number;
}

export function settleUp(
  expenses: Array<ExpenseLike & { paid_by?: number | null }>,
): SettleEntry[] {
  // pair key "a|b" with a < b; positive balance = a owes b
  const balance = new Map<string, number>();
  for (const e of expenses) {
    const debtor = e.user_id;
    const payer = e.paid_by;
    if (debtor == null || payer == null || debtor === payer) continue;
    const [a, b] = debtor < payer ? [debtor, payer] : [payer, debtor];
    const sign = debtor < payer ? 1 : -1; // + means a (smaller id) owes b
    const key = `${a}|${b}`;
    balance.set(key, (balance.get(key) ?? 0) + sign * Number(e.amount));
  }
  const out: SettleEntry[] = [];
  for (const [key, net] of balance) {
    if (Math.round(net) === 0) continue;
    const [a, b] = key.split("|").map(Number);
    out.push(
      net > 0
        ? { from: a, to: b, amount: Math.round(net) }
        : { from: b, to: a, amount: Math.round(-net) },
    );
  }
  return out.sort((x, y) => y.amount - x.amount);
}
