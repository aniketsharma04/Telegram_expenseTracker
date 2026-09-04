import { SupabaseClient } from "@supabase/supabase-js";
import { parseExpense, localDate, CategoryRule } from "./parser";
import { parseWithLLM } from "./llm";
import { listAccounts, resolveAccountId, type Account } from "./accounts";
import { createTransfer, detectTransferIntent } from "./transfers";
import { loadMerchantRules, normaliseMerchant } from "./merchants";
import { userGeminiKey } from "./ai-keys";

/**
 * Channel-agnostic expense logging pipeline: rules fast path → LLM fallback.
 * Used by the Telegram webhook and the mobile/web app API — each channel only
 * formats the result for its own medium.
 *
 * v8 adds two steps around the parse: a movement between the user's own
 * accounts is recorded as a transfer rather than spending, and merchant
 * names are collapsed onto their canonical form before the row is written.
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
    }
  | {
      /** Your own money moved between your own accounts — not spending. */
      status: "transferred";
      transfer: {
        id: string;
        amount: number;
        transfer_date: string;
        kind: "transfer" | "card_payment";
      };
      from: string | null;
      to: string | null;
      /** Why it was read as a movement, so the guess is never silent. */
      reason: string;
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
    /** Which pocket it came out of (v8). Null until the user sets accounts up. */
    account_id?: string | null;
  },
): Promise<LoggedExpense> {
  const { data, error } = await supabase
    .from("expenses")
    .insert(row)
    .select("id, amount, category, merchant, expense_date")
    .single();
  if (!error) return data as LoggedExpense;

  // Pre-v8 schema has no account_id — log the expense anyway rather than
  // failing the user's entry over a column that only affects balances.
  if (row.account_id !== undefined) {
    const { account_id: _dropped, ...legacy } = row;
    const retry = await supabase
      .from("expenses")
      .insert(legacy)
      .select("id, amount, category, merchant, expense_date")
      .single();
    if (!retry.error) return retry.data as LoggedExpense;
  }
  throw error;
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
    | {
        id: string;
        user_id: number | null;
        paid_by?: number | null;
        split_id?: string | null;
      }
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
  const [categories, accounts, merchantRules] = await Promise.all([
    loadCategories(supabase),
    listAccounts(supabase, userId),
    loadMerchantRules(supabase, userId),
  ]);
  const parsed = parseExpense(text, categories);

  // Movement before spending: "withdrew 5000 from atm" is not a ₹5,000
  // expense, and treating it as one is the classic tracker lie.
  if (parsed.ok && parsed.amount) {
    const moved = await recordMovement(
      supabase,
      userId,
      text,
      parsed.amount,
      parsed.expenseDate,
      accounts,
    );
    if (moved) return moved;
  }

  const accountId = await resolveAccountId(supabase, userId, null);
  const tidy = (raw: string | null) =>
    normaliseMerchant(raw, merchantRules)?.merchant ?? raw;

  // Fast path: rules found both an amount and a category.
  if (parsed.ok && parsed.category) {
    const expense = await insertExpense(supabase, {
      amount: parsed.amount!,
      category: parsed.category,
      merchant: tidy(parsed.merchant),
      expense_date: parsed.expenseDate,
      user_id: userId,
      raw_message: text,
      source,
      parsed_by: "rules",
      account_id: accountId,
    });
    return { status: "logged", expense, parsed_by: "rules", nudge: false };
  }

  // Fallback: let the LLM take a shot at anything messier.
  // v13: their own Gemini key when supplied, else the app's pool.
  const llm = await parseWithLLM(
    text,
    categories,
    localDate(),
    await userGeminiKey(supabase, userId),
  );
  if (llm) {
    if (llm.amount && llm.amount > 0) {
      // The rules parser may have missed the amount on a movement; now that
      // the LLM found one, re-check before writing it down as spending.
      const moved = await recordMovement(
        supabase,
        userId,
        text,
        llm.amount,
        llm.expense_date ?? parsed.expenseDate,
        accounts,
      );
      if (moved) return moved;

      const normalised = normaliseMerchant(llm.merchant, merchantRules);
      // A merchant rule's category is only a hint, and the rule table can
      // drift from the category list (different deployments, renamed
      // categories). An unknown hint would write an expense nothing can
      // filter on, so it has to match a real category to be used.
      const hinted = categories.some((c) => c.name === normalised?.category)
        ? normalised!.category
        : null;
      const expense = await insertExpense(supabase, {
        amount: llm.amount,
        category: llm.category ?? hinted ?? "Uncategorized",
        merchant: normalised?.merchant ?? llm.merchant,
        expense_date: llm.expense_date ?? parsed.expenseDate,
        user_id: userId,
        raw_message: text,
        source,
        parsed_by: "llm",
        account_id: accountId,
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
      merchant: tidy(parsed.merchant),
      expense_date: parsed.expenseDate,
      user_id: userId,
      raw_message: text,
      source,
      parsed_by: "rules",
      account_id: accountId,
    });
    return { status: "logged", expense, parsed_by: "rules", nudge: false };
  }

  return { status: "need_amount", question: null };
}

/**
 * Write a movement between the user's own accounts, when the text clearly
 * describes one. Returns null (and logs nothing) whenever it isn't sure —
 * a missed transfer is a tidy-up, a wrongly hidden expense is a lie.
 */
async function recordMovement(
  supabase: SupabaseClient,
  userId: number,
  text: string,
  amount: number,
  onDate: string,
  accounts: Account[],
): Promise<LogResult | null> {
  if (!accounts.length) return null;
  const intent = detectTransferIntent(text, accounts);
  if (!intent) return null;

  const name = (id: string | null) =>
    accounts.find((a) => a.id === id)?.name ?? null;

  try {
    const transfer = await createTransfer(supabase, userId, {
      from_account_id: intent.fromAccountId,
      to_account_id: intent.toAccountId,
      amount,
      transfer_date: onDate,
      kind: intent.kind,
      note: text.slice(0, 140),
    });
    return {
      status: "transferred",
      transfer: {
        id: transfer.id,
        amount: Number(transfer.amount),
        transfer_date: transfer.transfer_date,
        kind: transfer.kind,
      },
      from: name(intent.fromAccountId),
      to: name(intent.toAccountId),
      reason: intent.reason,
    };
  } catch (err) {
    // Never lose the user's entry to a transfers problem — fall through and
    // let it be logged as an ordinary expense.
    console.error("transfer insert failed, logging as expense", err);
    return null;
  }
}
