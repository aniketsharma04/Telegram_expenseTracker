import { SupabaseClient } from "@supabase/supabase-js";
import { classify } from "./ingest";
import { insertExpense } from "./log-expense";
import { logIncome } from "./income";

/**
 * "That wasn't spending, I received it" — and the other way round. One tap
 * moves an entry between expenses and incomes, keeping its amount, date,
 * account and the bank message it came from, so balances and the capture
 * history stay true. The safety net under the parser: whatever wording a
 * bank invents next, a wrong direction is one tap from right.
 */

export type FlipResult =
  | { status: "flipped"; expenseId: string | null; incomeId: string | null }
  | { status: "not_found" }
  | { status: "refused"; reason: string };

export async function flipExpenseToIncome(
  supabase: SupabaseClient,
  userId: number,
  expenseId: string,
): Promise<FlipResult> {
  const { data: rows, error } = await supabase
    .from("expenses")
    .select(
      "id, amount, merchant, expense_date, raw_message, source, account_id, split_id, logged_at",
    )
    .eq("id", expenseId)
    .eq("user_id", userId)
    .limit(1);
  if (error) throw error;
  const e = rows?.[0];
  if (!e) return { status: "not_found" };
  // A split is a shared bill, never money received.
  if (e.split_id)
    return { status: "refused", reason: "A split bill can't become income." };

  const { count: receipts } = await supabase
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .eq("expense_id", expenseId);
  if (receipts)
    return {
      status: "refused",
      reason: "This entry has a receipt attached, so it was a purchase.",
    };

  const income = await logIncome(supabase, userId, {
    amount: Number(e.amount),
    source: e.merchant,
    income_date: e.expense_date,
    raw_message: e.raw_message ?? "",
    channel: e.source ?? "app",
    account_id: e.account_id ?? null,
  });
  await supabase
    .from("bank_messages")
    .update({
      direction: "credit",
      income_id: income.id,
      expense_id: null,
      note: "You marked this as money received.",
    })
    .eq("user_id", userId)
    .eq("expense_id", expenseId);
  const { error: delError } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId)
    .eq("user_id", userId);
  if (delError) {
    // Never leave the money counted twice.
    await supabase.from("incomes").delete().eq("id", income.id);
    throw delError;
  }
  return { status: "flipped", expenseId: null, incomeId: income.id };
}

export async function flipIncomeToExpense(
  supabase: SupabaseClient,
  userId: number,
  incomeId: string,
): Promise<FlipResult> {
  const { data: rows, error } = await supabase
    .from("incomes")
    .select("id, amount, source, income_date, raw_message, channel, account_id")
    .eq("id", incomeId)
    .eq("user_id", userId)
    .limit(1);
  if (error) throw error;
  const i = rows?.[0];
  if (!i) return { status: "not_found" };

  const { category, merchant } = await classify(supabase, userId, i.source);
  const expense = await insertExpense(supabase, {
    amount: Number(i.amount),
    category,
    merchant,
    expense_date: i.income_date,
    user_id: userId,
    raw_message: i.raw_message ?? "",
    source: i.channel ?? "app",
    parsed_by: "rules",
    account_id: i.account_id ?? null,
  });
  await supabase
    .from("bank_messages")
    .update({
      direction: "debit",
      expense_id: expense.id,
      income_id: null,
      note: "You marked this as money spent.",
    })
    .eq("user_id", userId)
    .eq("income_id", incomeId);
  const { error: delError } = await supabase
    .from("incomes")
    .delete()
    .eq("id", incomeId)
    .eq("user_id", userId);
  if (delError) {
    await supabase.from("expenses").delete().eq("id", expense.id);
    throw delError;
  }
  return { status: "flipped", expenseId: expense.id, incomeId: null };
}

/** The newest auto-captured entry either way, for the bot's /flip. */
export async function lastCaptured(
  supabase: SupabaseClient,
  userId: number,
): Promise<{
  kind: "expense" | "income";
  id: string;
  amount: number;
  who: string | null;
} | null> {
  const [{ data: e }, { data: i }] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, amount, merchant, logged_at")
      .eq("user_id", userId)
      .like("source", "auto_%")
      .order("logged_at", { ascending: false })
      .limit(1),
    supabase
      .from("incomes")
      .select("id, amount, source, logged_at")
      .eq("user_id", userId)
      .like("channel", "auto_%")
      .order("logged_at", { ascending: false })
      .limit(1),
  ]);
  const ex = e?.[0];
  const inc = i?.[0];
  if (!ex && !inc) return null;
  if (ex && (!inc || ex.logged_at >= inc.logged_at))
    return {
      kind: "expense",
      id: ex.id,
      amount: Number(ex.amount),
      who: ex.merchant,
    };
  return {
    kind: "income",
    id: inc!.id,
    amount: Number(inc!.amount),
    who: inc!.source,
  };
}
