/**
 * Aaj Cards — shared shapes. A card's rewards are written as rupee value per
 * ₹100 spent ("rate", in %), after converting points at a realistic
 * redemption value, so every card compares on the same scale.
 */

/** Spend buckets the reward rules are written against. */
export type Bucket =
  | "food"
  | "food-delivery"
  | "groceries"
  | "shopping-online"
  | "shopping"
  | "travel"
  | "flights"
  | "hotels"
  | "cabs"
  | "fuel"
  | "utilities"
  | "bills"
  | "telecom"
  | "rent"
  | "insurance"
  | "education"
  | "entertainment"
  | "ott"
  | "health"
  | "wallet"
  | "government"
  | "gold"
  | "emi";

export interface RewardRule {
  label: string;
  /** Lowercase brand keys ("swiggy", "amazon"); matched against the merchant. */
  merchants?: string[];
  categories?: Bucket[];
  /** Value % on matching spend. */
  rate: number;
  /** Most rupee value this rule pays in a calendar month; null = no cap. */
  capMonthly?: number | null;
  /** Only when paid through UPI (RuPay credit on UPI). */
  upiOnly?: boolean;
}

export interface Milestone {
  spendYearly: number;
  valueRs: number;
  label: string;
}

export interface CardProduct {
  key: string;
  bank: string;
  name: string;
  networks: string[];
  /** RuPay credit card that works on UPI. */
  upi: boolean;
  /** Value % on UPI spends, when it differs from the base rate. */
  upiRate?: number | null;
  joiningFee: number;
  annualFee: number;
  /** Yearly spend that waives the next annual fee; null = never waived. */
  feeWaiverSpend: number | null;
  baseRate: number;
  /** Most rupee value the base rate pays in a month; null = no cap. */
  baseCapMonthly?: number | null;
  rules: RewardRule[];
  /** Buckets that earn nothing. */
  exclusions: Bucket[];
  /** Buckets that earn less than the base rate. */
  reducedRate?: Partial<Record<Bucket, number>>;
  milestones?: Milestone[];
  loungeDomesticYear?: number | null;
  loungeIntlYear?: number | null;
  forexMarkup?: number | null;
  minIncomeMonthly?: number | null;
  /** Plain product page on the bank's site — never an affiliate link. */
  url?: string | null;
  /** The day these rules were last checked against the bank's own terms. */
  verified: string;
  confidence: "high" | "medium" | "low";
  /** "active" cards can be suggested; the others can still be held. */
  status?: "active" | "closed-new" | "paused";
  /** Rule changes the bank announced, newest first ("devaluations" too). */
  changes?: Array<{ date: string; change: string }>;
  /** One line on what the card is good at, for the list. */
  pitch?: string;
}

/** One spend, as the engine sees it. */
export interface CardTxn {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  merchant: string | null;
  category: string | null;
  /** How it was paid. */
  channel: "card" | "upi" | "other";
  /** The user's card it was paid with (user_cards.id), when known. */
  cardId?: string | null;
}

/** A card the user holds, with its product when known. */
export interface HeldCard {
  id: string;
  bank: string;
  last4: string | null;
  product: CardProduct | null;
}
