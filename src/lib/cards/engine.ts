import type {
  Bucket,
  CardProduct,
  CardTxn,
  HeldCard,
  RewardRule,
} from "./types";

/**
 * Aaj Cards engine. Everything is computed from the user's own captured
 * spending: which card earned what, what the best card they already hold
 * would have earned, and which new card adds the most on top — net of fees,
 * with GST. Pure functions, no I/O, so every number can be tested.
 */

const GST = 1.18;

// ── Reading a spend ─────────────────────────────────────────────────────────

/** Aaj's categories → the buckets reward rules are written against. */
const CATEGORY_BUCKETS: Record<string, Bucket[]> = {
  "Food delivery": ["food-delivery"],
  Groceries: ["groceries"],
  Transport: ["cabs"],
  Shopping: ["shopping"],
  Entertainment: ["entertainment"],
  "Utilities & bills": ["utilities", "bills"],
  Health: ["health"],
  "Dining out": ["food"],
  "Personal care": ["shopping"],
  Travel: ["travel"],
  Education: ["education"],
  "Loans & EMI": ["emi"],
};

/** Not spending a card can take: investments, EMIs, gifts of cash. */
const NOT_CARD_SPEND = new Set([
  "Investments",
  "Loans & EMI",
  "Gifts & donations",
]);

/** Merchant words → extra buckets. Checked against the lowercase merchant. */
const MERCHANT_BUCKETS: Array<[RegExp, Bucket[]]> = [
  [
    /\b(?:hpcl|bpcl|iocl|indian ?oil|bharat petroleum|hindustan petroleum|shell|nayara|petrol|fuel|filling station)\b/,
    ["fuel"],
  ],
  [
    /\b(?:jio|airtel|vodafone|\bvi\b|bsnl|act fibernet|hathway|recharge)\b/,
    ["telecom", "bills"],
  ],
  [
    /\b(?:netflix|hotstar|jiohotstar|prime video|spotify|youtube premium|sonyliv|zee5|jiocinema|apple\.com\/bill)\b/,
    ["ott", "entertainment"],
  ],
  [/\b(?:bookmyshow|pvr|inox|district)\b/, ["entertainment"]],
  [
    /\b(?:indigo|air india|akasa|spicejet|vistara|flight|airlines?)\b/,
    ["flights", "travel"],
  ],
  [
    /\b(?:oyo|marriott|taj|hyatt|hilton|itc hotel|hotel|airbnb|agoda|booking\.com)\b/,
    ["hotels", "travel"],
  ],
  [
    /\b(?:makemytrip|goibibo|cleartrip|yatra|ixigo|easemytrip|irctc)\b/,
    ["travel"],
  ],
  [/\b(?:uber|ola|rapido|blusmart|namma yatri)\b/, ["cabs"]],
  [
    /\b(?:amazon|flipkart|myntra|ajio|nykaa|meesho|tata ?cliq|croma|reliance digital|snapdeal|firstcry|lenskart)\b/,
    ["shopping-online"],
  ],
  [
    /\b(?:blinkit|zepto|instamart|bigbasket|jiomart|dmart|swiggy instamart)\b/,
    ["groceries"],
  ],
  [/\b(?:swiggy|zomato|eatsure|eatclub)\b/, ["food-delivery"]],
  [/\b(?:nobroker|cred rent|rent|housing\.com)\b/, ["rent"]],
  [
    /\b(?:lic|insurance|policybazaar|acko|digit insurance|hdfc ergo|icici lombard|star health)\b/,
    ["insurance"],
  ],
  [
    /\b(?:paytm wallet|amazon pay balance|add money|wallet load|phonepe wallet)\b/,
    ["wallet"],
  ],
  [/\b(?:tanishq|kalyan|malabar|caratlane|gold|jewel)/, ["gold"]],
  [
    /\b(?:electricity|bescom|tata power|adani electricity|msedcl|bses|water|gas bill|piped gas|broadband|dth|tata play)\b/,
    ["utilities", "bills"],
  ],
  [
    /\b(?:income tax|gst|passport|traffic challan|municipal|govt|government)\b/,
    ["government"],
  ],
];

/**
 * Online brands that also take cards in their own app or site — so a UPI
 * payment there could have been a card payment instead.
 */
const CARD_ABLE_ONLINE =
  /\b(?:amazon|flipkart|myntra|ajio|nykaa|meesho|swiggy|zomato|blinkit|zepto|instamart|bigbasket|uber|ola|makemytrip|goibibo|cleartrip|irctc|bookmyshow|netflix|spotify|hotstar|jiomart|tata ?cliq|croma|lenskart|airtel|jio)\b/;

export function normalizeMerchant(m: string | null | undefined): string {
  return (m ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9@.&' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ReadTxn {
  merchant: string;
  buckets: Set<Bucket>;
  /** A card could have paid for this. */
  cardAble: boolean;
  /** Investments, EMIs and the like — left out of every sum. */
  skip: boolean;
}

export function readTxn(t: CardTxn): ReadTxn {
  const merchant = normalizeMerchant(t.merchant);
  const buckets = new Set<Bucket>(CATEGORY_BUCKETS[t.category ?? ""] ?? []);
  for (const [re, add] of MERCHANT_BUCKETS)
    if (re.test(merchant)) for (const b of add) buckets.add(b);
  const skip = NOT_CARD_SPEND.has(t.category ?? "") || t.amount <= 0;
  // A UPI spend at the corner shop can't move to a card; one in Swiggy's app can.
  const cardAble = t.channel !== "upi" || CARD_ABLE_ONLINE.test(merchant);
  return { merchant, buckets, cardAble, skip };
}

// ── What one card pays on one spend ─────────────────────────────────────────

function ruleMatches(rule: RewardRule, read: ReadTxn): boolean {
  // A rule naming merchants is about those merchants: "10% on Swiggy (food
  // delivery)" never pays 10% at Zepto. Categories decide only when no
  // merchant is named.
  if (rule.merchants?.length)
    return rule.merchants.some((m) => merchantHas(read.merchant, m));
  return Boolean(rule.categories?.some((c) => read.buckets.has(c)));
}

/** "swiggy" matches "swiggy instamart" but "ola" never matches "coca cola". */
function merchantHas(merchant: string, key: string): boolean {
  if (!merchant) return false;
  const k = key.toLowerCase().trim();
  if (` ${merchant} `.includes(` ${k} `) || merchant === k) return true;
  // Long keys may be written without spaces: "tatacliq" for "Tata CLiQ".
  return (
    k.length >= 5 && merchant.replace(/ /g, "").includes(k.replace(/ /g, ""))
  );
}

/** ruleIndex of the base rate when the card caps it monthly. */
const BASE = -2;

export interface Rate {
  rate: number;
  /** Index into card.rules; BASE for a capped base rate; -1 otherwise. */
  ruleIndex: number;
  label: string;
}

/**
 * The value % `card` pays on this spend, paid the way `channel` says. A rule
 * naming the merchant or category wins; then exclusions (fuel, rent…); then
 * reduced-rate buckets; then the base rate.
 */
export function rateFor(
  card: CardProduct,
  read: ReadTxn,
  channel: CardTxn["channel"],
): Rate {
  // A UPI spend at a shop that takes only UPI can move only to a RuPay card,
  // paid by UPI; anything else is paid by card, where UPI-only rules don't apply.
  const payingByUpi = channel === "upi" && !read.cardAble;
  if (payingByUpi && !card.upi)
    return { rate: 0, ruleIndex: -1, label: "Not on UPI" };

  let best: Rate | null = null;
  card.rules.forEach((rule, i) => {
    if (Boolean(rule.upiOnly) !== payingByUpi) return;
    if (!ruleMatches(rule, read)) return;
    if (!best || rule.rate > best.rate)
      best = { rate: rule.rate, ruleIndex: i, label: rule.label };
  });
  if (best) return best;

  for (const b of read.buckets)
    if (card.exclusions.includes(b))
      return { rate: 0, ruleIndex: -1, label: `No rewards on ${b}` };

  let reduced: number | null = null;
  for (const b of read.buckets) {
    const r = card.reducedRate?.[b];
    if (r !== undefined && (reduced === null || r < reduced)) reduced = r;
  }
  if (reduced !== null)
    return { rate: reduced, ruleIndex: -1, label: "Lower rate" };

  if (payingByUpi && card.upiRate != null)
    return { rate: card.upiRate, ruleIndex: -1, label: "UPI rate" };
  return {
    rate: card.baseRate,
    ruleIndex: card.baseCapMonthly != null ? BASE : -1,
    label: "Base rate",
  };
}

// ── Caps: a month's budget per rule ─────────────────────────────────────────

class CapBook {
  private used = new Map<string, number>();
  constructor(private month: string) {}
  /** Value this spend can still earn under the rule's monthly cap. */
  take(
    cardKey: string,
    card: CardProduct,
    rate: Rate,
    amount: number,
    commit: boolean,
  ): number {
    const raw = (rate.rate * amount) / 100;
    if (rate.ruleIndex === -1) return raw;
    const cap =
      rate.ruleIndex === BASE
        ? card.baseCapMonthly
        : card.rules[rate.ruleIndex].capMonthly;
    if (cap == null) return raw;
    const key = `${cardKey}|${rate.ruleIndex}|${this.month}`;
    const left = Math.max(0, cap - (this.used.get(key) ?? 0));
    const got = Math.min(raw, left);
    if (commit) this.used.set(key, (this.used.get(key) ?? 0) + got);
    return got;
  }
}

/** A card the engine may put spends on: a held card, or a candidate. */
export interface Slot {
  id: string;
  product: CardProduct;
}

export interface Assignment {
  slotId: string;
  value: number;
  label: string;
}

export interface Allocation {
  total: number;
  byTxn: Map<string, Assignment>;
  /** Spend that each slot carried. */
  spendBySlot: Map<string, number>;
}

/**
 * Put every spend on the card that pays most for it, month by month, biggest
 * spends first so caps go to the spends they pay most on. Not a perfect
 * optimiser, but close, and easy to explain: "this card, for this spend".
 */
export function allocate(slots: Slot[], txns: CardTxn[]): Allocation {
  const byTxn = new Map<string, Assignment>();
  const spendBySlot = new Map<string, number>();
  let total = 0;
  const months = groupBy(txns, (t) => t.date.slice(0, 7));
  for (const [month, list] of months) {
    const caps = new CapBook(month);
    for (const t of [...list].sort((a, b) => b.amount - a.amount)) {
      const read = readTxn(t);
      if (read.skip) continue;
      let best: { slot: Slot; rate: Rate; value: number } | null = null;
      for (const slot of slots) {
        const rate = rateFor(slot.product, read, t.channel);
        if (rate.rate <= 0) continue;
        const value = caps.take(slot.id, slot.product, rate, t.amount, false);
        if (!best || value > best.value) best = { slot, rate, value };
      }
      if (!best || best.value <= 0) continue;
      caps.take(best.slot.id, best.slot.product, best.rate, t.amount, true);
      byTxn.set(t.id, {
        slotId: best.slot.id,
        value: best.value,
        label: best.rate.label,
      });
      spendBySlot.set(
        best.slot.id,
        (spendBySlot.get(best.slot.id) ?? 0) + t.amount,
      );
      total += best.value;
    }
  }
  return { total, byTxn, spendBySlot };
}

/** What the cards actually earned, on the spends they actually paid for. */
export function actualEarnings(
  held: HeldCard[],
  txns: CardTxn[],
): Map<string, number> {
  const earned = new Map<string, number>();
  const known = new Map(
    held.filter((h) => h.product).map((h) => [h.id, h.product!]),
  );
  for (const [month, list] of groupBy(txns, (t) => t.date.slice(0, 7))) {
    const caps = new CapBook(month);
    for (const t of [...list].sort((a, b) => a.date.localeCompare(b.date))) {
      const product = t.cardId ? known.get(t.cardId) : undefined;
      if (!product) continue;
      const read = readTxn(t);
      if (read.skip) continue;
      const rate = rateFor(product, read, "card");
      const value = caps.take(t.cardId!, product, rate, t.amount, true);
      earned.set(t.id, value);
    }
  }
  return earned;
}

// ── 1. Missed rewards on the cards you hold ─────────────────────────────────

export interface MissedLine {
  /** What the user sees: the merchant, or the category. */
  label: string;
  spend: number;
  count: number;
  paidWith: string; // held card id
  earned: number;
  bestCard: string; // held card id
  bestValue: number;
  missed: number;
  /** "5% on Swiggy" — why the better card wins. */
  why: string;
  /** Every card you hold, and what it pays here: the breakdown screen. */
  options: Array<{ cardId: string; rate: number; why: string }>;
  /** The spends behind this line, newest first (up to 8). */
  spends: Array<{ date: string; amount: number }>;
}

export interface MissedReport {
  days: number;
  /** Spends paid by a card we know, and what they earned. */
  cardSpend: number;
  earned: number;
  couldHaveEarned: number;
  missed: number;
  lines: MissedLine[];
  /** UPI spends a held RuPay card could have earned on. */
  upi: { spend: number; value: number; cardId: string } | null;
  /** Card spends we can't value: the card's product isn't known yet. */
  unknownCardSpend: number;
}

export function missedRewards(
  held: HeldCard[],
  txns: CardTxn[],
  days: number,
): MissedReport {
  const known = held.filter((h) => h.product);
  const slots: Slot[] = known.map((h) => ({ id: h.id, product: h.product! }));
  const knownIds = new Set(known.map((h) => h.id));

  const onKnownCards = txns.filter(
    (t) => t.cardId && knownIds.has(t.cardId) && !readTxn(t).skip,
  );
  const unknownCardSpend = sum(
    txns.filter(
      (t) =>
        t.channel === "card" &&
        !(t.cardId && knownIds.has(t.cardId)) &&
        !readTxn(t).skip,
    ),
    (t) => t.amount,
  );

  const actual = actualEarnings(known, onKnownCards);
  const best = allocate(
    slots,
    onKnownCards.map((t) => ({ ...t, channel: "card" as const })),
  );

  const groups = new Map<string, MissedLine>();
  for (const t of onKnownCards) {
    const earned = actual.get(t.id) ?? 0;
    const alt = best.byTxn.get(t.id);
    const bestValue = alt?.value ?? 0;
    const label = displayLabel(t);
    const key = `${label}|${t.cardId}|${alt?.slotId ?? t.cardId}`;
    const g = groups.get(key) ?? {
      label,
      spend: 0,
      count: 0,
      paidWith: t.cardId!,
      earned: 0,
      bestCard: alt?.slotId ?? t.cardId!,
      bestValue: 0,
      missed: 0,
      why: alt?.label ?? "",
      options: known
        .map((h) => {
          const r = rateFor(
            h.product!,
            readTxn({ ...t, channel: "card" }),
            "card",
          );
          return { cardId: h.id, rate: r.rate, why: r.label };
        })
        .sort((a, b) => b.rate - a.rate),
      spends: [],
    };
    g.spends.push({ date: t.date, amount: t.amount });
    g.spend += t.amount;
    g.count += 1;
    g.earned += earned;
    g.bestValue += Math.max(bestValue, earned);
    g.missed = Math.max(0, g.bestValue - g.earned);
    groups.set(key, g);
  }
  const lines = [...groups.values()]
    .filter((g) => g.missed >= 1 && g.bestCard !== g.paidWith)
    .sort((a, b) => b.missed - a.missed);

  const earned = sum([...actual.values()], (v) => v);
  const couldHaveEarned = earned + sum(lines, (l) => l.missed);

  // UPI spends that a RuPay card you already hold would have paid on.
  const upiSlots = slots.filter((s) => s.product.upi);
  let upi: MissedReport["upi"] = null;
  if (upiSlots.length) {
    const upiTxns = txns.filter(
      (t) => t.channel === "upi" && !t.cardId && !readTxn(t).skip,
    );
    const alloc = allocate(upiSlots, upiTxns);
    if (alloc.total >= 1) {
      const top = [...alloc.spendBySlot.entries()].sort(
        (a, b) => b[1] - a[1],
      )[0];
      upi = {
        spend: sum(upiTxns, (t) => t.amount),
        value: alloc.total,
        cardId: top[0],
      };
    }
  }

  return {
    days,
    cardSpend: sum(onKnownCards, (t) => t.amount),
    earned: round(earned),
    couldHaveEarned: round(couldHaveEarned),
    // From the rounded figures, so earned + missed = could have earned on screen.
    missed: round(couldHaveEarned) - round(earned),
    lines: lines.map((l) => ({
      ...l,
      earned: round(l.earned),
      bestValue: round(l.bestValue),
      missed: round(l.missed),
      spends: [...l.spends]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 8),
    })),
    upi: upi && { ...upi, value: round(upi.value) },
    unknownCardSpend: round(unknownCardSpend),
  };
}

// ── Use this card for… (the best card you hold, where you spend most) ───────

export interface UseFor {
  label: string;
  spend: number;
  cardId: string;
  rate: number;
  why: string;
  /** The next-best card you hold there, so the gap is visible. */
  runnerUp: { cardId: string; rate: number } | null;
}

export function useFor(held: HeldCard[], txns: CardTxn[], limit = 5): UseFor[] {
  const known = held.filter((h) => h.product);
  if (known.length < 2) return [];
  const groups = new Map<string, CardTxn[]>();
  for (const t of txns) {
    if (readTxn(t).skip || !readTxn(t).cardAble) continue;
    const label = displayLabel(t);
    groups.set(label, [...(groups.get(label) ?? []), t]);
  }
  return [...groups.entries()]
    .map(([label, list]) => ({
      label,
      list,
      spend: sum(list, (t) => t.amount),
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, limit)
    .map(({ label, list, spend }) => {
      const read = readTxn({ ...list[0], channel: "card" });
      const ranked = known
        .map((h) => ({ h, r: rateFor(h.product!, read, "card") }))
        .sort((a, b) => b.r.rate - a.r.rate);
      const [best, second] = ranked;
      return {
        label,
        spend: round(spend),
        cardId: best.h.id,
        rate: best.r.rate,
        why: best.r.label,
        runnerUp: second ? { cardId: second.h.id, rate: second.r.rate } : null,
      };
    })
    .filter((u) => u.rate > 0);
}

// ── A tip on the spend alert: "next time here, use this card" ──────────────

export interface SpendTip {
  /** The card that pays most here. */
  cardId: string;
  rate: number;
  why: string;
  /** Monthly cap on that rate, when there is one. */
  capMonthly: number | null;
  /** What the spend was paid with: a held card, or UPI. */
  paidWith: string | "upi";
  paidRate: number;
  /** Rupees more this spend would have earned on the better card. */
  extra: number;
}

/** A tip is worth a line only when it's this many rupees… */
export const TIP_MIN_RS = 10;
/** …and this many points of value % better. */
export const TIP_MIN_POINTS = 1;

/**
 * The better card to use next time at the place this spend was made, or null
 * when there is nothing worth saying. Needs two known cards; a UPI spend
 * counts only at an online brand that takes cards too, and only when no card
 * of yours works on UPI (then we can't know it wasn't already a card).
 */
export function spendTip(held: HeldCard[], txn: CardTxn): SpendTip | null {
  const known = held.filter((h) => h.product);
  if (known.length < 2) return null;
  const read = readTxn(txn);
  if (read.skip || !read.cardAble) return null;

  let paidWith: string;
  let paidRate: number;
  if (txn.channel === "card") {
    const used = known.find((h) => h.id === txn.cardId);
    if (!used) return null;
    paidWith = used.id;
    paidRate = rateFor(used.product!, read, "card").rate;
  } else if (txn.channel === "upi") {
    if (known.some((h) => h.product!.upi)) return null;
    paidWith = "upi";
    paidRate = 0;
  } else return null;

  const [best] = known
    .filter((h) => h.id !== paidWith)
    .map((h) => ({ h, r: rateFor(h.product!, read, "card") }))
    .sort((a, b) => b.r.rate - a.r.rate);
  if (!best) return null;
  const extra = ((best.r.rate - paidRate) * txn.amount) / 100;
  if (best.r.rate - paidRate < TIP_MIN_POINTS || extra < TIP_MIN_RS)
    return null;
  const rule = best.r.ruleIndex >= 0 ? best.h.product!.rules[best.r.ruleIndex] : null;
  const capMonthly =
    best.r.ruleIndex === BASE
      ? (best.h.product!.baseCapMonthly ?? null)
      : (rule?.capMonthly ?? null);
  return {
    cardId: best.h.id,
    rate: best.r.rate,
    why: best.r.label,
    capMonthly,
    paidWith,
    paidRate,
    extra: round(extra),
  };
}

// ── 2. The next card, ranked by what it adds ────────────────────────────────

export type Chance = "likely" | "stretch" | "unlikely";
export type ScoreBand =
  "750+" | "700-749" | "650-699" | "below-650" | "unknown";

export interface Eligibility {
  chance: Chance;
  reasons: string[];
}

export function eligibility(
  card: CardProduct,
  monthlyIncome: number | null,
  score: ScoreBand,
): Eligibility {
  const reasons: string[] = [];
  let level = 2; // 2 likely, 1 stretch, 0 unlikely
  if (score === "below-650") {
    return {
      chance: "unlikely",
      reasons: ["Banks rarely approve below a 650 score"],
    };
  }
  const min = card.minIncomeMonthly ?? null;
  if (monthlyIncome == null) {
    level = 1;
    reasons.push("Add your monthly income for a better estimate");
  } else if (min != null) {
    const ratio = monthlyIncome / min;
    if (ratio >= 1)
      reasons.push(`Your income meets the bank's ₹${fmt(min)}/month`);
    else if (ratio >= 0.75) {
      level = 1;
      reasons.push(
        `Bank asks for about ₹${fmt(min)}/month; you're a little under`,
      );
    } else {
      level = 0;
      reasons.push(`Bank asks for about ₹${fmt(min)}/month`);
    }
  }
  if (score === "650-699") {
    level = Math.max(0, level - 1);
    reasons.push("A 650–699 score lowers the odds");
  } else if (score === "unknown") {
    reasons.push("Score not given");
  }
  return {
    chance: (["unlikely", "stretch", "likely"] as const)[level],
    reasons,
  };
}

export interface NextCard {
  product: CardProduct;
  /** Net ₹ a year on top of your current cards, after the fee and GST. */
  netYearly: number;
  rewardsYearly: number;
  milestonesYearly: number;
  feeYearly: number;
  feeWaived: boolean;
  /** Spend this card would carry in a year. */
  spendYearly: number;
  /** Where it wins: "Swiggy ₹1,800/yr", top three. */
  wins: Array<{ label: string; valueYearly: number }>;
  eligibility: Eligibility;
}

/**
 * A big purchase seen once (a laptop, a phone) says nothing about next year:
 * projecting it ×4 would decide every ranking. Such spends count in what you
 * actually earned and missed, but not in yearly estimates.
 */
export const ONE_OFF_MIN = 20000;

/** Below this extra ₹ a year, "no new card needed" is the honest answer. */
export const MIN_GAIN_YEARLY = 500;

export function withoutOneOffs(txns: CardTxn[]): CardTxn[] {
  const seen = new Map<string, number>();
  for (const t of txns) {
    const k = normalizeMerchant(t.merchant) || (t.category ?? "");
    seen.set(k, (seen.get(k) ?? 0) + (t.amount >= ONE_OFF_MIN ? 1 : 0));
  }
  return txns.filter((t) => {
    if (t.amount < ONE_OFF_MIN) return true;
    const k = normalizeMerchant(t.merchant) || (t.category ?? "");
    return (seen.get(k) ?? 0) >= 2; // big and repeated (rent-like) stays
  });
}

export function nextCards(
  catalog: CardProduct[],
  held: HeldCard[],
  txns: CardTxn[],
  days: number,
  profile: { monthlyIncome: number | null; score: ScoreBand },
  limit = 3,
): NextCard[] {
  const heldKeys = new Set(
    held.map((h) => h.product?.key).filter(Boolean) as string[],
  );
  const slots: Slot[] = held
    .filter((h) => h.product)
    .map((h) => ({ id: h.id, product: h.product! }));
  const yearly = 365 / Math.max(days, 30);
  txns = withoutOneOffs(txns);
  const base = allocate(slots, txns);

  const out: NextCard[] = [];
  for (const product of catalog) {
    if (heldKeys.has(product.key)) continue;
    // Only cards a bank is issuing now, with rules we're reasonably sure of.
    if (
      (product.status ?? "active") !== "active" ||
      product.confidence === "low"
    )
      continue;
    const cand: Slot = { id: `new:${product.key}`, product };
    const alloc = allocate([...slots, cand], txns);
    const rewardsYearly = (alloc.total - base.total) * yearly;
    const spendYearly = (alloc.spendBySlot.get(cand.id) ?? 0) * yearly;
    if (spendYearly <= 0) continue;
    const milestonesYearly = sum(
      (product.milestones ?? []).filter((m) => spendYearly >= m.spendYearly),
      (m) => m.valueRs,
    );
    const feeWaived =
      product.feeWaiverSpend != null && spendYearly >= product.feeWaiverSpend;
    const feeYearly = feeWaived ? 0 : product.annualFee * GST;
    const netYearly = rewardsYearly + milestonesYearly - feeYearly;
    // A new card is a hard credit enquiry and one more bill: only worth it
    // for a real gain.
    if (netYearly < MIN_GAIN_YEARLY) continue;

    const wins = new Map<string, number>();
    for (const t of txns) {
      const a = alloc.byTxn.get(t.id);
      if (a?.slotId !== cand.id) continue;
      const before = base.byTxn.get(t.id)?.value ?? 0;
      const label = displayLabel(t);
      wins.set(label, (wins.get(label) ?? 0) + (a.value - before) * yearly);
    }
    out.push({
      product,
      netYearly: round(netYearly),
      rewardsYearly: round(rewardsYearly),
      milestonesYearly: round(milestonesYearly),
      feeYearly: round(feeYearly),
      feeWaived,
      spendYearly: round(spendYearly),
      wins: [...wins.entries()]
        .filter(([, v]) => v >= 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([label, v]) => ({ label, valueYearly: round(v) })),
      eligibility: eligibility(product, profile.monthlyIncome, profile.score),
    });
  }
  // Value first; a card you likely can't get drops below one you can.
  const order = { likely: 0, stretch: 0, unlikely: 1 };
  return out
    .sort(
      (a, b) =>
        order[a.eligibility.chance] - order[b.eligibility.chance] ||
        b.netYearly - a.netYearly,
    )
    .slice(0, limit);
}

// ── Card health: fee waiver, milestones and rule changes ────────────────────

export interface CardHealth {
  /** Spend on this card in the window, and the same pace over a year. */
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
  /** Rule changes from the last year and the ones still to come. */
  changes: Array<{
    date: string;
    change: string;
    upcoming: boolean;
    recent: boolean;
    affectsYou: boolean;
  }>;
}

const CHANGE_STOP = new Set([
  "other",
  "spends",
  "spend",
  "card",
  "cards",
  "online",
  "store",
  "india",
  "marketplace",
  "payment",
  "shopping",
]);

/** Days a change counts as "recent" for the wallet banner. */
export const RECENT_CHANGE_DAYS = 90;

/**
 * How a card you hold is doing: whether your pace of spending reaches the
 * fee waiver and the milestones, and what the bank changed lately. We don't
 * know the card's anniversary, so it's "at this pace, about ₹X a year".
 */
export function cardHealth(
  product: CardProduct,
  txns: CardTxn[],
  days: number,
  today: string,
  /** Where the user spends most, to flag the changes that touch them. */
  spendLabels: string[] = [],
): CardHealth {
  const counted = withoutOneOffs(txns).filter((t) => !readTxn(t).skip);
  const spend = sum(counted, (t) => t.amount);
  const yearlyPace = round((spend * 365) / Math.max(days, 30));
  const feeWaiver =
    product.annualFee > 0 && product.feeWaiverSpend
      ? {
          target: product.feeWaiverSpend,
          pace: yearlyPace,
          onTrack: yearlyPace >= product.feeWaiverSpend,
        }
      : null;
  const milestones = (product.milestones ?? [])
    .map((m) => ({
      label: m.label,
      target: m.spendYearly,
      valueRs: m.valueRs,
      pace: yearlyPace,
      onTrack: yearlyPace >= m.spendYearly,
    }))
    .sort((a, b) => a.target - b.target);
  const words = spendLabels
    .map((l) => normalizeMerchant(l))
    .flatMap((l) => l.split(" "))
    .filter((w) => w.length >= 4 && !CHANGE_STOP.has(w));
  const changes = (product.changes ?? [])
    .filter((c) => daysBetween(c.date, today) <= 365)
    .map((c) => {
      const age = daysBetween(c.date, today);
      const text = new Set(normalizeMerchant(c.change).split(" "));
      return {
        ...c,
        upcoming: age < 0,
        recent: age >= 0 && age <= RECENT_CHANGE_DAYS,
        affectsYou: words.some((w) => text.has(w)),
      };
    });
  return { spend: round(spend), yearlyPace, feeWaiver, milestones, changes };
}

// ── 3. Debt stress: when not to suggest any card ────────────────────────────

export interface StressSignal {
  kind: "late_fee" | "overdue" | "bounce" | "interest" | "min_due_only";
  date: string;
}

const AVOID =
  /\b(?:avoid|to avoid|else|otherwise|may be levied|will be levied|would be levied|if not paid|before the due)\b/i;

/**
 * Signs in the bank messages that more credit would hurt: a late fee or
 * interest actually charged, an EMI or mandate that bounced, an overdue
 * account, or a card bill settled with only the minimum due. Reminders
 * ("pay by the 5th to avoid late fees") are not signs.
 */
export function debtStress(
  messages: Array<{
    body: string;
    date: string;
    direction?: string | null;
    amount?: number | null;
  }>,
): StressSignal[] {
  const out: StressSignal[] = [];
  const statements: Array<{ date: string; total: number; min: number }> = [];
  for (const m of messages) {
    const b = m.body;
    if (!AVOID.test(b)) {
      if (
        /\blate (?:payment )?(?:fee|charges?)\b.{0,60}\b(?:levied|charged|debited|applied|posted)\b|\b(?:levied|charged|debited|applied|posted)\b.{0,60}\blate (?:payment )?(?:fee|charges?)\b/i.test(
          b,
        )
      )
        out.push({ kind: "late_fee", date: m.date });
      else if (
        /\b(?:is|are|now|account)\s+(?:over ?due|past due)\b|\bover ?due (?:amount|by|since)\b|\bpast due\b/i.test(
          b,
        )
      )
        out.push({ kind: "overdue", date: m.date });
      if (
        /\b(?:finance charges?|interest)\b.{0,40}\b(?:charged|levied|debited|of (?:rs|inr|₹))/i.test(
          b,
        ) &&
        /\bcard\b/i.test(b)
      )
        out.push({ kind: "interest", date: m.date });
    }
    if (
      /\b(?:bounced?|dishono(?:u)?red|returned|unpaid|failed)\b.{0,50}\b(?:emi|nach|ach|e-?mandate|mandate|auto ?debit|si)\b|\b(?:emi|nach|ach|e-?mandate|mandate|auto ?debit)\b.{0,50}\b(?:bounced?|dishono(?:u)?red|returned unpaid|failed due to insufficient)\b/i.test(
        b,
      )
    )
      out.push({ kind: "bounce", date: m.date });

    const total = b.match(
      /\btotal (?:amount |amt\.? )?due\D{0,15}([\d,]+(?:\.\d{1,2})?)/i,
    )?.[1];
    const min = b.match(
      /\bmin(?:imum|\.)? ?(?:amount |amt\.? )?due\D{0,15}([\d,]+(?:\.\d{1,2})?)/i,
    )?.[1];
    if (total && min)
      statements.push({ date: m.date, total: num(total), min: num(min) });
  }

  // A card payment equal to the minimum due, well short of the total.
  for (const s of statements) {
    if (s.min <= 0 || s.min >= s.total * 0.5) continue;
    const paid = messages.find(
      (m) =>
        m.date >= s.date &&
        daysBetween(s.date, m.date) <= 45 &&
        /\b(?:payment|paid)\b/i.test(m.body) &&
        /\bcard\b/i.test(m.body) &&
        m.amount != null &&
        Math.abs(m.amount - s.min) <= 1,
    );
    if (paid) out.push({ kind: "min_due_only", date: paid.date });
  }
  return dedupe(out);
}

export const STRESS_TEXT: Record<StressSignal["kind"], string> = {
  late_fee: "A late fee was charged",
  overdue: "A payment went overdue",
  bounce: "An EMI or auto-debit bounced",
  interest: "Interest was charged on a card bill",
  min_due_only: "A card bill was paid with only the minimum due",
};

// ── helpers ─────────────────────────────────────────────────────────────────

function displayLabel(t: CardTxn): string {
  const m = (t.merchant ?? "").trim();
  if (m) return m;
  return !t.category || t.category === "Uncategorized"
    ? "Other spends"
    : t.category;
}

function groupBy<T>(list: T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const t of list) {
    const k = key(t);
    const arr = out.get(k);
    if (arr) arr.push(t);
    else out.set(k, [t]);
  }
  return out;
}

function sum<T>(list: T[], f: (t: T) => number): number {
  return list.reduce((s, t) => s + f(t), 0);
}

function round(n: number): number {
  return Math.round(n);
}

function num(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

function dedupe(list: StressSignal[]): StressSignal[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = `${s.kind}|${s.date}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
