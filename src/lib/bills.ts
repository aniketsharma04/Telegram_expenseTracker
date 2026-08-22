import { SupabaseClient } from "@supabase/supabase-js";
import { addDays, daysBetween } from "./insights";
import { insertExpense } from "./log-expense";

/**
 * Bills module (Phase A): user-registered recurring bills with due-day
 * tracking, UPI "pay now" links, and mark-paid → expense. Designed so a BBPS
 * live-fetch (Phase C) can later overwrite `amount` per cycle without UI changes.
 */

export const BILL_KINDS = [
  "electricity",
  "water",
  "gas",
  "credit_card",
  "rent",
  "internet",
  "mobile",
  "insurance",
  "other",
] as const;
export type BillKind = (typeof BILL_KINDS)[number];

/** Default expense category per bill type (user can override per bill). */
export const KIND_CATEGORY: Record<BillKind, string> = {
  electricity: "Utilities & bills",
  water: "Utilities & bills",
  gas: "Utilities & bills",
  credit_card: "Loans & EMI",
  rent: "Utilities & bills",
  internet: "Utilities & bills",
  mobile: "Utilities & bills",
  insurance: "Utilities & bills",
  other: "Utilities & bills",
};

export interface Bill {
  id: string;
  user_id: number;
  name: string;
  kind: BillKind;
  category: string;
  due_day: number;
  amount: number | null;
  upi_id: string | null;
  payee_name: string | null;
  consumer_number: string | null;
  biller_id: string | null;
  active: boolean;
}

export interface BillPayment {
  id: string;
  bill_id: string;
  month: string;
  amount: number;
  paid_on: string;
  expense_id: string | null;
}

export interface BillStatus extends Bill {
  cycleMonth: string; // YYYY-MM of the next unpaid cycle
  dueDate: string; // YYYY-MM-DD
  daysUntil: number; // negative = overdue
  paidThisMonth: BillPayment | null; // payment for the *current* calendar month, if any
  lastPaid: BillPayment | null;
  upiLink: string | null;
}

const BILL_COLUMNS =
  "id, user_id, name, kind, category, due_day, amount, upi_id, payee_name, consumer_number, biller_id, active";

export function monthAdd(month: string, delta: number): string {
  let [y, m] = month.split("-").map(Number);
  m += delta;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** Due date for a bill within a billing month, clamping day 31 → 30/28 etc. */
export function dueDateFor(month: string, dueDay: number): string {
  const day = Math.min(dueDay, daysInMonth(month));
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** Android UPI intent link — every installed UPI app can handle it. */
export function upiLink(
  bill: Pick<Bill, "upi_id" | "payee_name" | "name">,
  amount: number | null,
): string | null {
  if (!bill.upi_id) return null;
  const params = new URLSearchParams({
    pa: bill.upi_id,
    pn: bill.payee_name || bill.name,
    cu: "INR",
    tn: `${bill.name} bill`,
  });
  if (amount && amount > 0) params.set("am", amount.toFixed(2));
  return `upi://pay?${params.toString()}`;
}

/**
 * Pure: compute each active bill's next unpaid cycle relative to `today`.
 * If this month's cycle is paid, roll to next month. Sorted soonest-first.
 */
export function billStatuses(
  bills: Bill[],
  payments: BillPayment[],
  today: string,
): BillStatus[] {
  const thisMonth = today.slice(0, 7);
  const byBill = new Map<string, BillPayment[]>();
  for (const p of payments) {
    const list = byBill.get(p.bill_id);
    if (list) list.push(p);
    else byBill.set(p.bill_id, [p]);
  }

  const out: BillStatus[] = [];
  for (const b of bills) {
    if (!b.active) continue;
    const mine = byBill.get(b.id) ?? [];
    const paidThisMonth = mine.find((p) => p.month === thisMonth) ?? null;
    let cycleMonth = thisMonth;
    if (paidThisMonth) cycleMonth = monthAdd(thisMonth, 1);
    // A bill due early in the month that's already paid for *that* cycle: skip again.
    while (mine.some((p) => p.month === cycleMonth))
      cycleMonth = monthAdd(cycleMonth, 1);

    const dueDate = dueDateFor(cycleMonth, b.due_day);
    const lastPaid =
      [...mine].sort((a, c) => (a.paid_on < c.paid_on ? 1 : -1))[0] ?? null;
    out.push({
      ...b,
      amount: b.amount === null ? null : Number(b.amount),
      cycleMonth,
      dueDate,
      daysUntil: daysBetween(today, dueDate),
      paidThisMonth,
      lastPaid,
      upiLink: upiLink(b, b.amount === null ? null : Number(b.amount)),
    });
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

// ── DB ──────────────────────────────────────────────────────────────────────

export async function getBills(
  supabase: SupabaseClient,
  userId: number,
): Promise<Bill[]> {
  try {
    const { data, error } = await supabase
      .from("bills")
      .select(BILL_COLUMNS)
      .eq("user_id", userId)
      .eq("active", true)
      .order("due_day");
    if (error) throw error;
    return (data ?? []) as Bill[];
  } catch (err) {
    console.error("getBills failed (v5 migration applied?)", err);
    return [];
  }
}

export async function getBillPayments(
  supabase: SupabaseClient,
  userId: number,
  fromMonth: string,
): Promise<BillPayment[]> {
  try {
    const { data, error } = await supabase
      .from("bill_payments")
      .select("id, bill_id, month, amount, paid_on, expense_id")
      .eq("user_id", userId)
      .gte("month", fromMonth);
    if (error) throw error;
    return (data ?? []).map((p) => ({
      ...p,
      amount: Number(p.amount),
    })) as BillPayment[];
  } catch (err) {
    console.error("getBillPayments failed (v5 migration applied?)", err);
    return [];
  }
}

/** Everything the app/bot need in one call: statuses for the user's bills. */
export async function loadBillStatuses(
  supabase: SupabaseClient,
  userId: number,
  today: string,
): Promise<BillStatus[]> {
  const [bills, payments] = await Promise.all([
    getBills(supabase, userId),
    getBillPayments(supabase, userId, monthAdd(today.slice(0, 7), -2)),
  ]);
  return billStatuses(bills, payments, today);
}

export interface BillInput {
  name: string;
  kind: BillKind;
  category: string;
  due_day: number;
  amount: number | null;
  upi_id: string | null;
  payee_name: string | null;
  consumer_number: string | null;
}

export async function createBill(
  supabase: SupabaseClient,
  userId: number,
  input: BillInput,
): Promise<Bill> {
  const { data, error } = await supabase
    .from("bills")
    .insert({ user_id: userId, ...input })
    .select(BILL_COLUMNS)
    .single();
  if (error) throw error;
  return data as Bill;
}

export async function updateBill(
  supabase: SupabaseClient,
  userId: number,
  id: string,
  patch: Partial<BillInput>,
): Promise<Bill | null> {
  const { data, error } = await supabase
    .from("bills")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select(BILL_COLUMNS)
    .limit(1);
  if (error) throw error;
  return (data?.[0] as Bill) ?? null;
}

/** Soft-delete so payment history (and linked expenses) stay intact. */
export async function removeBill(
  supabase: SupabaseClient,
  userId: number,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("bills")
    .update({ active: false })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Mark a bill paid for a cycle: logs the expense (so totals/budgets see it)
 * and records the payment. Re-marking the same cycle updates in place.
 */
export async function markBillPaid(
  supabase: SupabaseClient,
  userId: number,
  billId: string,
  amount: number,
  paidOn: string,
  source: string,
): Promise<{ bill: Bill; payment: BillPayment; expenseId: string }> {
  const { data: rows, error } = await supabase
    .from("bills")
    .select(BILL_COLUMNS)
    .eq("id", billId)
    .eq("user_id", userId)
    .limit(1);
  if (error) throw error;
  const bill = rows?.[0] as Bill | undefined;
  if (!bill) throw new Error("bill not found");

  const month = paidOn.slice(0, 7);

  // Already paid this cycle? Replace the old expense so nothing double-counts.
  const { data: existing } = await supabase
    .from("bill_payments")
    .select("id, expense_id")
    .eq("bill_id", billId)
    .eq("month", month)
    .limit(1);
  const prior = existing?.[0] as
    { id: string; expense_id: string | null } | undefined;
  if (prior?.expense_id) {
    await supabase
      .from("expenses")
      .delete()
      .eq("id", prior.expense_id)
      .eq("user_id", userId);
  }

  const expense = await insertExpense(supabase, {
    amount,
    category: bill.category,
    merchant: bill.name,
    expense_date: paidOn,
    user_id: userId,
    raw_message: `[bill] ${bill.name} ${amount}`,
    source,
    parsed_by: "user",
  });

  const { data: payment, error: payError } = await supabase
    .from("bill_payments")
    .upsert(
      {
        bill_id: billId,
        user_id: userId,
        month,
        amount,
        paid_on: paidOn,
        expense_id: expense.id,
      },
      { onConflict: "bill_id,month" },
    )
    .select("id, bill_id, month, amount, paid_on, expense_id")
    .single();
  if (payError) throw payError;

  return {
    bill,
    payment: { ...payment, amount: Number(payment.amount) } as BillPayment,
    expenseId: expense.id,
  };
}

/** Undo a mark-paid: removes the payment and its linked expense. */
export async function unmarkBillPaid(
  supabase: SupabaseClient,
  userId: number,
  paymentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("bill_payments")
    .delete()
    .eq("id", paymentId)
    .eq("user_id", userId)
    .select("expense_id");
  if (error) throw error;
  const row = data?.[0] as { expense_id: string | null } | undefined;
  if (!row) return false;
  if (row.expense_id) {
    await supabase
      .from("expenses")
      .delete()
      .eq("id", row.expense_id)
      .eq("user_id", userId);
  }
  return true;
}

/** Reminder copy for the daily cron (plain text; caller escapes for HTML). */
export function reminderText(s: BillStatus): string | null {
  const amt = s.amount
    ? ` (~₹${Math.round(s.amount).toLocaleString("en-IN")})`
    : "";
  const day = Number(s.dueDate.slice(8));
  if (s.daysUntil === 3)
    return `🧾 ${s.name}${amt} is due in 3 days (the ${day}th). Open the app → Bills → Pay now.`;
  if (s.daysUntil === 0)
    return `🧾 ${s.name}${amt} is due today. Open the app → Bills → Pay now.`;
  if (s.daysUntil === -2)
    return `⏰ ${s.name}${amt} is 2 days overdue — pay it to avoid late fees.`;
  return null;
}

export { addDays };
