import { SupabaseClient } from "@supabase/supabase-js";
import type { Account } from "./accounts";

/**
 * Transfers (v8) — your own money moving between your own pockets.
 *
 * This is the single most common way a tracker lies to you: a ₹20,000 move
 * from savings to a wallet, an ATM withdrawal, or a credit card bill payment
 * all look exactly like spending to a naive parser, and every one of them
 * inflates the month. Recording them as transfers keeps the balances right
 * and keeps them out of every spend total.
 */

export const TRANSFER_KINDS = ["transfer", "card_payment"] as const;
export type TransferKind = (typeof TRANSFER_KINDS)[number];

export interface Transfer {
  id: string;
  user_id: number;
  from_account_id: string | null;
  to_account_id: string | null;
  amount: number;
  transfer_date: string;
  kind: TransferKind;
  note: string | null;
  bill_payment_id: string | null;
}

const TRANSFER_COLUMNS =
  "id, user_id, from_account_id, to_account_id, amount, transfer_date, kind, note, bill_payment_id";

/** Words that mean "this money didn't leave your net worth". */
const TRANSFER_PHRASES = [
  "transfer",
  "transferred",
  "moved to",
  "move to",
  "sent to my",
  "self transfer",
  "own account",
  "atm",
  "withdrew",
  "withdrawal",
  "cash withdrawal",
  "added money",
  "top up",
  "topped up",
  "loaded wallet",
  "credit card bill",
  "card bill",
  "card payment",
  "paid my card",
  "cred payment",
];

/** Phrases where the destination is cash in hand rather than another account. */
const CASH_OUT_PHRASES = ["atm", "withdrew", "withdrawal", "cash out"];

/** Phrases that specifically mean settling a credit card. */
const CARD_PAYMENT_PHRASES = [
  "credit card bill",
  "card bill",
  "card payment",
  "paid my card",
  "cred payment",
];

export interface TransferIntent {
  kind: TransferKind;
  /** Best-guess accounts; null when the text doesn't name one. */
  fromAccountId: string | null;
  toAccountId: string | null;
  /** Why we think so — shown to the user so the guess is never silent. */
  reason: string;
}

/**
 * Pure: does this message describe a movement rather than a purchase?
 *
 * Deliberately conservative — it only fires on explicit wording. A false
 * positive here hides real spending, which is far worse than a false
 * negative, so anything ambiguous stays an expense.
 */
export function detectTransferIntent(
  text: string,
  accounts: Account[],
): TransferIntent | null {
  const lower = text.toLowerCase();
  const phrase = TRANSFER_PHRASES.find((p) => lower.includes(p));
  if (!phrase) return null;

  const live = accounts.filter((a) => !a.archived);
  const named = live.filter((a) => lower.includes(a.name.toLowerCase()));
  const card = live.find((a) => a.kind === "credit_card");
  const cash = live.find((a) => a.kind === "cash");
  const bank =
    live.find((a) => a.kind === "bank" && a.is_default) ??
    live.find((a) => a.kind === "bank");

  if (CARD_PAYMENT_PHRASES.some((p) => lower.includes(p))) {
    const target = named.find((a) => a.kind === "credit_card") ?? card;
    if (!target) return null;
    const source = named.find((a) => a.id !== target.id) ?? bank ?? null;
    return {
      kind: "card_payment",
      fromAccountId: source?.id ?? null,
      toAccountId: target.id,
      reason: `"${phrase}" — settling a card, not new spending`,
    };
  }

  if (CASH_OUT_PHRASES.some((p) => lower.includes(p))) {
    if (!cash) return null;
    const source = named.find((a) => a.id !== cash.id) ?? bank ?? null;
    return {
      kind: "transfer",
      fromAccountId: source?.id ?? null,
      toAccountId: cash.id,
      reason: `"${phrase}" — cash out of an account, still your money`,
    };
  }

  // Plain "transferred 5000 to wallet": needs both ends to be unambiguous.
  if (named.length >= 2) {
    return {
      kind: "transfer",
      fromAccountId: named[0].id,
      toAccountId: named[1].id,
      reason: `"${phrase}" between two of your accounts`,
    };
  }
  if (named.length === 1 && bank && named[0].id !== bank.id) {
    return {
      kind: "transfer",
      fromAccountId: bank.id,
      toAccountId: named[0].id,
      reason: `"${phrase}" into ${named[0].name}`,
    };
  }
  return null;
}

export async function listTransfers(
  supabase: SupabaseClient,
  userId: number,
  sinceDate?: string,
): Promise<Transfer[]> {
  try {
    let query = supabase
      .from("transfers")
      .select(TRANSFER_COLUMNS)
      .eq("user_id", userId);
    if (sinceDate) query = query.gte("transfer_date", sinceDate);
    const { data, error } = await query.order("transfer_date", {
      ascending: false,
    });
    if (error) throw error;
    return (data ?? []) as Transfer[];
  } catch (err) {
    console.error("listTransfers failed (v8 migration applied?)", err);
    return [];
  }
}

export async function createTransfer(
  supabase: SupabaseClient,
  userId: number,
  input: {
    from_account_id: string | null;
    to_account_id: string | null;
    amount: number;
    transfer_date: string;
    kind?: TransferKind;
    note?: string | null;
    bill_payment_id?: string | null;
  },
): Promise<Transfer> {
  const { data, error } = await supabase
    .from("transfers")
    .insert({
      user_id: userId,
      from_account_id: input.from_account_id,
      to_account_id: input.to_account_id,
      amount: input.amount,
      transfer_date: input.transfer_date,
      kind: input.kind ?? "transfer",
      note: input.note ?? null,
      bill_payment_id: input.bill_payment_id ?? null,
    })
    .select(TRANSFER_COLUMNS)
    .single();
  if (error) throw error;
  return data as Transfer;
}

export async function deleteTransfer(
  supabase: SupabaseClient,
  userId: number,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("transfers")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw error;
  return Boolean(data?.length);
}
