/**
 * Income tax, old vs new regime (FY 2026-27, resident individual under 60).
 * Pure, generic information — the user's own numbers in, two totals out.
 * Never names an investment product (SEBI); never claims to file anything.
 *
 * Budget 2026 left FY 2025-26's settings unchanged for FY 2026-27:
 *  - new: 0 to 4L nil, then 5/10/15/20/25/30% per 4L; standard deduction
 *    ₹75,000; rebate up to ₹60,000 (no tax up to ₹12L taxable), with marginal
 *    relief just above ₹12L (tax never more than the income above ₹12L)
 *  - old: 2.5L nil, 5% to 5L, 20% to 10L, 30% above; standard deduction
 *    ₹50,000; rebate up to ₹12,500 (taxable up to ₹5L), no marginal relief
 *  - 4% health and education cess on both
 * Surcharge starts above ₹50L; past that we say so instead of guessing.
 */

export const TAX_YEAR = "FY 2026-27";
export const SURCHARGE_FROM = 50_00_000;

const NEW_SLABS: [number, number][] = [
  [4_00_000, 0],
  [8_00_000, 0.05],
  [12_00_000, 0.1],
  [16_00_000, 0.15],
  [20_00_000, 0.2],
  [24_00_000, 0.25],
  [Infinity, 0.3],
];
const OLD_SLABS: [number, number][] = [
  [2_50_000, 0],
  [5_00_000, 0.05],
  [10_00_000, 0.2],
  [Infinity, 0.3],
];

export const LIMITS = {
  newStandard: 75_000,
  oldStandard: 50_000,
  sec80C: 1_50_000,
  sec80D: 1_00_000, // self/family 25k + senior parents 50k, rounded up to the most it can be
  nps80CCD1B: 50_000,
  homeLoanInterest: 2_00_000,
  newRebateUpTo: 12_00_000,
  newRebateMax: 60_000,
  oldRebateUpTo: 5_00_000,
  oldRebateMax: 12_500,
  cess: 0.04,
};

export interface TaxInput {
  /** Gross yearly income (salary before tax, plus other income). */
  gross: number;
  /** Salaried (gets the standard deduction). */
  salaried: boolean;
  // Old-regime deductions — what the user actually has.
  sec80C?: number;
  sec80D?: number;
  nps?: number;
  homeLoanInterest?: number;
  /** HRA exemption as worked out by the employer (Form 16 / salary slip). */
  hraExempt?: number;
}

export interface RegimeResult {
  taxable: number;
  slabTax: number;
  rebate: number;
  cess: number;
  total: number;
}

export interface TaxComparison {
  newRegime: RegimeResult;
  oldRegime: RegimeResult;
  better: "new" | "old" | "same";
  /** How much less the better regime costs. */
  saving: number;
  /** Above ₹50L: surcharge applies and these totals are understated. */
  surchargeApplies: boolean;
  /** Old-regime deductions after caps, for showing what counted. */
  oldDeductions: number;
}

const clamp = (n: number | undefined, max: number) =>
  Math.min(Math.max(0, Math.round(n ?? 0)), max);

function slabTax(taxable: number, slabs: [number, number][]): number {
  let tax = 0;
  let from = 0;
  for (const [upTo, rate] of slabs) {
    if (taxable <= from) break;
    tax += (Math.min(taxable, upTo) - from) * rate;
    from = upTo;
  }
  return tax;
}

function finish(taxable: number, slab: number, rebate: number): RegimeResult {
  const afterRebate = Math.max(0, slab - rebate);
  const cess = afterRebate * LIMITS.cess;
  return {
    taxable: Math.round(taxable),
    slabTax: Math.round(slab),
    rebate: Math.round(rebate),
    cess: Math.round(cess),
    total: Math.round(afterRebate + cess),
  };
}

export function newRegimeTax(gross: number, salaried: boolean): RegimeResult {
  const taxable = Math.max(0, gross - (salaried ? LIMITS.newStandard : 0));
  const slab = slabTax(taxable, NEW_SLABS);
  let rebate = 0;
  if (taxable <= LIMITS.newRebateUpTo)
    rebate = Math.min(slab, LIMITS.newRebateMax);
  else {
    // Marginal relief: tax can't exceed the income above ₹12L.
    const excess = taxable - LIMITS.newRebateUpTo;
    if (slab > excess) rebate = slab - excess;
  }
  return finish(taxable, slab, rebate);
}

export function oldRegimeTax(
  input: TaxInput,
): RegimeResult & { deductions: number } {
  const deductions =
    (input.salaried ? LIMITS.oldStandard : 0) +
    clamp(input.sec80C, LIMITS.sec80C) +
    clamp(input.sec80D, LIMITS.sec80D) +
    clamp(input.nps, LIMITS.nps80CCD1B) +
    clamp(input.homeLoanInterest, LIMITS.homeLoanInterest) +
    clamp(input.hraExempt, Number.MAX_SAFE_INTEGER);
  const taxable = Math.max(0, input.gross - deductions);
  const slab = slabTax(taxable, OLD_SLABS);
  const rebate =
    taxable <= LIMITS.oldRebateUpTo ? Math.min(slab, LIMITS.oldRebateMax) : 0;
  return {
    ...finish(taxable, slab, rebate),
    deductions: Math.round(deductions),
  };
}

export function compareRegimes(input: TaxInput): TaxComparison {
  const gross = Math.max(0, Math.round(input.gross));
  const n = newRegimeTax(gross, input.salaried);
  const { deductions, ...o } = oldRegimeTax({ ...input, gross });
  const diff = o.total - n.total;
  return {
    newRegime: n,
    oldRegime: o,
    better: diff > 0 ? "new" : diff < 0 ? "old" : "same",
    saving: Math.abs(diff),
    surchargeApplies: gross > SURCHARGE_FROM,
    oldDeductions: deductions,
  };
}

/**
 * Advance tax: due when the year's tax, after TDS, is ₹10,000 or more —
 * mostly people with income besides salary. Cumulative share due by each date.
 */
export const ADVANCE_TAX = [
  { month: 6, day: 15, share: 0.15 },
  { month: 9, day: 15, share: 0.45 },
  { month: 12, day: 15, share: 0.75 },
  { month: 3, day: 15, share: 1 },
] as const;

/** The next advance-tax date on or after `today` (YYYY-MM-DD). */
export function nextAdvanceTax(today: string): { date: string; share: number } {
  const y = Number(today.slice(0, 4));
  const candidates = ADVANCE_TAX.flatMap((d) =>
    [y, y + 1].map((year) => ({
      date: `${year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`,
      share: d.share,
    })),
  ).sort((a, b) => (a.date < b.date ? -1 : 1));
  return candidates.find((c) => c.date >= today)!;
}
