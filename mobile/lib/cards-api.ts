import { API_BASE } from "./api";

/** Aaj Cards — the shapes /api/cards returns (src/lib/cards/service.ts). */

export interface CardRuleView {
  label: string;
  rate: number;
  capMonthly: number | null;
}

export interface CardProductView {
  key: string;
  bank: string;
  name: string;
  networks: string[];
  upi: boolean;
  annualFee: number;
  joiningFee: number;
  feeWaiverSpend: number | null;
  baseRate: number;
  rules: CardRuleView[];
  loungeDomesticYear: number | null;
  loungeIntlYear: number | null;
  forexMarkup: number | null;
  minIncomeMonthly: number | null;
  url: string | null;
  /** The card face from the bank site; null = draw it. */
  image: string | null;
  verified: string;
  confidence: "high" | "medium" | "low";
  pitch: string | null;
  milestones: Array<{ spendYearly: number; valueRs: number; label: string }>;
  changes: Array<{ date: string; change: string }>;
}

export interface CardHealthView {
  spend: number;
  yearlyPace: number;
  feeWaiver: { target: number; pace: number; onTrack: boolean } | null;
  milestones: Array<{
    label: string;
    target: number;
    valueRs: number;
    pace: number;
    onTrack: boolean;
  }>;
  changes: Array<{
    date: string;
    change: string;
    upcoming: boolean;
    recent: boolean;
    affectsYou: boolean;
  }>;
}

export interface CardAlert {
  cardId: string;
  date: string;
  change: string;
  upcoming: boolean;
  affectsYou: boolean;
}

export interface HeldCardView {
  id: string;
  bank: string;
  last4: string | null;
  product: CardProductView | null;
  spendInWindow: number;
  earned: number;
  health: CardHealthView | null;
}

export interface CardSuggestion {
  bank: string;
  last4: string;
  productGuess: string | null;
  spends: number;
  lastSeen: string;
  product: CardProductView | null;
}

export interface MissedLine {
  label: string;
  spend: number;
  count: number;
  paidWith: string;
  earned: number;
  bestCard: string;
  bestValue: number;
  missed: number;
  why: string;
  options: Array<{ cardId: string; rate: number; why: string }>;
  spends: Array<{ date: string; amount: number }>;
}

export interface MissedReport {
  days: number;
  cardSpend: number;
  earned: number;
  couldHaveEarned: number;
  missed: number;
  lines: MissedLine[];
  upi: { spend: number; value: number; cardId: string } | null;
  unknownCardSpend: number;
}

export type Chance = "likely" | "stretch" | "unlikely";
export type ScoreBand =
  "750+" | "700-749" | "650-699" | "below-650" | "unknown";

export interface NextCardView {
  product: CardProductView;
  netYearly: number;
  rewardsYearly: number;
  milestonesYearly: number;
  feeYearly: number;
  feeWaived: boolean;
  spendYearly: number;
  wins: Array<{ label: string; valueYearly: number }>;
  eligibility: { chance: Chance; reasons: string[] };
}

// ── Credit score (v22) ──────────────────────────────────────────────────────

export type Bureau = "cibil" | "experian" | "equifax" | "crif";

export interface ScoreEntry {
  id: string;
  bureau: Bureau;
  score: number;
  checked_on: string;
  via: string | null;
}

export type LatestScore = ScoreEntry & {
  change: number | null;
  ageDays: number;
};

export interface FreeSource {
  key: string;
  name: string;
  bureau: Bureau;
  refresh: "monthly" | "yearly";
  androidPackage: string | null;
  url: string;
  how: string;
}

export interface ScoreFactor {
  key: string;
  title: string;
  weight: "high" | "medium" | "low";
  status: "good" | "watch" | "risk" | "unknown";
  text: string;
}

export interface ScoreView {
  summary: {
    latest: LatestScore[];
    history: ScoreEntry[];
    current: LatestScore | null;
    refreshDue: boolean;
  };
  rating: { label: string; tone: "great" | "good" | "fair" | "poor" } | null;
  factors: ScoreFactor[];
  sources: FreeSource[];
  bureaus: Record<Bureau, string>;
}

export interface CardsData {
  days: number;
  catalogVerified: string;
  cards: HeldCardView[];
  alerts: CardAlert[];
  suggestions: CardSuggestion[];
  missed: MissedReport;
  useFor: Array<{
    label: string;
    spend: number;
    cardId: string;
    rate: number;
    why: string;
    runnerUp: { cardId: string; rate: number } | null;
  }>;
  next: NextCardView[];
  stress: Array<{ kind: string; text: string; date: string }>;
  profile: {
    score_band: ScoreBand;
    monthly_income: number | null;
    stress_cleared_at: string | null;
    /** The "next time here, use this card" line on spend alerts. */
    spend_tips: boolean;
    estimatedIncome: number | null;
  };
  /** Card Finder prefill: real spending to score on, and its monthly size. */
  finder?: { realSpending: boolean; monthlySpend: number | null };
  /** v22: saved credit scores, free places to check, what moves them. */
  score?: ScoreView;
  catalog: Array<{
    key: string;
    bank: string;
    name: string;
    image?: string | null;
  }>;
}

export type CardAction =
  | {
      action: "confirm";
      bank: string;
      last4: string;
      product_key: string | null;
    }
  | { action: "dismiss"; bank: string; last4: string }
  | { action: "add"; bank: string; product_key: string }
  | { action: "set_product"; id: string; product_key: string | null }
  | { action: "hide"; id: string }
  | { action: "remove"; id: string }
  | {
      action: "profile";
      score_band?: ScoreBand;
      monthly_income?: number | null;
      spend_tips?: boolean;
    }
  | { action: "clear_stress" }
  | {
      action: "score_add";
      score: number;
      bureau: Bureau;
      checked_on?: string;
      via?: string;
    }
  | { action: "score_remove"; id: string }
  | { action: "forget" };

function headers(token: string) {
  return {
    Authorization: `Bearer ${token.trim()}`,
    "Content-Type": "application/json",
  };
}

export async function fetchCards(token: string): Promise<CardsData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/cards`, {
      headers: headers(token),
    });
    if (!res.ok) return null;
    return (await res.json()) as CardsData;
  } catch {
    return null;
  }
}

/** Applies the change and returns the refreshed view, or an error to show. */
export async function cardAction(
  token: string,
  action: CardAction,
): Promise<
  { ok: true; data: CardsData } | { ok: false; error: string | null }
> {
  try {
    const res = await fetch(`${API_BASE}/api/cards`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(action),
    });
    const json = (await res.json().catch(() => null)) as
      (CardsData & { error?: string }) | null;
    if (res.ok && json) return { ok: true, data: json };
    return { ok: false, error: json?.error ?? null };
  } catch {
    return { ok: false, error: null };
  }
}

// ── Card Finder (/api/cards/find) ───────────────────────────────────────────

export type FinderGoal =
  "shopping" | "food" | "travel" | "fuel" | "bills" | "value";
export type FinderFee = "free" | "500" | "2000" | "5000" | "any";
export type FinderPlatform =
  "amazon" | "flipkart" | "myntra" | "food-apps" | "tata" | "mix";
export type FinderSpend = "lt15" | "15-50" | "50-100" | "100plus";

export interface FinderAnswers {
  goal: FinderGoal;
  fee: FinderFee;
  platform: FinderPlatform;
  upi: boolean;
  spend: FinderSpend;
  useMySpending: boolean;
}

export interface FinderPick {
  product: CardProductView;
  netYearly: number;
  rewardsYearly: number;
  milestonesYearly: number;
  feeYearly: number;
  feeWaived: boolean;
  spendYearly: number;
  effectiveRate: number;
  wins: Array<{ label: string; valueYearly: number }>;
  fits: string[];
  watchOuts: string[];
  strengths: FinderGoal[];
  closestFit: boolean;
  held: boolean;
  eligibility: { chance: Chance; reasons: string[] };
}

export interface FinderResult {
  basis: "real" | "answers";
  monthlySpend: number;
  picks: FinderPick[];
  more: FinderPick[];
  relaxed: Array<"goal" | "fee" | "upi">;
  stressed: boolean;
}

/** The best cards for these answers, or an error to show. */
export async function findCards(
  token: string,
  answers: FinderAnswers,
): Promise<
  { ok: true; data: FinderResult } | { ok: false; error: string | null }
> {
  try {
    const res = await fetch(`${API_BASE}/api/cards/find`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(answers),
    });
    const json = (await res.json().catch(() => null)) as
      (FinderResult & { error?: string }) | null;
    if (res.ok && json) return { ok: true, data: json };
    return { ok: false, error: json?.error ?? null };
  } catch {
    return { ok: false, error: null };
  }
}

/**
 * A bank card image, resized and cached by the Aaj server (the Next image
 * optimiser), so the app never hot-links a bank site. The width must be one
 * of the server's sizes: 256, 384, 640 or 750.
 */
export function cardImageUrl(
  src: string,
  width: 256 | 384 | 640 | 750,
): string {
  return `${API_BASE}/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}
