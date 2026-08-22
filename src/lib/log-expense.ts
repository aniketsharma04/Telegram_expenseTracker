import { SupabaseClient } from "@supabase/supabase-js";
import { parseExpense, localDate, CategoryRule } from "./parser";
import { parseWithLLM } from "./llm";

/**
 * Channel-agnostic expense logging pipeline: rules fast path → LLM fallback.
 * Used by the Telegram webhook and the mobile/web app API — each channel only
 * formats the result for its own medium.
 */

export interface LoggedExpense {
  id: string;
  amount: number;
  category: string;
  merchant: string | null;
  expense_date: string;
}

export type LogResult =
  | {
      status: "logged";
      expense: LoggedExpense;
      parsed_by: "rules" | "llm";
      /** Category was a low-confidence guess — channel should nudge the user to confirm. */
      nudge: boolean;
    }
  | {
      status: "need_amount";
      /** LLM's clarifying question when it produced one, else null. */
      question: string | null;
    };

export async function loadCategories(
  supabase: SupabaseClient,
): Promise<CategoryRule[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("name, keywords");
  if (error) throw error;
  return (data ?? []) as CategoryRule[];
}

export async function insertExpense(
  supabase: SupabaseClient,
  row: {
    amount: number;
    category: string;
    merchant: string | null;
    user_id: number;
    raw_message: string;
    source: string;
    parsed_by: string;
    expense_date: string;
    paid_by?: number;
    split_id?: string;
  },
): Promise<LoggedExpense> {
  const { data, error } = await supabase
    .from("expenses")
    .insert(row)
    .select("id, amount, category, merchant, expense_date")
    .single();
  if (error) throw error;
  return data as LoggedExpense;
}

/**
 * Equal split among family members (payer included): one expense row per
 * member for their share, grouped by split_id, with paid_by = the payer.
 * Rounding drift lands on the payer so shares always sum to the total.
 */
export async function logSplitExpense(
  supabase: SupabaseClient,
  payerId: number,
  memberIds: number[],
  entry: {
    amount: number;
    category: string;
    merchant: string | null;
    expense_date: string;
    raw_message: string;
    source: string;
    parsed_by: string;
  },
): Promise<{ payerShare: LoggedExpense; perHead: number; count: number }> {
  const ids = [...new Set([payerId, ...memberIds])];
  const split_id = crypto.randomUUID();
  const perHead = Math.floor((entry.amount / ids.length) * 100) / 100;
  const payerShare =
    Math.round((entry.amount - perHead * (ids.length - 1)) * 100) / 100;

  let payerRow: LoggedExpense | null = null;
  for (const memberId of ids) {
    const row = await insertExpense(supabase, {
      ...entry,
      amount: memberId === payerId ? payerShare : perHead,
      user_id: memberId,
      paid_by: payerId,
      split_id,
    });
    if (memberId === payerId) payerRow = row;
  }
  return { payerShare: payerRow!, perHead, count: ids.length };
}

/**
 * Delete an expense the caller owns. If it's their own share of a split they
 * paid for, the whole split group goes (their money, their entry). Returns
 * the number of rows removed.
 */
export async function deleteExpenseScoped(
  supabase: SupabaseClient,
  userId: number,
  id: string,
): Promise<number> {
  const { data: rows, error: findError } = await supabase
    .from("expenses")
    .select("id, user_id, paid_by, split_id")
    .eq("id", id)
    .limit(1);
  let row = rows?.[0] as
    | { id: string; user_id: number | null; paid_by?: number | null; split_id?: string | null }
    | undefined;
  if (findError) {
    // Pre-migration schema (no split columns): fall back to a plain scoped delete.
    console.error("split-aware lookup failed, falling back", findError);
    row = { id, user_id: userId };
  }
  if (!row || row.user_id !== userId) return 0;

  if (row.split_id && row.paid_by === userId) {
    const { data, error } = await supabase
      .from("expenses")
      .delete()
      .eq("split_id", row.split_id)
      .select("id");
    if (error) throw error;
    return data?.length ?? 0;
  }

  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** Add a merchant keyword to a category so the rules parser catches it next time. */
export async function learnKeyword(
  supabase: SupabaseClient,
  categories: CategoryRule[],
  categoryName: string,
  merchant: string,
) {
  const keyword = merchant.toLowerCase().trim();
  if (keyword.length < 3 || keyword.length > 30 || /^\d+$/.test(keyword))
    return;

  const category = categories.find((c) => c.name === categoryName);
  if (!category) return;

  // Skip if any category already knows this keyword.
  const known = categories.some((c) =>
    c.keywords.some((k) => k.toLowerCase() === keyword),
  );
  if (known) return;

  const { error } = await supabase
    .from("categories")
    .update({ keywords: [...category.keywords, keyword] })
    .eq("name", categoryName);
  if (error) console.error("keyword learn failed", error);
  else console.log(`learned keyword "${keyword}" → ${categoryName}`);
}

/** Free-text pipeline: rules fast path → LLM fallback → ask for the amount. */
export async function logExpenseFromText(
  supabase: SupabaseClient,
  userId: number,
  text: string,
  source: string,
): Promise<LogResult> {
  const categories = await loadCategories(supabase);
  const parsed = parseExpense(text, categories);

  // Fast path: rules found both an amount and a category.
  if (parsed.ok && parsed.category) {
    const expense = await insertExpense(supabase, {
      amount: parsed.amount!,
      category: parsed.category,
      merchant: parsed.merchant,
      expense_date: parsed.expenseDate,
      user_id: userId,
      raw_message: text,
      source,
      parsed_by: "rules",
    });
    return { status: "logged", expense, parsed_by: "rules", nudge: false };
  }

  // Fallback: let the LLM take a shot at anything messier.
  const llm = await parseWithLLM(text, categories, localDate());
  if (llm) {
    if (llm.amount && llm.amount > 0) {
      const expense = await insertExpense(supabase, {
        amount: llm.amount,
        category: llm.category ?? "Uncategorized",
        merchant: llm.merchant,
        expense_date: llm.expense_date ?? parsed.expenseDate,
        user_id: userId,
        raw_message: text,
        source,
        parsed_by: "llm",
      });

      // Self-improving keyword table: confident categorizations teach the fast path.
      if (llm.confidence === "high" && llm.category && llm.merchant) {
        await learnKeyword(supabase, categories, llm.category, llm.merchant);
      }

      return {
        status: "logged",
        expense,
        parsed_by: "llm",
        nudge: llm.confidence === "low" || !llm.category,
      };
    }

    // LLM ran but found no amount → ask instead of guessing.
    return { status: "need_amount", question: llm.clarifying_question };
  }

  // No LLM configured (or it errored): fall back to v1 behavior.
  if (parsed.ok) {
    const expense = await insertExpense(supabase, {
      amount: parsed.amount!,
      category: "Uncategorized",
      merchant: parsed.merchant,
      expense_date: parsed.expenseDate,
      user_id: userId,
      raw_message: text,
      source,
      parsed_by: "rules",
    });
    return { status: "logged", expense, parsed_by: "rules", nudge: false };
  }

  return { status: "need_amount", question: null };
}
