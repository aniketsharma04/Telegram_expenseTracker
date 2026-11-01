import type { SupabaseClient } from "@supabase/supabase-js";
import { localDate } from "../parser";
import { CATALOG, CATALOG_VERIFIED, productByKey } from "./catalog";
import {
  cardOf,
  detectCards,
  isCreditCardMessage,
  type DetectedCard,
} from "./detect";
import {
  actualEarnings,
  cardHealth,
  debtStress,
  missedRewards,
  nextCards,
  STRESS_TEXT,
  useFor,
  type UseFor,
  type CardHealth,
  type MissedReport,
  type NextCard,
  type ScoreBand,
} from "./engine";
import type { CardProduct, CardTxn, HeldCard } from "./types";

/**
 * Aaj Cards, server side: load the user's spends, bank messages and cards,
 * run the engine, and shape what the app shows. Reads only the user's own
 * rows; nothing leaves Aaj — the bank links are plain links.
 */

const LOOKBACK_DAYS = 180;

export interface UserCardRow {
  id: string;
  bank: string;
  last4: string | null;
  product_key: string | null;
  added_by: "detected" | "manual";
  hidden: boolean;
}

export interface CardProfile {
  score_band: ScoreBand;
  monthly_income: number | null;
  stress_cleared_at: string | null;
}

/** A catalogue card, trimmed for the app. */
export function productView(p: CardProduct) {
  return {
    key: p.key,
    bank: p.bank,
    name: p.name,
    networks: p.networks,
    upi: p.upi,
    annualFee: p.annualFee,
    joiningFee: p.joiningFee,
    feeWaiverSpend: p.feeWaiverSpend,
    baseRate: p.baseRate,
    rules: p.rules.map((r) => ({
      label: r.label,
      rate: r.rate,
      capMonthly: r.capMonthly ?? null,
    })),
    loungeDomesticYear: p.loungeDomesticYear ?? null,
    loungeIntlYear: p.loungeIntlYear ?? null,
    forexMarkup: p.forexMarkup ?? null,
    minIncomeMonthly: p.minIncomeMonthly ?? null,
    url: p.url ?? null,
    verified: p.verified,
    confidence: p.confidence,
    pitch: p.pitch ?? null,
    milestones: p.milestones ?? [],
    changes: p.changes ?? [],
  };
}
export type ProductView = ReturnType<typeof productView>;

export interface CardsView {
  days: number;
  catalogVerified: string;
  cards: Array<{
    id: string;
    bank: string;
    last4: string | null;
    product: ProductView | null;
    spendInWindow: number;
    earned: number;
    /** Fee waiver, milestones and rule changes; null until the product is known. */
    health: CardHealth | null;
  }>;
  /** Rule changes on cards you hold: recent ones and the ones still to come. */
  alerts: Array<{
    cardId: string;
    date: string;
    change: string;
    upcoming: boolean;
    affectsYou: boolean;
  }>;
  /** Cards seen in bank messages that the user hasn't confirmed yet. */
  suggestions: Array<DetectedCard & { product: ProductView | null }>;
  missed: MissedReport;
  /** The best card you hold for each place you spend most. */
  useFor: UseFor[];
  next: Array<Omit<NextCard, "product"> & { product: ProductView }>;
  /** When non-empty, the app shows no new-card suggestions at all. */
  stress: Array<{ kind: string; text: string; date: string }>;
  profile: CardProfile & { estimatedIncome: number | null };
  catalog: Array<{ key: string; bank: string; name: string }>;
}

export async function loadCards(
  supabase: SupabaseClient,
  userId: number,
  today = localDate(),
): Promise<CardsView> {
  const since = shift(today, -LOOKBACK_DAYS);
  const [cardsRes, profileRes, expensesRes, messagesRes, incomesRes] =
    await Promise.all([
      supabase
        .from("user_cards")
        .select("id, bank, last4, product_key, added_by, hidden")
        .eq("user_id", userId),
      supabase
        .from("card_profiles")
        .select("score_band, monthly_income, stress_cleared_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("expenses")
        .select("id, amount, merchant, category, expense_date")
        .eq("user_id", userId)
        .gte("expense_date", since)
        .is("split_id", null),
      supabase
        .from("bank_messages")
        .select("id, body, received_at, expense_id, direction, amount, channel")
        .eq("user_id", userId)
        .gte("received_at", `${since}T00:00:00Z`)
        .order("received_at", { ascending: true }),
      supabase
        .from("incomes")
        .select("amount, source, income_date")
        .eq("user_id", userId)
        .gte("income_date", shift(today, -95)),
    ]);
  // Before the v20 migration the card tables don't exist: show detection only.
  const rows = (cardsRes.error ? [] : (cardsRes.data ?? [])) as UserCardRow[];
  const profile: CardProfile =
    profileRes.error || !profileRes.data
      ? { score_band: "unknown", monthly_income: null, stress_cleared_at: null }
      : {
          score_band: profileRes.data.score_band as ScoreBand,
          monthly_income:
            profileRes.data.monthly_income == null
              ? null
              : Number(profileRes.data.monthly_income),
          stress_cleared_at: profileRes.data.stress_cleared_at ?? null,
        };
  if (expensesRes.error) throw expensesRes.error;
  if (messagesRes.error) throw messagesRes.error;
  const expenses = expensesRes.data ?? [];
  const messages = messagesRes.data ?? [];

  const visible = rows.filter((r) => !r.hidden);
  const byBankLast4 = new Map(
    rows.filter((r) => r.last4).map((r) => [`${r.bank}|${r.last4}`, r]),
  );
  const held: HeldCard[] = visible.map((r) => ({
    id: r.id,
    bank: r.bank,
    last4: r.last4,
    product: productByKey(r.product_key),
  }));

  // Each spend, with how it was paid and on which card.
  const messageByExpense = new Map(
    messages
      .filter((m) => m.expense_id)
      .map((m) => [m.expense_id as string, m]),
  );
  const txns: CardTxn[] = expenses.map((e) => {
    const m = messageByExpense.get(e.id);
    const card = m ? cardOf(m.body) : null;
    const row = card
      ? byBankLast4.get(`${card.bank}|${card.last4}`)
      : undefined;
    return {
      id: e.id,
      amount: Number(e.amount),
      date: e.expense_date,
      merchant: e.merchant,
      category: e.category,
      // Only a credit-card alert is a card spend — a PhonePe gift card or a
      // debit card is money already spent from somewhere else.
      channel:
        card || (m && isCreditCardMessage(m.body))
          ? "card"
          : m?.channel === "upi"
            ? "upi"
            : "other",
      cardId: row && !row.hidden ? row.id : null,
    };
  });

  const first = expenses.reduce<string | null>(
    (min, e) => (min === null || e.expense_date < min ? e.expense_date : min),
    null,
  );
  const days = first ? Math.max(1, daysBetween(first, today) + 1) : 0;

  const estimatedIncome = salaryPerMonth(
    incomesRes.error ? [] : (incomesRes.data ?? []),
  );
  const monthlyIncome = profile.monthly_income ?? estimatedIncome;

  const cleared = profile.stress_cleared_at;
  const stress = debtStress(
    messages
      .filter((m) => !cleared || String(m.received_at) > cleared)
      .map((m) => ({
        body: m.body,
        date: String(m.received_at).slice(0, 10),
        amount: m.amount == null ? null : Number(m.amount),
      })),
  );
  const missed = missedRewards(held, txns, days);
  const earnedByTxn = actualEarnings(
    held,
    txns.filter((t) => t.cardId),
  );
  const next = stress.length
    ? []
    : nextCards(CATALOG, held, txns, days, {
        monthlyIncome,
        score: profile.score_band,
      });

  const suggestions = detectCards(messages)
    .filter((d) => !byBankLast4.has(`${d.bank}|${d.last4}`))
    .map((d) => {
      const p = productByKey(d.productGuess);
      return { ...d, product: p ? productView(p) : null };
    });

  // Where the user spends most, so a rule change that touches it stands out.
  const topLabels = [
    ...txns.reduce((m, t) => {
      const l = t.merchant?.trim() || t.category || "";
      if (l) m.set(l, (m.get(l) ?? 0) + t.amount);
      return m;
    }, new Map<string, number>()),
  ]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([l]) => l);

  const cards = held.map((h) => {
    const mine = txns.filter((t) => t.cardId === h.id);
    return {
      id: h.id,
      bank: h.bank,
      last4: h.last4,
      product: h.product ? productView(h.product) : null,
      spendInWindow: Math.round(mine.reduce((s, t) => s + t.amount, 0)),
      earned: Math.round(
        mine.reduce((s, t) => s + (earnedByTxn.get(t.id) ?? 0), 0),
      ),
      health: h.product
        ? cardHealth(h.product, mine, days, today, topLabels)
        : null,
    };
  });
  const alerts = cards
    .flatMap((c) =>
      (c.health?.changes ?? [])
        .filter((ch) => ch.upcoming || ch.recent)
        .map((ch) => ({
          cardId: c.id,
          date: ch.date,
          change: ch.change,
          upcoming: ch.upcoming,
          affectsYou: ch.affectsYou,
        })),
    )
    .sort(
      (a, b) =>
        Number(b.affectsYou) - Number(a.affectsYou) ||
        b.date.localeCompare(a.date),
    );

  return {
    days,
    catalogVerified: CATALOG_VERIFIED,
    cards,
    alerts,
    suggestions,
    missed,
    useFor: useFor(held, txns),
    next: next.map((n) => ({ ...n, product: productView(n.product) })),
    stress: stress.map((s) => ({ ...s, text: STRESS_TEXT[s.kind] })),
    profile: { ...profile, estimatedIncome },
    catalog: CATALOG.map((c) => ({ key: c.key, bank: c.bank, name: c.name })),
  };
}

// ── Changes from the app ────────────────────────────────────────────────────

const SCORE_BANDS = new Set([
  "750+",
  "700-749",
  "650-699",
  "below-650",
  "unknown",
]);

export type CardAction =
  | {
      action: "confirm";
      bank: string;
      last4: string;
      product_key: string | null;
    }
  | { action: "add"; bank: string; product_key: string }
  | { action: "set_product"; id: string; product_key: string | null }
  | { action: "hide"; id: string }
  | { action: "dismiss"; bank: string; last4: string }
  | { action: "remove"; id: string }
  | { action: "profile"; score_band?: string; monthly_income?: number | null }
  | { action: "clear_stress" }
  /** Delete every card and the card profile. Spends and messages stay. */
  | { action: "forget" };

export class CardInputError extends Error {}

function checkProduct(key: string | null | undefined): string | null {
  if (key == null || key === "") return null;
  if (!productByKey(key)) throw new CardInputError("unknown card");
  return key;
}

function checkLast4(v: unknown): string {
  if (typeof v !== "string" || !/^\d{4}$/.test(v))
    throw new CardInputError("last4 must be 4 digits");
  return v;
}

function checkBank(v: unknown): string {
  if (typeof v !== "string" || !v.trim() || v.length > 40)
    throw new CardInputError("bank is required");
  return v.trim();
}

export async function applyCardAction(
  supabase: SupabaseClient,
  userId: number,
  a: CardAction,
): Promise<void> {
  const now = new Date().toISOString();
  switch (a.action) {
    case "confirm":
    case "dismiss": {
      const row = {
        user_id: userId,
        bank: checkBank(a.bank),
        last4: checkLast4(a.last4),
        product_key:
          a.action === "confirm" ? checkProduct(a.product_key) : null,
        added_by: "detected",
        hidden: a.action === "dismiss",
        updated_at: now,
      };
      const { error } = await supabase
        .from("user_cards")
        .upsert(row, { onConflict: "user_id,bank,last4" });
      if (error) throw error;
      return;
    }
    case "add": {
      const product = checkProduct(a.product_key);
      if (!product) throw new CardInputError("pick a card");
      const { error } = await supabase.from("user_cards").insert({
        user_id: userId,
        bank: checkBank(a.bank),
        last4: null,
        product_key: product,
        added_by: "manual",
      });
      if (error) throw error;
      return;
    }
    case "set_product":
    case "hide":
    case "remove": {
      if (typeof a.id !== "string" || !a.id)
        throw new CardInputError("id is required");
      const q =
        a.action === "remove"
          ? supabase.from("user_cards").delete()
          : supabase.from("user_cards").update(
              a.action === "hide"
                ? { hidden: true, updated_at: now }
                : {
                    product_key: checkProduct(a.product_key),
                    updated_at: now,
                  },
            );
      const { error } = await q.eq("id", a.id).eq("user_id", userId);
      if (error) throw error;
      return;
    }
    case "profile": {
      const patch: Record<string, unknown> = {
        user_id: userId,
        updated_at: now,
      };
      if (a.score_band !== undefined) {
        if (!SCORE_BANDS.has(a.score_band))
          throw new CardInputError("unknown score band");
        patch.score_band = a.score_band;
      }
      if (a.monthly_income !== undefined) {
        const v = a.monthly_income;
        if (
          v !== null &&
          !(typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e8)
        )
          throw new CardInputError("monthly_income must be a positive number");
        patch.monthly_income = v;
      }
      const { error } = await supabase
        .from("card_profiles")
        .upsert(patch, { onConflict: "user_id" });
      if (error) throw error;
      return;
    }
    case "clear_stress": {
      const { error } = await supabase
        .from("card_profiles")
        .upsert(
          { user_id: userId, stress_cleared_at: now, updated_at: now },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      return;
    }
    case "forget": {
      const [cards, profile] = await Promise.all([
        supabase.from("user_cards").delete().eq("user_id", userId),
        supabase.from("card_profiles").delete().eq("user_id", userId),
      ]);
      if (cards.error) throw cards.error;
      if (profile.error) throw profile.error;
      return;
    }
    default:
      throw new CardInputError("unknown action");
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** Average monthly salary over the last three months, from credits named salary. */
export function salaryPerMonth(
  incomes: Array<{
    amount: number | string;
    source: string | null;
    income_date: string;
  }>,
): number | null {
  const salary = incomes.filter((i) =>
    /\b(?:salary|sal|payroll|wages)\b/i.test(i.source ?? ""),
  );
  if (!salary.length) return null;
  const months = new Set(salary.map((i) => i.income_date.slice(0, 7))).size;
  const total = salary.reduce((s, i) => s + Number(i.amount), 0);
  return Math.round(total / Math.max(1, months));
}

function shift(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );
}
