/**
 * Money rules (v18): the thumb rules Indian personal-finance guides agree on,
 * run over the user's own numbers so the app can say "this car breaks
 * 20/4/10, here's the one that fits" instead of just tracking.
 *
 * Pure functions, no React Native, so the root vitest covers them. They are
 * guidance, not lender policy: every rule here is a rule of thumb, and the
 * screens say so.
 *
 *   50/30/20  take-home: 50% needs, 30% wants, 20% saved/invested
 *   60/20/20  the rent-heavy-city variant: needs take 60%, saving stays 20%
 *   20/4/10   vehicles: 20% down, loan ≤ 4 years, EMI ≤ 10% of income
 *   20/30/40  home: 20% down, home EMI ≤ 30% of income, all EMIs ≤ 40%
 *   6 months  emergency fund = six months of monthly spending
 */

export type GoalKind =
  "car" | "bike" | "home" | "gadget" | "trip" | "emergency" | "other";

export const GOAL_KINDS: GoalKind[] = [
  "car",
  "bike",
  "home",
  "gadget",
  "trip",
  "emergency",
  "other",
];

/** Assumed loan rates, % a year (2026 market, rounded). Shown on screen as "about". */
export const LOAN_RATE: Record<"car" | "bike" | "home", number> = {
  car: 9,
  bike: 12,
  home: 8.5,
};

const KEYWORDS: Array<[GoalKind, RegExp]> = [
  ["emergency", /emergency|rainy day|safety (fund|net)|buffer/i],
  ["home", /\b(house|home|flat|apartment|plot|villa|ghar|makaan|bhk)\b/i],
  [
    "bike",
    /\b(bike|scooter|scooty|motorcycle|motorbike|activa|bullet|enfield|ather|ola s1|ktm|splendor|pulsar)\b/i,
  ],
  [
    "car",
    /\b(car|suv|sedan|hatchback|nexon|creta|swift|thar|innova|baleno|seltos|scorpio|xuv\w*)\b/i,
  ],
  [
    "gadget",
    /\b(phone|iphone|pixel|samsung|laptop|macbook|ipad|tablet|tv|camera|watch|ps5|playstation|xbox|console|fridge|ac|washing machine)\b/i,
  ],
  [
    "trip",
    /\b(trip|travel|vacation|holiday|tour|honeymoon|goa|manali|ladakh|kashmir|kerala|europe|thailand|bali|dubai|japan)\b/i,
  ],
];

/** Best guess at what a goal is for, from its name. */
export function guessGoalKind(name: string): GoalKind {
  return KEYWORDS.find(([, re]) => re.test(name))?.[0] ?? "other";
}

/** Monthly instalment for a loan: principal, % a year, months. */
export function emi(
  principal: number,
  ratePct: number,
  months: number,
): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = ratePct / 1200;
  if (r === 0) return principal / months;
  const f = (1 + r) ** months;
  return (principal * r * f) / (f - 1);
}

/** The biggest loan a given EMI can carry. */
export function maxLoanFor(
  monthly: number,
  ratePct: number,
  months: number,
): number {
  if (monthly <= 0 || months <= 0) return 0;
  const r = ratePct / 1200;
  if (r === 0) return monthly * months;
  const f = (1 + r) ** months;
  return (monthly * (f - 1)) / (r * f);
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const roundUpTo = (n: number, step: number) => Math.ceil(n / step) * step;

// ── Salary split ────────────────────────────────────────────────────────────

export interface SplitInput {
  /** Monthly take-home. */
  income: number;
  /** Fixed monthly costs: rent, bills, EMIs, SIPs the user listed. */
  fixed: number;
  savingsGoal: number;
  /** Monthly set aside for goals. */
  goals: number;
}

export interface SplitAdvice {
  rule: "50/30/20" | "60/20/20";
  amounts: { needs: number; wants: number; save: number };
  /** Whole percentages of income. */
  pct: { needs: number; wants: number; save: number };
  target: { needs: number; wants: number; save: number };
  /** good: saving ≥ 20% · low_savings: under 20% · high_needs: needs past 60%. */
  status: "good" | "low_savings" | "high_needs";
  /**
   * Savings goal that lifts saving to 20%, taken from wants. Null when saving
   * is already there or there's no everyday money to move.
   */
  suggestSavingsGoal: number | null;
}

export function salarySplit(input: SplitInput): SplitAdvice | null {
  const { income, fixed, savingsGoal, goals } = input;
  if (!(income > 0)) return null;
  const needs = Math.max(0, fixed);
  const save = Math.max(0, savingsGoal) + Math.max(0, goals);
  const wants = Math.max(0, income - needs - save);
  const pct = (n: number) => Math.round((n / income) * 100);

  // Rent-heavy cities: once needs pass half the income, the guides keep the
  // 20% saving and squeeze wants instead.
  const rule = needs / income > 0.5 ? "60/20/20" : "50/30/20";
  const target =
    rule === "50/30/20"
      ? { needs: 50, wants: 30, save: 20 }
      : { needs: 60, wants: 20, save: 20 };

  // A rupee or two of rounding shouldn't nag anyone.
  const savingShort = save < income * 0.2 - 50;
  let suggestSavingsGoal: number | null = null;
  if (savingShort && wants > 0) {
    const needed = roundUpTo(income * 0.2, 100) - save;
    const extra = Math.min(needed, roundTo(wants, 100));
    if (extra > 0) suggestSavingsGoal = Math.max(0, savingsGoal) + extra;
  }

  return {
    rule,
    amounts: { needs, wants, save },
    pct: { needs: pct(needs), wants: pct(wants), save: pct(save) },
    target,
    status:
      needs / income > 0.6
        ? "high_needs"
        : savingShort
          ? "low_savings"
          : "good",
    suggestSavingsGoal,
  };
}

// ── Goals ───────────────────────────────────────────────────────────────────

export interface LoanCheck {
  rule: "20/4/10" | "20/30/40";
  price: number;
  /** 20% down payment on the price. */
  down: number;
  loan: number;
  months: number;
  ratePct: number;
  emi: number;
  /** The rule's EMI ceiling for this income. */
  emiCap: number;
  /** EMIs already running (from fixed costs). */
  existingEmi: number;
  /** All EMIs with this loan, as a whole % of income. */
  allEmiPct: number;
  /**
   * True when the other EMIs, not the rule, set the limit: all EMIs together
   * should stay under 40% of income.
   */
  limitedByOtherEmis: boolean;
  fits: boolean;
  /** Dearest price whose EMI stays within the cap (20% down). */
  maxPrice: number;
  /** What this goal should save: the down payment on the price that fits. */
  suggestTarget: number;
}

export type GoalAdvice =
  | ({ kind: "car" | "bike"; cashOk: boolean } & LoanCheck)
  | ({ kind: "home"; incomeYears: number } & LoanCheck)
  | { kind: "emergency"; suggestTarget: number; monthlySpend: number }
  | { kind: "gadget" | "trip"; monthsOfIncome: number }
  | { kind: "other" };

export interface GoalInput {
  kind: GoalKind;
  /** The price of the thing, or the amount for a fund. 0 when not typed yet. */
  target: number;
  /** Monthly take-home; 0 when unknown. */
  income: number;
  /** Monthly spending on needs + wants (for the emergency fund). */
  monthlySpend: number;
  /** EMIs already being paid; see emiCommitments. */
  existingEmi?: number;
}

/** All EMIs together should stay under this share of income (20/30/40, lenders' FOIR). */
export const ALL_EMI_CAP = 0.4;

const EMI_NAME = /\b(emi|emis|loan|loans|instal+ments?)\b/i;

/** Monthly EMIs already running: the fixed costs whose names say EMI or loan. */
export function emiCommitments(
  commitments: Array<{ name: string; amount: number }>,
): number {
  return commitments
    .filter((c) => EMI_NAME.test(c.name))
    .reduce((s, c) => s + Math.max(0, c.amount), 0);
}

function loanCheck(
  rule: LoanCheck["rule"],
  price: number,
  months: number,
  ratePct: number,
  emiCap: number,
  income: number,
  existingEmi: number,
): LoanCheck {
  const down = roundUpTo(price * 0.2, 1000);
  const loan = Math.max(0, price - down);
  const monthly = Math.round(emi(loan, ratePct, months));
  // The loan has to fit the rule's own cap and leave all EMIs under 40%.
  const room = Math.max(0, income * ALL_EMI_CAP - existingEmi);
  const cap = Math.min(emiCap, room);
  // Loan is 80% of the price, so the price that fits is maxLoan / 0.8.
  const maxPrice = roundTo(maxLoanFor(cap, ratePct, months) / 0.8, 1000);
  const fits = monthly <= cap;
  return {
    rule,
    price,
    down,
    loan,
    months,
    ratePct,
    emi: monthly,
    emiCap: Math.round(emiCap),
    existingEmi: Math.round(existingEmi),
    allEmiPct: Math.round(((existingEmi + monthly) / income) * 100),
    limitedByOtherEmis: room < emiCap,
    fits,
    maxPrice,
    suggestTarget: fits ? down : roundUpTo(maxPrice * 0.2, 1000),
  };
}

export function goalAdvice(input: GoalInput): GoalAdvice | null {
  const { kind, target, income, monthlySpend } = input;
  const existingEmi = Math.max(0, input.existingEmi ?? 0);

  if (kind === "emergency") {
    if (!(monthlySpend > 0)) return null;
    return {
      kind,
      monthlySpend: Math.round(monthlySpend),
      suggestTarget: roundUpTo(monthlySpend * 6, 1000),
    };
  }
  if (kind === "other" || !(target > 0) || !(income > 0)) return null;

  if (kind === "car" || kind === "bike") {
    const check = loanCheck(
      "20/4/10",
      target,
      48,
      LOAN_RATE[kind],
      income * 0.1,
      income,
      existingEmi,
    );
    // A bike that costs two months' pay or less is better bought outright.
    return { kind, cashOk: kind === "bike" && target <= income * 2, ...check };
  }
  if (kind === "home") {
    const check = loanCheck(
      "20/30/40",
      target,
      240,
      LOAN_RATE.home,
      income * 0.3,
      income,
      existingEmi,
    );
    return {
      kind,
      incomeYears: Math.round((target / (income * 12)) * 10) / 10,
      ...check,
    };
  }
  return {
    kind,
    monthsOfIncome: Math.round((target / income) * 10) / 10,
  };
}

/** Fill "{name}" placeholders in a translated string. */
export function fill(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (m, k) =>
    k in vars ? String(vars[k]) : m,
  );
}
