import { addDays, type ExpenseLike } from "./insights";

/**
 * The Monday review of last week (Mon–Sun), compared with the user's usual
 * week. One short message: the total, what moved, the biggest spend, how
 * many days were logged, subscriptions, and one thing to try this week.
 * Weekly reviews with a single concrete next step are the reminder style with
 * the best evidence for keeping people budgeting; a monthly digest alone is
 * too far from the spending it describes.
 *
 * Pure: the cron supplies the data.
 */

/** Deliberate money movements and fixed obligations aren't "spending" here. */
const NOT_WEEKLY_SPEND = new Set([
  "Investments",
  "Loans & EMI",
  "Lent",
  "Settle up",
]);
/** Weeks before last week used for "usual". */
const BASELINE_WEEKS = 4;
/** Below this many earlier weeks with spending, there's no fair "usual". */
const MIN_BASELINE_WEEKS = 2;

export interface WeeklyInput {
  expenses: ExpenseLike[];
  /** The Monday the review is sent (IST). */
  today: string;
  subscriptions?: { monthly: number; count: number; undecided: number };
  /** Active goals, for "put it towards …" on a good week. */
  goalNames?: string[];
}

export interface WeeklyReview {
  title: string;
  html: string;
  total: number;
  usual: number | null;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dayName = (iso: string) =>
  DAY_NAMES[new Date(`${iso}T00:00:00Z`).getUTCDay()];
const short = (iso: string) =>
  `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

function spendIn(
  expenses: ExpenseLike[],
  from: string,
  to: string,
): ExpenseLike[] {
  return expenses.filter(
    (e) =>
      e.expense_date >= from &&
      e.expense_date <= to &&
      !NOT_WEEKLY_SPEND.has(e.category) &&
      Number(e.amount) > 0,
  );
}

function byCategory(list: ExpenseLike[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of list)
    m.set(e.category, (m.get(e.category) ?? 0) + Number(e.amount));
  return m;
}

export function composeWeeklyReview(input: WeeklyInput): WeeklyReview | null {
  const { expenses, today } = input;
  const start = addDays(today, -7);
  const end = addDays(today, -1);
  const week = spendIn(expenses, start, end);
  if (!week.length) return null; // nothing logged: no review, no nagging

  const total = week.reduce((s, e) => s + Number(e.amount), 0);

  // Usual week: the earlier weeks that had any spending, averaged.
  const earlier: ExpenseLike[][] = [];
  for (let w = 1; w <= BASELINE_WEEKS; w++) {
    const list = spendIn(
      expenses,
      addDays(start, -7 * w),
      addDays(end, -7 * w),
    );
    if (list.length) earlier.push(list);
  }
  const hasBaseline = earlier.length >= MIN_BASELINE_WEEKS;
  const usual = hasBaseline
    ? earlier.reduce(
        (s, l) => s + l.reduce((t, e) => t + Number(e.amount), 0),
        0,
      ) / earlier.length
    : null;
  const usualByCat = new Map<string, number>();
  if (hasBaseline) {
    for (const l of earlier)
      for (const [c, v] of byCategory(l))
        usualByCat.set(c, (usualByCat.get(c) ?? 0) + v / earlier.length);
  }

  const lines: string[] = [];
  lines.push(`📅 <b>Your week</b> (${short(start)} – ${short(end)})`);

  let verdict = "";
  if (usual !== null) {
    const diff = total - usual;
    const pct = usual > 0 ? diff / usual : 0;
    if (pct <= -0.1) verdict = ` · ${inr(-diff)} less than your usual week 👏`;
    else if (pct >= 0.1) verdict = ` · ${inr(diff)} more than your usual week`;
    else verdict = " · about your usual week";
  }
  lines.push(`Spent <b>${inr(total)}</b>${verdict}`);

  const cats = [...byCategory(week)].sort((a, b) => b[1] - a[1]);
  const top = cats.slice(0, 3).map(([c, v]) => {
    const u = usualByCat.get(c) ?? 0;
    const up = hasBaseline && v - u >= 300 && v >= u * 1.25;
    return `${esc(c)} ${inr(v)}${up ? ` (↑ ${inr(v - u)})` : ""}`;
  });
  lines.push(`Top: ${top.join(", ")}`);

  const biggest = week.reduce((a, b) =>
    Number(b.amount) > Number(a.amount) ? b : a,
  );
  lines.push(
    `Biggest: ${inr(Number(biggest.amount))}${biggest.merchant ? ` at ${esc(biggest.merchant)}` : ` on ${esc(biggest.category)}`} (${dayName(biggest.expense_date)})`,
  );

  const days = new Set(
    expenses
      .filter((e) => e.expense_date >= start && e.expense_date <= end)
      .map((e) => e.expense_date),
  ).size;
  lines.push(
    days === 7
      ? "Logged every day. Great streak! 🔥"
      : `Logged on ${days} of 7 days.`,
  );

  const subs = input.subscriptions;
  if (subs && subs.count > 0) {
    lines.push(
      `🔁 Subscriptions: ${subs.count} · ${inr(subs.monthly)} a month` +
        (subs.undecided
          ? ` · ${subs.undecided} to review: <code>/subs</code>`
          : ""),
    );
  }

  // One thing to try: the category that ran furthest over its usual week.
  let focus: string | null = null;
  if (hasBaseline) {
    const over = cats
      .map(([c, v]) => ({ c, v, u: usualByCat.get(c) ?? 0 }))
      .filter((x) => x.u > 0 && x.v - x.u >= 500 && x.v >= x.u * 1.3)
      .sort((a, b) => b.v - b.u - (a.v - a.u))[0];
    if (over)
      focus = `Try keeping ${esc(over.c)} under ${inr(over.u)} this week (your usual).`;
    else if (usual !== null && total <= usual * 0.9) {
      const goal = input.goalNames?.[0];
      focus = goal
        ? `Put the ${inr(usual - total)} you didn't spend towards <b>${esc(goal)}</b>?`
        : `That's ${inr(usual - total)} you could move to savings.`;
    }
  } else {
    focus =
      "Keep logging: from next week I'll compare each week with your usual.";
  }
  if (focus) lines.push(`👉 ${focus}`);

  return {
    title: `Your week: ${inr(total)} spent`,
    html: lines.join("\n"),
    total: Math.round(total),
    usual: usual === null ? null : Math.round(usual),
  };
}

/** Is `today` the day the review goes out (Monday, IST date string)? */
export function isReviewDay(today: string): boolean {
  return new Date(`${today}T00:00:00Z`).getUTCDay() === 1;
}

/** Days of history the review reads. */
export const WEEKLY_LOOKBACK_DAYS = 7 * (BASELINE_WEEKS + 1);
