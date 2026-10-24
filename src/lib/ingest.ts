import { SupabaseClient } from "@supabase/supabase-js";
import {
  matchAccountByHint,
  parseBankMessage,
  type BankTxn,
} from "./bank-message";
import { listAccounts, type Account } from "./accounts";
import { loadMerchantRules, normaliseMerchant } from "./merchants";
import { insertExpense, loadCategories } from "./log-expense";
import { logIncome } from "./income";
import { localDate } from "./parser";

/**
 * Ingestion (v9): one bank message in, at most one ledger row out.
 *
 * Channel-agnostic — the Android notification listener, a forwarded SMS and
 * an email alert all land here. The hard part isn't parsing (that's
 * bank-message.ts), it's not logging the same rupee twice: the same purchase
 * can arrive as a bank SMS *and* a card notification *and* have been typed in
 * by hand thirty seconds earlier.
 */

/** How far back to look for the same transaction arriving by another route. */
const DEDUPE_WINDOW_HOURS = 30;

export type IngestStatus = "logged" | "duplicate" | "ignored" | "needs_review";

export interface IngestResult {
  status: IngestStatus;
  /** Human-readable reason, shown in the app and the bot reply. */
  note: string;
  txn: BankTxn | null;
  messageId: string | null;
  expenseId: string | null;
  incomeId: string | null;
  accountId: string | null;
  accountName: string | null;
  /** The bank's stated balance, when the message carried one. */
  balance: number | null;
  /** reported − computed, when both are known. Non-zero means rows are missing. */
  drift: number | null;
}

const fail = (
  status: IngestStatus,
  note: string,
  txn: BankTxn | null = null,
): IngestResult => ({
  status,
  note,
  txn,
  messageId: null,
  expenseId: null,
  incomeId: null,
  accountId: null,
  accountName: null,
  balance: null,
  drift: null,
});

export interface IngestInput {
  body: string;
  source: "notification" | "sms" | "telegram" | "email";
  /** Stable id from the channel (notification key, SMS id) — the dedupe key. */
  externalId?: string | null;
  receivedAt?: string;
}

export async function ingestBankMessage(
  supabase: SupabaseClient,
  userId: number,
  input: IngestInput,
): Promise<IngestResult> {
  const txn = parseBankMessage(input.body);
  if (!txn)
    return fail("ignored", "Not a completed transaction, so nothing was logged.");

  const receivedAt = input.receivedAt ?? new Date().toISOString();
  // The IST day, not the UTC one — a 1 a.m. coffee belongs to today's budget.
  const onDate = localDate(0, new Date(receivedAt));

  // 1. Same notification delivered twice.
  if (input.externalId) {
    const { data: seen } = await supabase
      .from("bank_messages")
      .select("id")
      .eq("user_id", userId)
      .eq("source", input.source)
      .eq("external_id", input.externalId)
      .limit(1);
    if (seen?.length)
      return fail("duplicate", "Already captured this message.", txn);
  }

  // 2. The same transaction arriving by a second channel.
  const since = new Date(
    Date.parse(receivedAt) - DEDUPE_WINDOW_HOURS * 3600_000,
  ).toISOString();
  const { data: recent } = await supabase
    .from("bank_messages")
    .select("id, amount, direction, reference, status")
    .eq("user_id", userId)
    .eq("amount", txn.amount)
    .gte("received_at", since);
  const twin = (recent ?? []).find(
    (m) =>
      m.status === "logged" &&
      m.direction === txn.direction &&
      (txn.reference ? m.reference === txn.reference : true),
  );
  if (twin) return fail("duplicate", "Same transaction already captured.", txn);

  const accounts = await listAccounts(supabase, userId);
  const account = pickAccount(txn, accounts);

  // 3. The user may have typed this in already.
  const manual = await findManualTwin(supabase, userId, txn, onDate);

  const row: Record<string, unknown> = {
    user_id: userId,
    source: input.source,
    external_id: input.externalId ?? null,
    received_at: receivedAt,
    body: input.body.slice(0, 2000),
    direction: txn.direction,
    amount: txn.amount,
    account_hint: txn.accountHint,
    balance: txn.balance,
    counterparty: txn.counterparty,
    reference: txn.reference,
    channel: txn.channel,
    confidence: txn.confidence,
    account_id: account?.id ?? null,
  };

  const message = await saveMessage(supabase, {
    ...row,
    status: manual ? "duplicate" : "pending",
    note: manual ? "Matches an entry you logged yourself." : null,
  });

  // The balance is worth recording even when the transaction itself is a
  // duplicate — it's the freshest truth we have about the account.
  const balanceInfo = await applyReportedBalance(
    supabase,
    userId,
    account,
    txn.balance,
    receivedAt,
    accounts,
  );

  const base = {
    txn,
    messageId: message?.id ?? null,
    accountId: account?.id ?? null,
    accountName: account?.name ?? null,
    balance: txn.balance,
    drift: balanceInfo.drift,
  };

  if (manual) {
    return {
      ...base,
      status: "duplicate",
      note: "You already logged this one. Balance updated, no new entry.",
      expenseId: null,
      incomeId: null,
    };
  }

  // 4. Write the ledger row.
  try {
    if (txn.direction === "credit") {
      const income = await logIncome(supabase, userId, {
        amount: txn.amount,
        source: txn.counterparty,
        income_date: onDate,
        raw_message: input.body.slice(0, 500),
        channel: `auto_${input.source}`,
        account_id: account?.id ?? null,
      });
      await markMessage(supabase, message?.id, "logged", {
        income_id: income.id,
      });
      return {
        ...base,
        status: "logged",
        note: "Income captured.",
        expenseId: null,
        incomeId: income.id,
      };
    }

    const { category, merchant } = await classify(supabase, userId, txn);
    const expense = await insertExpense(supabase, {
      amount: txn.amount,
      category,
      merchant,
      expense_date: onDate,
      user_id: userId,
      raw_message: input.body.slice(0, 500),
      source: `auto_${input.source}`,
      parsed_by: "rules",
      account_id: account?.id ?? null,
    });
    await markMessage(supabase, message?.id, "logged", {
      expense_id: expense.id,
    });

    return {
      ...base,
      status: txn.confidence === "low" ? "needs_review" : "logged",
      note:
        txn.confidence === "low"
          ? "Logged, but worth a check: the message was vague."
          : "Expense captured.",
      expenseId: expense.id,
      incomeId: null,
    };
  } catch (err) {
    await markMessage(supabase, message?.id, "needs_review", {
      note: err instanceof Error ? err.message : "insert failed",
    });
    return {
      ...base,
      status: "needs_review",
      note: "Couldn't write the entry.",
      expenseId: null,
      incomeId: null,
    };
  }
}

/**
 * The account the message names. Falls back to the only bank account when
 * there's exactly one and the message gave no hint — with two or more, an
 * unassigned row is better than a wrong one.
 */
function pickAccount(txn: BankTxn, accounts: Account[]): Account | null {
  const byHint = matchAccountByHint(txn.accountHint, accounts);
  if (byHint) return byHint;
  if (txn.accountHint) return null; // named an account we don't know — don't guess
  const spendable = accounts.filter((a) =>
    txn.channel === "card" ? a.kind === "credit_card" : a.kind === "bank",
  );
  return spendable.length === 1 ? spendable[0] : null;
}

/** Category and tidy merchant name for an auto-captured debit. */
async function classify(
  supabase: SupabaseClient,
  userId: number,
  txn: BankTxn,
): Promise<{ category: string; merchant: string | null }> {
  const [rules, categories] = await Promise.all([
    loadMerchantRules(supabase, userId),
    loadCategories(supabase),
  ]);
  const normalised = normaliseMerchant(txn.counterparty, rules);
  const hinted = categories.some((c) => c.name === normalised?.category)
    ? normalised!.category
    : null;

  // A keyword the user has already taught the rules parser beats everything.
  const haystack = (txn.counterparty ?? "").toLowerCase();
  const learned = categories.find((c) =>
    c.keywords?.some((k) => k.length > 2 && haystack.includes(k.toLowerCase())),
  );

  return {
    category: learned?.name ?? hinted ?? "Uncategorized",
    merchant: normalised?.merchant ?? txn.counterparty,
  };
}

/**
 * Did the user already type this in? Same amount, same day — that's a strong
 * enough signal, because logging the identical amount twice in one day by
 * coincidence is rare, and a missed duplicate is worse than a missed capture.
 */
async function findManualTwin(
  supabase: SupabaseClient,
  userId: number,
  txn: BankTxn,
  onDate: string,
): Promise<boolean> {
  if (txn.direction !== "debit") return false;
  const { data } = await supabase
    .from("expenses")
    .select("id, source")
    .eq("user_id", userId)
    .eq("amount", txn.amount)
    .eq("expense_date", onDate)
    .limit(5);
  // Only a human-entered row counts as the twin; another auto-capture is
  // handled by the message-level dedupe above.
  return (data ?? []).some((e) => !String(e.source ?? "").startsWith("auto_"));
}

/**
 * Store the bank's stated balance on the account and report the drift
 * against what our own rows add up to.
 */
async function applyReportedBalance(
  supabase: SupabaseClient,
  userId: number,
  account: Account | null,
  balance: number | null,
  at: string,
  accounts: Account[],
): Promise<{ drift: number | null }> {
  if (!account || balance == null) return { drift: null };
  try {
    await supabase
      .from("accounts")
      .update({ reported_balance: balance, reported_at: at })
      .eq("id", account.id)
      .eq("user_id", userId);
  } catch (err) {
    console.error("reported balance update failed", err);
  }
  return { drift: null }; // computed after the row lands; see driftFor()
}

/** reported − computed for one account, once both are known. */
export function driftFor(
  reported: number | null | undefined,
  computed: number,
): number | null {
  if (reported == null) return null;
  return Math.round((Number(reported) - computed) * 100) / 100;
}

async function saveMessage(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{ id: string } | null> {
  try {
    const { data, error } = await supabase
      .from("bank_messages")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return data as { id: string };
  } catch (err) {
    console.error("bank_messages insert failed (v9 migration applied?)", err);
    return null;
  }
}

async function markMessage(
  supabase: SupabaseClient,
  id: string | null | undefined,
  status: IngestStatus,
  patch: Record<string, unknown> = {},
): Promise<void> {
  if (!id) return;
  try {
    await supabase
      .from("bank_messages")
      .update({ status, ...patch })
      .eq("id", id);
  } catch (err) {
    console.error("bank_messages update failed", err);
  }
}

/** Recent messages, for the "why did you log this?" view. */
export async function listBankMessages(
  supabase: SupabaseClient,
  userId: number,
  limit = 30,
): Promise<Array<Record<string, unknown>>> {
  try {
    const { data, error } = await supabase
      .from("bank_messages")
      .select(
        "id, source, received_at, direction, amount, counterparty, channel, confidence, status, note, account_id, expense_id, income_id",
      )
      .eq("user_id", userId)
      .order("received_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error("listBankMessages failed (v9 migration applied?)", err);
    return [];
  }
}

/** Today's date in IST — the fallback when a channel sends no timestamp. */
export const captureDate = () => localDate();
