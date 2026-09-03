import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Itemised receipts (v10).
 *
 * The expense keeps the total; this keeps the bill behind it. The arithmetic
 * of "do these lines actually add up to what I paid?" is pure and tested,
 * because a plausible-looking breakdown that quietly disagrees with the total
 * is worse than no breakdown at all.
 */

export interface ReceiptItem {
  line_no: number;
  name: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number;
}

export interface ReceiptHeader {
  merchant: string | null;
  bill_number: string | null;
  bill_date: string | null;
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  tip: number | null;
  total: number | null;
  currency: string;
}

export interface Receipt extends ReceiptHeader {
  expense_id: string;
  items: ReceiptItem[];
  items_total: number | null;
  /** True when the lines plus tax/tip/discount land on the total. */
  reconciled: boolean;
  source: string | null;
}

/** Rupee-level tolerance: printed bills round, and so do we. */
const TOLERANCE = 1;

const clean = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

/** Pure: tidy one parsed line, or drop it if it isn't a real line. */
export function normaliseItem(
  raw: {
    name?: unknown;
    quantity?: unknown;
    unit_price?: unknown;
    amount?: unknown;
  },
  lineNo: number,
): ReceiptItem | null {
  const name =
    typeof raw.name === "string" ? raw.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 120) return null;

  const amount = clean(raw.amount);
  const quantity = clean(raw.quantity);
  const unitPrice = clean(raw.unit_price);

  // A line needs a money value. If only a unit price and quantity came
  // through, the line total is derivable; otherwise the line is unusable.
  const resolved =
    amount ??
    (unitPrice !== null && quantity !== null
      ? Math.round(unitPrice * quantity * 100) / 100
      : null);
  if (resolved === null || resolved < 0) return null;

  return {
    line_no: lineNo,
    name: name.slice(0, 120),
    quantity,
    unit_price: unitPrice,
    amount: resolved,
  };
}

export function itemsTotal(items: ReceiptItem[]): number {
  return Math.round(items.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
}

/**
 * Pure: do the lines explain the total?
 *
 * Tries the two shapes real bills come in — lines that already include tax,
 * and lines that don't — and accepts either. Returns false when neither
 * reaches the total, which is the app's cue to show the breakdown as partial.
 */
export function reconciles(
  items: ReceiptItem[],
  header: Pick<
    ReceiptHeader,
    "subtotal" | "tax" | "discount" | "tip" | "total"
  >,
): boolean {
  if (!items.length || header.total == null) return false;
  const lines = itemsTotal(items);
  const tax = header.tax ?? 0;
  const tip = header.tip ?? 0;
  const discount = header.discount ?? 0;

  const candidates = [
    lines, // lines already include everything
    lines + tax + tip - discount, // lines are pre-tax
  ];
  if (header.subtotal != null) {
    candidates.push(header.subtotal + tax + tip - discount);
  }
  return candidates.some((c) => Math.abs(c - header.total!) <= TOLERANCE);
}

/**
 * Persist a parsed bill against an expense. Best-effort by design: a receipt
 * that fails to save must never cost the user the expense itself, which is
 * already written by the time this runs.
 */
export async function saveReceipt(
  supabase: SupabaseClient,
  userId: number,
  expenseId: string,
  header: ReceiptHeader,
  items: ReceiptItem[],
  source: string,
): Promise<boolean> {
  const total = itemsTotal(items);
  try {
    const { error } = await supabase.from("receipts").upsert(
      {
        expense_id: expenseId,
        user_id: userId,
        merchant: header.merchant,
        bill_number: header.bill_number,
        bill_date: header.bill_date,
        subtotal: header.subtotal,
        tax: header.tax,
        discount: header.discount,
        tip: header.tip,
        total: header.total,
        currency: header.currency || "INR",
        items_total: items.length ? total : null,
        reconciled: reconciles(items, header),
        source,
      },
      { onConflict: "expense_id" },
    );
    if (error) throw error;

    if (items.length) {
      // Re-reading the same photo replaces the lines rather than doubling them.
      await supabase.from("receipt_items").delete().eq("expense_id", expenseId);
      const { error: itemError } = await supabase.from("receipt_items").insert(
        items.map((i) => ({
          expense_id: expenseId,
          user_id: userId,
          line_no: i.line_no,
          name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          amount: i.amount,
        })),
      );
      if (itemError) throw itemError;
    }
    return true;
  } catch (err) {
    console.error("saveReceipt failed (v10 migration applied?)", err);
    return false;
  }
}

/** The bill behind one expense, or null when there isn't one. */
export async function getReceipt(
  supabase: SupabaseClient,
  userId: number,
  expenseId: string,
): Promise<Receipt | null> {
  try {
    const { data, error } = await supabase
      .from("receipts")
      .select(
        "expense_id, merchant, bill_number, bill_date, subtotal, tax, discount, tip, total, currency, items_total, reconciled, source",
      )
      .eq("expense_id", expenseId)
      .eq("user_id", userId)
      .limit(1);
    if (error) throw error;
    const header = data?.[0];
    if (!header) return null;

    const { data: rows, error: itemError } = await supabase
      .from("receipt_items")
      .select("line_no, name, quantity, unit_price, amount")
      .eq("expense_id", expenseId)
      .eq("user_id", userId)
      .order("line_no", { ascending: true });
    if (itemError) throw itemError;

    return {
      ...(header as unknown as Omit<Receipt, "items">),
      items: ((rows ?? []) as ReceiptItem[]).map((r) => ({
        ...r,
        amount: Number(r.amount),
        quantity: r.quantity == null ? null : Number(r.quantity),
        unit_price: r.unit_price == null ? null : Number(r.unit_price),
      })),
    };
  } catch (err) {
    console.error("getReceipt failed (v10 migration applied?)", err);
    return null;
  }
}

/**
 * What the user actually orders, across every bill — the payoff for storing
 * lines rather than totals. Grouped case-insensitively by item name.
 */
export async function topItems(
  supabase: SupabaseClient,
  userId: number,
  sinceDate: string,
  limit = 15,
): Promise<Array<{ name: string; times: number; total: number }>> {
  try {
    const { data, error } = await supabase
      .from("receipt_items")
      .select("name, amount, expenses!inner(expense_date)")
      .eq("user_id", userId)
      .gte("expenses.expense_date", sinceDate);
    if (error) throw error;

    const totals = new Map<
      string,
      { name: string; times: number; total: number }
    >();
    for (const row of (data ?? []) as Array<{ name: string; amount: number }>) {
      const key = row.name.toLowerCase();
      const entry = totals.get(key) ?? { name: row.name, times: 0, total: 0 };
      entry.times += 1;
      entry.total = Math.round((entry.total + Number(row.amount)) * 100) / 100;
      totals.set(key, entry);
    }
    return [...totals.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  } catch (err) {
    console.error("topItems failed (v10 migration applied?)", err);
    return [];
  }
}

/**
 * Bridge from a vision parse to stored rows. Keeps the "which fields does the
 * model return" knowledge in one place so both photo paths stay identical.
 */
export async function saveParsedReceipt(
  supabase: SupabaseClient,
  userId: number,
  expenseId: string,
  parsed: {
    merchant: string | null;
    amount: number | null;
    expense_date: string | null;
    items?: Array<{
      name?: unknown;
      quantity?: unknown;
      unit_price?: unknown;
      amount?: unknown;
    }>;
    subtotal?: number | null;
    tax?: number | null;
    discount?: number | null;
    tip?: number | null;
    bill_number?: string | null;
  },
  source: string,
): Promise<{ items: number; reconciled: boolean }> {
  const items = (parsed.items ?? [])
    .map((raw, index) => normaliseItem(raw, index + 1))
    .filter((i): i is ReceiptItem => i !== null)
    .map((item, index) => ({ ...item, line_no: index + 1 }));

  const header: ReceiptHeader = {
    merchant: parsed.merchant,
    bill_number: parsed.bill_number ?? null,
    bill_date: parsed.expense_date,
    subtotal: parsed.subtotal ?? null,
    tax: parsed.tax ?? null,
    discount: parsed.discount ?? null,
    tip: parsed.tip ?? null,
    total: parsed.amount,
    currency: "INR",
  };

  // Nothing worth storing: no lines and no breakdown beyond the total the
  // expense already holds.
  const hasBreakdown =
    items.length > 0 ||
    header.subtotal != null ||
    header.tax != null ||
    header.tip != null ||
    header.discount != null;
  if (!hasBreakdown) return { items: 0, reconciled: false };

  await saveReceipt(supabase, userId, expenseId, header, items, source);
  return { items: items.length, reconciled: reconciles(items, header) };
}
