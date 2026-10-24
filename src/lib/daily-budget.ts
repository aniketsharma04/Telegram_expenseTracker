import { NON_SPEND_CATEGORIES, type ExpenseLike } from "./insights";

/**
 * The daily budget (v14) — pure, no DB, no channels.
 *
 * A monthly income is too big a number to feel. This turns it into one you
 * can: what's free to spend today.
 *
 *   pool   = income − fixed costs − savings goal          (the month's everyday money)
 *   today  = (pool − everyday spending before today) ÷ days left, today included
 *
 * The number is fixed for the day once the day starts — spending today
 * shrinks "left today", not the budget itself — and tomorrow's number absorbs
 * whatever today did. That's how a ₹12,000 phone gets spread over the rest of
 * the month without anyone having to decide to spread it.
 *
 * What never touches the daily number:
 *  - fixed costs the user listed (rent, EMI, SIP, subscriptions) — up to the
 *    planned amount; a ₹3,000 electricity bill planned at ₹2,000 puts the
 *    extra ₹1,000 into everyday spending, because that money is gone too
 *  - Loans & EMI (credit-card payments land here, and the card spends were
 *    already counted) and Investments
 *  - anything the user marked "from savings"
 */

export type BudgetScope = "daily" | "fixed" | "savings";

export interface PlanLike {
  monthly_income: number | null;
  savings_goal: number;
  /** Day of the month salary arrives (v16); null = calendar months. */
  payday?: number | null;
}

export interface CommitmentLike {
  id: string;
  name: string;
  amount: number;
  category: string | null;
  match: string | null;
}

export interface BudgetExpense extends ExpenseLike {
  id?: string;
  budget_scope?: BudgetScope | null;
}

/** Categories that are planned outflows by nature, never everyday spending. */
const FIXED_CATEGORIES = new Set(["Loans & EMI"]);

/** Category + amount matching tolerance, when a commitment has no keyword hit. */
const AMOUNT_TOLERANCE = 0.3;

/** A spend this many days' worth (and at least ₹1,000) gets the "from savings?" offer. */
const BIG_SPEND_DAYS = 3;
const BIG_SPEND_MIN = 1000;

export interface ScopedExpense extends BudgetExpense {
  scope: BudgetScope;
  /** The part that counts against everyday money (an over-plan fixed cost counts in part). */
  dailyAmount: number;
  commitmentId: string | null;
}

export interface DayPoint {
  date: string;
  budget: number;
  spent: number;
}

export interface CommitmentStatus {
  id: string;
  name: string;
  amount: number;
  paid: number;
}

export interface DailyStatus {
  ready: boolean;
  /** Why there's no number yet. */
  reason: "no_income" | null;
  income: number;
  /** Where the income came from: the plan, or last month's logged income. */
  incomeSource: "plan" | "last_month" | null;
  fixed: number;
  savingsGoal: number;
  /** Set aside for goals this month (v17). */
  goals: number;
  /** The month's everyday money. */
  pool: number;
  /** pool ÷ days in month — the naive "per day" figure, for reference. */
  baseDaily: number;
  /** The budget month — payday to the day before the next one (v16). */
  cycleStart: string;
  cycleEnd: string;
  /** Days in the budget month (a calendar month when there's no payday). */
  daysInMonth: number;
  /** Today's position in the budget month, 1-based. */
  dayOfMonth: number;
  /** Including today. */
  daysLeft: number;
  todayBudget: number;
  todaySpent: number;
  todayLeft: number;
  /** Everyday spending this month, today included. */
  poolSpent: number;
  poolLeft: number;
  /** What tomorrow's number will be if nothing else is spent today. */
  tomorrowBudget: number | null;
  /** Where the month ends if the pace so far holds: + saved beyond the goal, − short. */
  projectedLeftover: number;
  /** Consecutive finished days at or under budget, ending yesterday. */
  streak: number;
  savedFromSavings: number;
  commitments: CommitmentStatus[];
  history: DayPoint[];
  today: ScopedExpense[];
}

const round = (n: number) => Math.round(n);

export function daysInMonthOf(date: string): number {
  return new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate();
}

const DAY_MS = 86_400_000;
const isoAdd = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const daysFrom = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

/** Payday in a given month, pulled back to the last day when the month is short. */
function paydayIn(year: number, month: number, payday: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1-based here
  const day = Math.min(payday, last);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface Cycle {
  start: string;
  end: string;
  days: number;
  /** Today's position, 1-based. */
  dayIndex: number;
}

/**
 * The budget month containing `today`: from the most recent payday up to the
 * day before the next. Salary on the 30th means the month starts on the 30th,
 * not three days later on the 1st. No payday = the calendar month.
 */
export function cycleFor(today: string, payday: number | null | undefined): Cycle {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const p = payday && payday >= 1 && payday <= 31 ? payday : 1;
  const prev = m === 1 ? [y - 1, 12] : [y, m - 1];
  const next = m === 12 ? [y + 1, 1] : [y, m + 1];

  const thisMonths = paydayIn(y, m, p);
  const start = today >= thisMonths ? thisMonths : paydayIn(prev[0], prev[1], p);
  const startMonth = Number(start.slice(5, 7));
  const after =
    startMonth === m ? paydayIn(next[0], next[1], p) : thisMonths;
  const end = isoAdd(after, -1);
  return { start, end, days: daysFrom(start, end) + 1, dayIndex: daysFrom(start, today) + 1 };
}

function keywordHit(c: CommitmentLike, e: BudgetExpense): boolean {
  const word = c.match?.trim().toLowerCase();
  if (!word || word.length < 3) return false;
  return (e.merchant ?? "").toLowerCase().includes(word);
}

function amountHit(c: CommitmentLike, e: BudgetExpense): boolean {
  if (!c.category || c.category !== e.category) return false;
  return Math.abs(Number(e.amount) - c.amount) / c.amount <= AMOUNT_TOLERANCE;
}

/**
 * Decide, for every expense this month, whether it's everyday spending.
 * Order matters for category+amount matches: each commitment claims at most
 * one such expense a month, the earliest — a ₹600 movie in the month Netflix
 * (₹649, Entertainment) was already paid is just a movie.
 */
export function scopeExpenses(
  expenses: BudgetExpense[],
  commitments: CommitmentLike[],
): ScopedExpense[] {
  const sorted = [...expenses].sort((a, b) =>
    a.expense_date < b.expense_date ? -1 : a.expense_date > b.expense_date ? 1 : 0,
  );
  const paid = new Map<string, number>();
  const claimedByAmount = new Set<string>();

  return sorted.map((e) => {
    const amount = Number(e.amount);
    const explicit = e.budget_scope ?? null;

    if (explicit === "savings" || (!explicit && NON_SPEND_CATEGORIES.has(e.category)))
      return { ...e, scope: "savings", dailyAmount: 0, commitmentId: null };
    if (explicit === "daily")
      return { ...e, scope: "daily", dailyAmount: amount, commitmentId: null };

    const commitment =
      commitments.find((c) => keywordHit(c, e)) ??
      commitments.find((c) => !claimedByAmount.has(c.id) && amountHit(c, e));

    if (commitment) {
      if (!keywordHit(commitment, e)) claimedByAmount.add(commitment.id);
      const before = paid.get(commitment.id) ?? 0;
      paid.set(commitment.id, before + amount);
      // Only what goes past the plan is everyday money.
      const overPlan = Math.max(0, before + amount - Math.max(before, commitment.amount));
      return { ...e, scope: "fixed", dailyAmount: overPlan, commitmentId: commitment.id };
    }

    if (explicit === "fixed" || FIXED_CATEGORIES.has(e.category))
      return { ...e, scope: "fixed", dailyAmount: 0, commitmentId: null };

    return { ...e, scope: "daily", dailyAmount: amount, commitmentId: null };
  });
}

/**
 * The whole picture for `today`. `expenses` should be the user's own rows
 * for the month (family members' spending is theirs to budget).
 */
export function computeDailyStatus(input: {
  plan: PlanLike | null;
  commitments: CommitmentLike[];
  expenses: BudgetExpense[];
  today: string;
  /** Income logged last month — used when the plan names no income. */
  lastMonthIncome?: number;
  /** Monthly set-asides for active goals (v17) — off the top, like savings. */
  goalsMonthly?: number;
}): DailyStatus {
  const { plan, commitments, today } = input;
  const cycle = cycleFor(today, plan?.payday);
  const monthStart = cycle.start;
  const daysInMonth = cycle.days;
  const dayOfMonth = cycle.dayIndex;
  const daysLeft = daysInMonth - dayOfMonth + 1;

  const planned = plan?.monthly_income ? Number(plan.monthly_income) : 0;
  const fallback = input.lastMonthIncome ?? 0;
  const income = planned > 0 ? planned : fallback;
  const incomeSource = planned > 0 ? "plan" : fallback > 0 ? "last_month" : null;

  const fixed = commitments.reduce((s, c) => s + Number(c.amount), 0);
  const savingsGoal = Number(plan?.savings_goal ?? 0);
  const goals = Math.max(0, input.goalsMonthly ?? 0);
  const pool = Math.max(0, income - fixed - savingsGoal - goals);

  const month = input.expenses.filter(
    (e) => e.expense_date >= monthStart && e.expense_date <= today,
  );
  const scoped = scopeExpenses(month, commitments);

  const byDay = new Map<string, number>();
  for (const e of scoped)
    if (e.dailyAmount > 0)
      byDay.set(e.expense_date, (byDay.get(e.expense_date) ?? 0) + e.dailyAmount);

  // Walk the month: each day's budget is what was left that morning, spread
  // over the days that remained.
  const history: DayPoint[] = [];
  let spentBefore = 0;
  for (let d = 1; d <= dayOfMonth; d++) {
    const date = isoAdd(monthStart, d - 1);
    const budget = Math.max(0, (pool - spentBefore) / (daysInMonth - d + 1));
    const spent = byDay.get(date) ?? 0;
    history.push({ date, budget: round(budget), spent: round(spent) });
    spentBefore += spent;
  }

  const todayPoint = history[history.length - 1];
  const todayBudget = todayPoint.budget;
  const todaySpent = todayPoint.spent;
  const poolSpent = round(spentBefore);
  const poolLeft = round(pool - spentBefore);

  let streak = 0;
  for (let i = history.length - 2; i >= 0; i--) {
    if (history[i].spent > history[i].budget) break;
    streak++;
  }

  const avgPerDay = spentBefore / dayOfMonth;
  const projectedLeftover = round(pool - spentBefore - avgPerDay * (daysLeft - 1));

  const paidBy = new Map<string, number>();
  for (const e of scoped)
    if (e.commitmentId)
      paidBy.set(e.commitmentId, (paidBy.get(e.commitmentId) ?? 0) + Number(e.amount));

  return {
    ready: income > 0,
    reason: income > 0 ? null : "no_income",
    income: round(income),
    incomeSource,
    fixed: round(fixed),
    savingsGoal: round(savingsGoal),
    goals: round(goals),
    pool: round(pool),
    baseDaily: round(pool / daysInMonth),
    cycleStart: cycle.start,
    cycleEnd: cycle.end,
    daysInMonth,
    dayOfMonth,
    daysLeft,
    todayBudget,
    todaySpent,
    todayLeft: todayBudget - todaySpent,
    poolSpent,
    poolLeft,
    tomorrowBudget:
      daysLeft > 1 ? round(Math.max(0, pool - spentBefore) / (daysLeft - 1)) : null,
    projectedLeftover,
    streak,
    savedFromSavings: round(
      scoped
        .filter((e) => e.scope === "savings" && e.budget_scope === "savings")
        .reduce((s, e) => s + Number(e.amount), 0),
    ),
    commitments: commitments.map((c) => ({
      id: c.id,
      name: c.name,
      amount: round(Number(c.amount)),
      paid: round(paidBy.get(c.id) ?? 0),
    })),
    history,
    today: scoped.filter((e) => e.expense_date === today),
  };
}

/** Worth offering "paid from savings?" for this one. */
export function isBigSpend(amount: number, todayBudget: number): boolean {
  return amount >= Math.max(BIG_SPEND_MIN, BIG_SPEND_DAYS * todayBudget);
}

// ── Messages (Telegram HTML) ────────────────────────────────────────────────

export const inr = (n: number) =>
  `₹${Math.round(n).toLocaleString("en-IN")}`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function label(e: ScopedExpense): string {
  return esc(e.merchant?.trim() || e.category);
}

export const SETUP_HINT =
  "Set your monthly income to get a daily budget: <code>/plan 100000</code>";

/** The morning message. `yesterday` is the status computed as of yesterday, when it was this month. */
export function morningBrief(
  s: DailyStatus,
  name: string | null,
  yesterday: DayPoint | null,
): string {
  const hello = `☀️ Good morning${name ? `, ${esc(name)}` : ""}!`;
  if (!s.ready) return `${hello}\n\n${SETUP_HINT}`;

  const lines = [
    hello,
    "",
    `Today you can spend <b>${inr(s.todayBudget)}</b>.`,
    `<i>${inr(s.poolLeft)} left for everyday spending · ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} to go</i>`,
  ];

  if (yesterday) {
    const diff = yesterday.budget - yesterday.spent;
    lines.push(
      "",
      diff >= 0
        ? `Yesterday: ${inr(yesterday.spent)} of ${inr(yesterday.budget)} — ${inr(diff)} under 👍`
        : `Yesterday: ${inr(yesterday.spent)} of ${inr(yesterday.budget)} — ${inr(-diff)} over, spread across the days ahead.`,
    );
  }
  if (s.streak >= 2) lines.push(`🔥 ${s.streak}-day streak under budget`);

  const due = s.commitments.filter((c) => c.paid < c.amount * 0.7);
  if (s.dayOfMonth === 1 && due.length)
    lines.push(
      "",
      `Set aside this month: ${due.map((c) => `${esc(c.name)} ${inr(c.amount)}`).join(", ")}`,
    );
  if (s.incomeSource === "last_month")
    lines.push("", `<i>Based on last month's income. Set it with /plan.</i>`);
  return lines.join("\n");
}

/** The night report. */
export function eveningReport(s: DailyStatus, today: string): string {
  const head = `🌙 <b>Today's report</b> — ${prettyDate(today)}`;
  if (!s.ready) return `${head}\n\n${SETUP_HINT}`;

  const diff = s.todayLeft;
  const lines = [
    head,
    "",
    `Spent <b>${inr(s.todaySpent)}</b> of ${inr(s.todayBudget)} · ${
      diff >= 0 ? `${inr(diff)} under ✅` : `${inr(-diff)} over ⚠️`
    }`,
  ];

  const everyday = s.today.filter((e) => e.dailyAmount > 0);
  if (everyday.length) {
    lines.push("");
    for (const e of everyday)
      lines.push(`• ${label(e)} −${inr(Number(e.amount))}`);
  } else {
    lines.push("No everyday spending today. 🎉");
  }

  const aside = s.today.filter((e) => e.dailyAmount === 0);
  if (aside.length)
    lines.push(
      "",
      `Not counted: ${aside
        .map((e) => `${label(e)} ${inr(Number(e.amount))} (${e.scope === "savings" ? "savings" : "fixed"})`)
        .join(", ")}`,
    );

  lines.push(
    "",
    `Month so far: ${inr(s.poolSpent)} of ${inr(s.pool)} everyday money`,
  );
  if (s.tomorrowBudget !== null) {
    lines.push(`Tomorrow's budget: <b>${inr(s.tomorrowBudget)}</b>`);
    lines.push(
      s.projectedLeftover >= 0
        ? `At this pace you'll finish the month ${inr(s.projectedLeftover)} ahead of your savings goal.`
        : `At this pace you'll be ${inr(-s.projectedLeftover)} short by month-end.`,
    );
  } else {
    lines.push(
      s.poolLeft >= 0
        ? `Month done: ${inr(s.poolLeft)} saved on top of your goal. 🎯`
        : `Month done: ${inr(-s.poolLeft)} over the everyday budget.`,
    );
  }
  return lines.join("\n");
}

/** One line after a spend lands — the live "coffee −₹200" tally. */
export function spendLine(e: ScopedExpense, s: DailyStatus): string {
  const amount = Number(e.amount);
  if (e.scope === "savings")
    return `💰 ${label(e)} ${inr(amount)} — from savings, today's budget unchanged.`;
  if (e.scope === "fixed" && e.dailyAmount === 0)
    return `📌 ${label(e)} ${inr(amount)} — fixed cost, today's budget unchanged.`;

  const head = `${label(e)} −${inr(e.dailyAmount)}`;
  const tail =
    s.todayLeft >= 0
      ? `Today: <b>${inr(s.todayLeft)}</b> left of ${inr(s.todayBudget)}`
      : `Today: <b>${inr(-s.todayLeft)} over</b> ${inr(s.todayBudget)}`;
  let line = `💸 ${head}\n${tail}`;

  if (e.scope === "daily" && isBigSpend(amount, s.todayBudget)) {
    const days = s.todayBudget > 0 ? Math.round(amount / s.todayBudget) : null;
    line +=
      `\n\nThat's ${days ? `${days} days' worth` : "a big one"}. It's spread over the rest of the month` +
      (s.tomorrowBudget !== null ? ` — about ${inr(s.tomorrowBudget)}/day from tomorrow.` : ".") +
      `\nPaid from savings instead? /fromsavings`;
  }
  return line;
}

// ── Push versions (plain text, app wording) ─────────────────────────────────

export interface PushText {
  title: string;
  body: string;
}

const plainLabel = (e: ScopedExpense) => e.merchant?.trim() || e.category;

export function morningPush(s: DailyStatus, yesterday: DayPoint | null): PushText {
  if (!s.ready)
    return {
      title: "☀️ Good morning",
      body: "Add your monthly income in the app to get a daily budget.",
    };
  const lines = [`${inr(s.poolLeft)} left for everyday spending · ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} to go.`];
  if (yesterday) {
    const diff = yesterday.budget - yesterday.spent;
    lines.push(
      diff >= 0
        ? `Yesterday: ${inr(diff)} under budget 👍`
        : `Yesterday: ${inr(-diff)} over — spread across the days ahead.`,
    );
  }
  if (s.streak >= 2) lines.push(`🔥 ${s.streak}-day streak`);
  return { title: `☀️ Today you can spend ${inr(s.todayBudget)}`, body: lines.join("\n") };
}

export function eveningPush(s: DailyStatus): PushText {
  if (!s.ready)
    return { title: "🌙 Today's report", body: "Add your monthly income in the app to get a daily budget." };
  const everyday = s.today.filter((e) => e.dailyAmount > 0);
  const top = everyday
    .slice()
    .sort((a, b) => b.dailyAmount - a.dailyAmount)
    .slice(0, 3)
    .map((e) => `${plainLabel(e)} ${inr(e.dailyAmount)}`);
  const lines = [everyday.length ? top.join(" · ") + (everyday.length > 3 ? ` +${everyday.length - 3} more` : "") : "No everyday spending today 🎉"];
  if (s.tomorrowBudget !== null) lines.push(`Tomorrow: ${inr(s.tomorrowBudget)}`);
  const diff = s.todayLeft;
  return {
    title:
      diff >= 0
        ? `🌙 ${inr(s.todaySpent)} of ${inr(s.todayBudget)} — ${inr(diff)} under ✅`
        : `🌙 ${inr(s.todaySpent)} of ${inr(s.todayBudget)} — ${inr(-diff)} over`,
    body: lines.join("\n"),
  };
}

export function spendPush(e: ScopedExpense, s: DailyStatus): PushText & { bigSpend: boolean } {
  const amount = Number(e.amount);
  if (e.dailyAmount === 0)
    return {
      title: `${plainLabel(e)} ${inr(amount)}`,
      body: e.scope === "savings" ? "From savings — today's budget unchanged." : "Fixed cost — today's budget unchanged.",
      bigSpend: false,
    };
  const left =
    s.todayLeft >= 0
      ? `${inr(s.todayLeft)} left today of ${inr(s.todayBudget)}`
      : `${inr(-s.todayLeft)} over today's ${inr(s.todayBudget)}`;
  const big = e.scope === "daily" && isBigSpend(amount, s.todayBudget);
  return {
    title: `${plainLabel(e)} −${inr(e.dailyAmount)}`,
    body: big
      ? `${left}. Spread over the rest of the month${s.tomorrowBudget !== null ? ` (≈${inr(s.tomorrowBudget)}/day)` : ""} — or mark it paid from savings.`
      : left,
    bigSpend: big,
  };
}
