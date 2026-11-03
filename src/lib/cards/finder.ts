import type { Bucket, CardProduct, CardTxn, HeldCard } from "./types";
import {
  allocate,
  eligibility,
  rateFor,
  readTxn,
  withoutOneOffs,
  type Eligibility,
  type ScoreBand,
} from "./engine";

/**
 * Card Finder: "which one card suits me best?" — Monzy's six-question quiz,
 * answered with rupees instead of attribute matching.
 *
 * Every card is scored on the same yearly spending: the user's real spends
 * when Aaj has enough of them, otherwise a spending pattern built from the
 * answers. A card's score is what it alone would earn on that spending (caps,
 * exclusions and milestones included) minus its fee with GST. The answers
 * also act as hard filters (fee band, UPI) and as a "fit" filter on the goal,
 * which relaxes when it would leave fewer than three cards.
 *
 * Pure: no I/O, no clock — the caller passes everything in.
 */

const GST = 1.18;

export const GOALS = [
  "shopping",
  "food",
  "travel",
  "fuel",
  "bills",
  "value",
] as const;
export type Goal = (typeof GOALS)[number];

export const FEE_BANDS = ["free", "500", "2000", "5000", "any"] as const;
export type FeeBand = (typeof FEE_BANDS)[number];

export const PLATFORMS = [
  "amazon",
  "flipkart",
  "myntra",
  "food-apps",
  "tata",
  "mix",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const SPEND_BANDS = ["lt15", "15-50", "50-100", "100plus"] as const;
export type SpendBand = (typeof SPEND_BANDS)[number];

export interface FinderAnswers {
  goal: Goal;
  fee: FeeBand;
  platform: Platform;
  /** The card must work on UPI (RuPay credit). */
  upi: boolean;
  spend: SpendBand;
  /** Score on the user's real spending when there is enough of it. */
  useMySpending: boolean;
}

/** Monthly spend each band stands for. */
export const SPEND_OF_BAND: Record<SpendBand, number> = {
  lt15: 10_000,
  "15-50": 30_000,
  "50-100": 70_000,
  "100plus": 140_000,
};

/** Highest annual fee (before GST) each band accepts. */
const FEE_CAP: Record<FeeBand, number> = {
  free: 0,
  "500": 500,
  "2000": 2000,
  "5000": 5000,
  any: Number.POSITIVE_INFINITY,
};

/** Real spending is used only with at least this many days and this much spend. */
export const MIN_REAL_DAYS = 30;
export const MIN_REAL_MONTHLY = 3000;

// ── A spending pattern from the answers ─────────────────────────────────────

interface Slice {
  key: string;
  share: number;
  merchant: string;
  category: string | null;
  /** Paid by UPI at a shop that takes only UPI, when the user wants UPI. */
  upiShop?: boolean;
  goals?: Partial<Record<Goal, number>>;
}

/**
 * A typical urban card-spend mix (shares of the monthly total). It's a
 * starting point, not a claim about the user: the goal answer tilts it, and
 * real spending replaces it as soon as Aaj has some.
 */
const MIX: Slice[] = [
  {
    key: "online",
    share: 0.18,
    merchant: "Amazon",
    category: "Shopping",
    goals: { shopping: 2.2 },
  },
  {
    key: "groceries",
    share: 0.14,
    merchant: "Grocery shops",
    category: "Groceries",
    upiShop: true,
    goals: { bills: 1.3 },
  },
  {
    key: "delivery",
    share: 0.1,
    merchant: "Swiggy",
    category: "Food delivery",
    goals: { food: 2.2 },
  },
  {
    key: "dining",
    share: 0.07,
    merchant: "Restaurants",
    category: "Dining out",
    upiShop: true,
    goals: { food: 2 },
  },
  {
    key: "power",
    share: 0.1,
    merchant: "Electricity bill",
    category: "Utilities & bills",
    goals: { bills: 2.2 },
  },
  {
    key: "phone",
    share: 0.03,
    merchant: "Airtel",
    category: "Utilities & bills",
    goals: { bills: 2.2 },
  },
  {
    key: "fuel",
    share: 0.08,
    merchant: "Petrol pump",
    category: null,
    goals: { fuel: 3 },
  },
  {
    key: "cabs",
    share: 0.04,
    merchant: "Uber",
    category: "Transport",
    goals: { travel: 1.5 },
  },
  {
    key: "flights",
    share: 0.04,
    merchant: "IndiGo flights",
    category: "Travel",
    goals: { travel: 3 },
  },
  {
    key: "hotels",
    share: 0.03,
    merchant: "Hotel stays",
    category: "Travel",
    goals: { travel: 3 },
  },
  {
    key: "movies",
    share: 0.03,
    merchant: "BookMyShow",
    category: "Entertainment",
  },
  { key: "ott", share: 0.01, merchant: "Netflix", category: "Entertainment" },
  {
    key: "stores",
    share: 0.12,
    merchant: "Shops and malls",
    category: "Shopping",
    upiShop: true,
    goals: { shopping: 1.3 },
  },
  {
    key: "health",
    share: 0.03,
    merchant: "Pharmacy",
    category: "Health",
    upiShop: true,
  },
];

const ONLINE_OF: Record<Platform, string[]> = {
  amazon: ["Amazon"],
  flipkart: ["Flipkart"],
  myntra: ["Myntra"],
  "food-apps": ["Amazon", "Flipkart"],
  tata: ["Tata CLiQ", "BigBasket", "Croma"],
  mix: ["Amazon", "Flipkart", "Myntra"],
};

/** Three months of spends that follow the answers. */
export function spendFromAnswers(a: FinderAnswers): CardTxn[] {
  const monthly = SPEND_OF_BAND[a.spend];
  const weighted = MIX.map((s) => {
    let w = s.share * (s.goals?.[a.goal] ?? 1);
    // "Mostly on Swiggy and Zomato": half of online shopping moves to delivery.
    if (a.platform === "food-apps") {
      if (s.key === "online") w *= 0.5;
      if (s.key === "delivery") w *= 1.9;
    }
    return { s, w };
  });
  const total = weighted.reduce((sum, x) => sum + x.w, 0);
  const txns: CardTxn[] = [];
  for (const month of ["2000-01", "2000-02", "2000-03"])
    for (const { s, w } of weighted) {
      const amount = (monthly * w) / total;
      const merchants =
        s.key === "online"
          ? ONLINE_OF[a.platform]
          : s.key === "delivery"
            ? ["Swiggy", "Zomato"]
            : s.key === "fuel"
              ? // Fuel cards pay at one oil company: spread over the big three.
                [
                  "HPCL petrol pump",
                  "BPCL petrol pump",
                  "Indian Oil petrol pump",
                ]
              : [s.merchant];
      merchants.forEach((merchant, i) =>
        txns.push({
          id: `${month}:${s.key}:${i}`,
          amount: Math.round(amount / merchants.length),
          date: `${month}-15`,
          merchant,
          category: s.category,
          channel: a.upi && s.upiShop ? "upi" : "card",
        }),
      );
    }
  return txns;
}

// ── What a card is good at ──────────────────────────────────────────────────

const GOAL_BUCKETS: Record<Exclude<Goal, "value">, Bucket[]> = {
  shopping: ["shopping-online", "shopping"],
  food: ["food", "food-delivery"],
  travel: ["travel", "flights", "hotels"],
  fuel: ["fuel"],
  bills: ["utilities", "bills", "telecom", "groceries"],
};
const GOAL_MERCHANTS: Record<Exclude<Goal, "value">, RegExp> = {
  shopping:
    /amazon|flipkart|myntra|nykaa|ajio|tataneu|tatacliq|croma|shopsy|reliancedigital|marksandspencer/,
  food: /swiggy|zomato|dineout|eatsure|district/,
  travel:
    /smartbuy|traveledge|ishop|cleartrip|makemytrip|irctc|scapia|flights|hotels/,
  fuel: /hpcl|bpcl|iocl|indianoil|bharatgas|shell/,
  bills:
    /airtel|jio|bigbasket|blinkit|instamart|googlepay|paytm|amazonpay|cred/,
};

/** Goals a card is clearly strong at — a boosted rate, or travel perks. */
export function strengths(p: CardProduct): Goal[] {
  const bar = Math.max(2, p.baseRate * 1.5);
  const out: Goal[] = [];
  for (const g of GOALS) {
    if (g === "value") continue;
    const ruleHit = p.rules.some(
      (r) =>
        r.rate >= bar &&
        (r.categories?.some((c) => GOAL_BUCKETS[g].includes(c)) ||
          r.merchants?.some((m) => GOAL_MERCHANTS[g].test(m))),
    );
    const perk =
      g === "travel"
        ? (p.loungeDomesticYear ?? 0) + (p.loungeIntlYear ?? 0) >= 4 ||
          (p.forexMarkup != null && p.forexMarkup <= 2)
        : g === "bills"
          ? p.upi && (p.upiRate ?? p.baseRate) >= 1
          : false;
    if (ruleHit || perk) out.push(g);
  }
  return out;
}

// ── Scoring one card ────────────────────────────────────────────────────────

export interface FinderPick {
  product: CardProduct;
  /** ₹ a year this card alone would give on the spending, after fee + GST. */
  netYearly: number;
  rewardsYearly: number;
  milestonesYearly: number;
  feeYearly: number;
  feeWaived: boolean;
  /** Spend it would carry in a year, and rewards as % of it. */
  spendYearly: number;
  effectiveRate: number;
  /** Where the value comes from: top three places. */
  wins: Array<{ label: string; valueYearly: number }>;
  /** Plain reasons this card fits the answers. */
  fits: string[];
  /** Things to keep in mind: exclusions that hit you, caps you'd reach, changes. */
  watchOuts: string[];
  strengths: Goal[];
  /** True when it doesn't match the goal and only fills the list. */
  closestFit: boolean;
  held: boolean;
  eligibility: Eligibility;
}

export interface FinderResult {
  basis: "real" | "answers";
  /** Monthly spend the scores are based on. */
  monthlySpend: number;
  picks: FinderPick[];
  /** Next-best cards, for "see more". */
  more: FinderPick[];
  /** Filters dropped to fill the list, so the app can say so. */
  relaxed: Array<"goal" | "fee" | "upi">;
}

const GOAL_LABEL: Record<Goal, string> = {
  shopping: "shopping",
  food: "food and dining",
  travel: "travel",
  fuel: "fuel",
  bills: "bills and everyday UPI",
  value: "overall value",
};

const BUCKET_WORDS: Partial<Record<Bucket, string>> = {
  fuel: "fuel",
  rent: "rent",
  wallet: "wallet top-ups",
  government: "government payments",
  utilities: "utility bills",
  bills: "bills",
  insurance: "insurance",
  education: "education",
  telecom: "phone bills",
  groceries: "groceries",
  gold: "gold and jewellery",
  emi: "EMIs",
};

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function scoreCard(
  product: CardProduct,
  txns: CardTxn[],
  yearly: number,
  answers: FinderAnswers,
  held: boolean,
  profile: { monthlyIncome: number | null; score: ScoreBand },
): FinderPick | null {
  const slot = { id: "c", product };
  const alloc = allocate([slot], txns);
  const rewardsYearly = alloc.total * yearly;
  const spendYearly = (alloc.spendBySlot.get("c") ?? 0) * yearly;
  const allSpendYearly = txns.reduce((s, t) => s + t.amount, 0) * yearly;
  const milestonesYearly = (product.milestones ?? [])
    .filter((m) => spendYearly >= m.spendYearly)
    .reduce((s, m) => s + m.valueRs, 0);
  const feeWaived =
    product.annualFee === 0 ||
    (product.feeWaiverSpend != null && spendYearly >= product.feeWaiverSpend);
  const feeYearly = feeWaived ? 0 : product.annualFee * GST;
  const netYearly = rewardsYearly + milestonesYearly - feeYearly;

  // Where it earns, and what it leaves on the table.
  const wins = new Map<string, number>();
  const excluded = new Map<string, number>();
  const capUse = new Map<string, number>(); // month|rule → raw value
  for (const t of txns) {
    const read = readTxn(t);
    if (read.skip) continue;
    const a = alloc.byTxn.get(t.id);
    const label = (t.merchant ?? "").trim() || t.category || "Other spends";
    if (a) wins.set(label, (wins.get(label) ?? 0) + a.value * yearly);
    const rate = rateFor(product, read, t.channel);
    if (rate.rate <= 0) {
      const b = [...read.buckets].find((x) => product.exclusions.includes(x));
      const what =
        rate.label === "Not on UPI"
          ? "UPI payments at shops"
          : b
            ? (BUCKET_WORDS[b] ?? b)
            : null;
      if (what)
        excluded.set(what, (excluded.get(what) ?? 0) + t.amount * yearly);
    }
    if (rate.ruleIndex !== -1) {
      const k = `${t.date.slice(0, 7)}|${rate.ruleIndex}`;
      capUse.set(k, (capUse.get(k) ?? 0) + (rate.rate * t.amount) / 100);
    }
  }

  const watchOuts: string[] = [];
  for (const [what, amount] of [...excluded].sort((a, b) => b[1] - a[1]))
    if (amount >= 1000)
      watchOuts.push(
        `No rewards on ${what} (about ${inr(amount)} of your spending a year)`,
      );
  const capsHit = new Set<number>();
  for (const [k, raw] of capUse) {
    const idx = Number(k.split("|")[1]);
    const cap =
      idx === -2 ? product.baseCapMonthly : product.rules[idx]?.capMonthly;
    if (cap != null && raw > cap) capsHit.add(idx);
  }
  for (const idx of capsHit) {
    const cap =
      idx === -2 ? product.baseCapMonthly! : product.rules[idx].capMonthly!;
    const what =
      idx === -2 ? "Base rewards" : `"${shortRule(product.rules[idx].label)}"`;
    watchOuts.push(
      `${what} stop at ${inr(cap)} a month, and your spending would reach that`,
    );
  }
  if (product.annualFee > 0 && !feeWaived)
    watchOuts.push(
      product.feeWaiverSpend
        ? `${inr(product.annualFee)} + GST a year unless you spend ${inr(product.feeWaiverSpend)}; your spending wouldn't reach it`
        : `${inr(product.annualFee)} + GST every year, no waiver`,
    );
  // A change that helps (a fee dropped) is news, not a warning.
  const recent = (product.changes ?? []).find(
    (c) => !/positive/i.test(c.change),
  );
  if (recent) watchOuts.push(`Rules changed ${recent.date}: ${recent.change}`);
  if (product.confidence !== "high")
    watchOuts.push(
      "Some of these rules are only partly confirmed; check the bank's terms",
    );

  const fits: string[] = [];
  const s = strengths(product);
  if (answers.goal !== "value" && s.includes(answers.goal))
    fits.push(`Strong on ${GOAL_LABEL[answers.goal]}`);
  if (product.annualFee === 0) fits.push("No annual fee");
  else if (feeWaived) fits.push("Your spending waives the annual fee");
  if (product.upi) fits.push("Works on UPI (RuPay)");
  const lounges =
    (product.loungeDomesticYear ?? 0) + (product.loungeIntlYear ?? 0);
  if (lounges > 0 && answers.goal === "travel")
    fits.push(
      lounges >= 50
        ? "50+ airport lounge visits a year"
        : `${lounges} airport lounge visits a year`,
    );
  if (
    product.forexMarkup != null &&
    product.forexMarkup <= 2 &&
    answers.goal === "travel"
  )
    fits.push(`Low ${product.forexMarkup}% forex markup`);

  const effectiveRate =
    allSpendYearly > 0
      ? Math.round(
          ((rewardsYearly + milestonesYearly) / allSpendYearly) * 1000,
        ) / 10
      : 0;
  if (effectiveRate >= 1)
    fits.push(`About ${effectiveRate}% back on everything you spend`);

  return {
    product,
    netYearly: Math.round(netYearly),
    rewardsYearly: Math.round(rewardsYearly),
    milestonesYearly: Math.round(milestonesYearly),
    feeYearly: Math.round(feeYearly),
    feeWaived,
    spendYearly: Math.round(spendYearly),
    effectiveRate,
    wins: [...wins]
      .filter(([, v]) => v >= 50)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([label, v]) => ({ label, valueYearly: Math.round(v) })),
    fits,
    watchOuts: watchOuts.slice(0, 5),
    strengths: s,
    closestFit: false,
    held,
    eligibility: eligibility(product, profile.monthlyIncome, profile.score),
  };
}

function shortRule(label: string): string {
  return label.length > 48 ? `${label.slice(0, 46).trim()}…` : label;
}

// ── Ranking ─────────────────────────────────────────────────────────────────

export interface FinderInput {
  catalog: CardProduct[];
  answers: FinderAnswers;
  /** The user's spends (any window); used when answers.useMySpending. */
  txns: CardTxn[];
  days: number;
  held: HeldCard[];
  profile: { monthlyIncome: number | null; score: ScoreBand };
  limit?: number;
}

/** True when the real spends are enough to score cards on. */
export function realSpendingUsable(txns: CardTxn[], days: number): boolean {
  if (days < MIN_REAL_DAYS) return false;
  const spend = txns
    .filter((t) => !readTxn(t).skip)
    .reduce((s, t) => s + t.amount, 0);
  return (spend / days) * 30 >= MIN_REAL_MONTHLY;
}

export function findCards(input: FinderInput): FinderResult {
  const { catalog, answers, held, profile } = input;
  const limit = input.limit ?? 3;
  const real =
    answers.useMySpending && realSpendingUsable(input.txns, input.days);
  const txns = real ? withoutOneOffs(input.txns) : spendFromAnswers(answers);
  const yearly = real ? 365 / Math.max(input.days, 30) : 4; // 3 months → a year
  const monthlySpend = !real
    ? SPEND_OF_BAND[answers.spend]
    : Math.round(
        (txns
          .filter((t) => !readTxn(t).skip)
          .reduce((s, t) => s + t.amount, 0) *
          yearly) /
          12,
      );
  const heldKeys = new Set(
    held.map((h) => h.product?.key).filter(Boolean) as string[],
  );

  const pool = catalog.filter(
    (p) => (p.status ?? "active") === "active" && p.confidence !== "low",
  );
  const scored = pool
    .map((p) =>
      scoreCard(p, txns, yearly, answers, heldKeys.has(p.key), profile),
    )
    .filter((x): x is FinderPick => x !== null);

  const feeOk = (x: FinderPick) => x.product.annualFee <= FEE_CAP[answers.fee];
  const upiOk = (x: FinderPick) => !answers.upi || x.product.upi;
  const goalOk = (x: FinderPick) =>
    answers.goal === "value" || x.strengths.includes(answers.goal);
  const order = { likely: 0, stretch: 0, unlikely: 1 };
  const rank = (a: FinderPick, b: FinderPick) =>
    order[a.eligibility.chance] - order[b.eligibility.chance] ||
    b.netYearly - a.netYearly ||
    (a.product.confidence === "high" ? -1 : 0) -
      (b.product.confidence === "high" ? -1 : 0);

  // Strict first; then relax the goal, then the fee, then UPI — the user
  // always sees three cards and is told which wish couldn't be met.
  const relaxed: FinderResult["relaxed"] = [];
  const strict = scored.filter((x) => feeOk(x) && upiOk(x) && goalOk(x));
  let list = [...strict].sort(rank);
  const fill = (
    test: (x: FinderPick) => boolean,
    why: "goal" | "fee" | "upi",
  ) => {
    if (list.length >= limit) return;
    const have = new Set(list.map((x) => x.product.key));
    const extra = scored
      .filter((x) => !have.has(x.product.key) && test(x))
      .sort(rank)
      .map((x) => ({ ...x, closestFit: true }));
    if (extra.length) {
      relaxed.push(why);
      list = [...list, ...extra];
    }
  };
  fill((x) => feeOk(x) && upiOk(x), "goal");
  fill((x) => upiOk(x), "fee");
  fill(() => true, "upi");

  // A card that loses money on this spending is never a pick.
  list = list.filter((x) => x.netYearly > 0 || x.product.annualFee === 0);
  return {
    basis: real ? "real" : "answers",
    monthlySpend,
    picks: list.slice(0, limit),
    more: list.slice(limit, limit + 5),
    relaxed: relaxed.filter((r, i) => relaxed.indexOf(r) === i),
  };
}

/** Parses and checks answers from the app; throws a readable message. */
export function parseAnswers(raw: unknown): FinderAnswers {
  const a = (raw ?? {}) as Record<string, unknown>;
  const pick = <T extends string>(
    v: unknown,
    allowed: readonly T[],
    name: string,
  ): T => {
    if (typeof v === "string" && (allowed as readonly string[]).includes(v))
      return v as T;
    throw new Error(`${name} must be one of ${allowed.join(", ")}`);
  };
  return {
    goal: pick(a.goal, GOALS, "goal"),
    fee: pick(a.fee, FEE_BANDS, "fee"),
    platform: pick(a.platform ?? "mix", PLATFORMS, "platform"),
    upi: a.upi === true,
    spend: pick(a.spend ?? "15-50", SPEND_BANDS, "spend"),
    useMySpending: a.useMySpending !== false,
  };
}
