import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Accounts (v8) — the pocket a rupee sits in.
 *
 * A balance is arithmetic over four row types, so the maths lives in pure
 * functions here and gets unit-tested without a database:
 *
 *   balance = opening + incomes + transfers in − expenses − transfers out
 *
 * A credit card is the same equation with the sign running the other way:
 * swiping decreases the balance, paying the bill increases it back toward
 * zero. A negative balance on a card is what you owe.
 */

export const ACCOUNT_KINDS = ["bank", "cash", "wallet", "credit_card"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export interface Account {
  id: string;
  user_id: number;
  name: string;
  kind: AccountKind;
  identifier: string | null;
  opening_balance: number;
  credit_limit: number | null;
  statement_day: number | null;
  due_day: number | null;
  is_default: boolean;
  archived: boolean;
  /** v9: the balance the bank itself last reported, and when. */
  reported_balance?: number | null;
  reported_at?: string | null;
}

export interface LedgerRows {
  expenses: Array<{ account_id: string | null; amount: number }>;
  incomes: Array<{ account_id: string | null; amount: number }>;
  transfers: Array<{
    from_account_id: string | null;
    to_account_id: string | null;
    amount: number;
  }>;
}

export interface AccountBalance extends Account {
  /** Signed: negative on a credit card means money owed. */
  balance: number;
  /**
   * reported − computed. Non-zero means the bank and our rows disagree:
   * something was spent without being captured (or captured twice).
   */
  drift: number | null;
  /** Positive amount owed, for cards only; null elsewhere. */
  outstanding: number | null;
  /** credit_limit − outstanding, when a limit is set. */
  available: number | null;
}

export interface BalanceSheet {
  accounts: AccountBalance[];
  /** Everything you hold (cash, bank, wallets). Never includes card debt. */
  assets: number;
  /** Everything you owe on cards. Positive number. */
  liabilities: number;
  /** assets − liabilities. The first real net-position number in the app. */
  net: number;
  /** Rows not yet assigned to any account — the reconciliation backlog. */
  unassigned: { expenses: number; incomes: number };
}

const BASE_COLUMNS =
  "id, user_id, name, kind, identifier, opening_balance, credit_limit, statement_day, due_day, is_default, archived";
const ACCOUNT_COLUMNS = BASE_COLUMNS + ", reported_balance, reported_at";

export function isLiability(kind: AccountKind): boolean {
  return kind === "credit_card";
}

const num = (v: unknown): number => Number(v ?? 0) || 0;

/** Pure: the signed balance of one account given every row that touches it. */
export function accountBalance(account: Account, rows: LedgerRows): number {
  let balance = num(account.opening_balance);
  for (const e of rows.expenses)
    if (e.account_id === account.id) balance -= num(e.amount);
  for (const i of rows.incomes)
    if (i.account_id === account.id) balance += num(i.amount);
  for (const t of rows.transfers) {
    if (t.from_account_id === account.id) balance -= num(t.amount);
    if (t.to_account_id === account.id) balance += num(t.amount);
  }
  return Math.round(balance * 100) / 100;
}

/** Pure: balances for every account, plus the assets/liabilities/net summary. */
export function balanceSheet(
  accounts: Account[],
  rows: LedgerRows,
): BalanceSheet {
  const withBalances: AccountBalance[] = accounts.map((account) => {
    const balance = accountBalance(account, rows);
    const outstanding = isLiability(account.kind)
      ? Math.max(0, -balance)
      : null;
    const available =
      outstanding !== null && account.credit_limit != null
        ? Math.round((num(account.credit_limit) - outstanding) * 100) / 100
        : null;
    const reported = account.reported_balance;
    const drift =
      reported == null
        ? null
        : Math.round((Number(reported) - balance) * 100) / 100;
    return { ...account, balance, outstanding, available, drift };
  });

  let assets = 0;
  let liabilities = 0;
  for (const a of withBalances) {
    if (a.archived) continue;
    if (isLiability(a.kind)) liabilities += a.outstanding ?? 0;
    else assets += a.balance;
  }

  const unassigned = {
    expenses: rows.expenses
      .filter((e) => !e.account_id)
      .reduce((sum, e) => sum + num(e.amount), 0),
    incomes: rows.incomes
      .filter((i) => !i.account_id)
      .reduce((sum, i) => sum + num(i.amount), 0),
  };

  return {
    accounts: withBalances,
    assets: Math.round(assets * 100) / 100,
    liabilities: Math.round(liabilities * 100) / 100,
    net: Math.round((assets - liabilities) * 100) / 100,
    unassigned: {
      expenses: Math.round(unassigned.expenses * 100) / 100,
      incomes: Math.round(unassigned.incomes * 100) / 100,
    },
  };
}

/**
 * Every account, newest last. Returns [] rather than throwing when the v8
 * migration hasn't been applied yet — the app degrades to its v7 behaviour.
 */
export async function listAccounts(
  supabase: SupabaseClient,
  userId: number,
  { includeArchived = false } = {},
): Promise<Account[]> {
  const read = async (columns: string) => {
    let query = supabase.from("accounts").select(columns).eq("user_id", userId);
    if (!includeArchived) query = query.eq("archived", false);
    return query.order("created_at", { ascending: true });
  };

  try {
    const full = await read(ACCOUNT_COLUMNS);
    if (!full.error) return (full.data ?? []) as unknown as Account[];
    // Pre-v9 schema has no reported balance columns — read the v8 shape.
    const base = await read(BASE_COLUMNS);
    if (base.error) throw base.error;
    return (base.data ?? []) as unknown as Account[];
  } catch (err) {
    console.error("listAccounts failed (v8 migration applied?)", err);
    return [];
  }
}

/** The account an untagged expense should land in. */
export async function defaultAccountId(
  supabase: SupabaseClient,
  userId: number,
): Promise<string | null> {
  const accounts = await listAccounts(supabase, userId);
  if (!accounts.length) return null;
  return (accounts.find((a) => a.is_default) ?? accounts[0]).id;
}

/**
 * Caller-supplied account wins; otherwise fall back to the default so rows
 * stop piling up as unassigned once the user has set an account up.
 */
export async function resolveAccountId(
  supabase: SupabaseClient,
  userId: number,
  requested: string | null | undefined,
): Promise<string | null> {
  if (requested) {
    const accounts = await listAccounts(supabase, userId, {
      includeArchived: true,
    });
    if (accounts.some((a) => a.id === requested)) return requested;
  }
  return defaultAccountId(supabase, userId);
}

export async function createAccount(
  supabase: SupabaseClient,
  userId: number,
  input: {
    name: string;
    kind: AccountKind;
    identifier?: string | null;
    opening_balance?: number;
    credit_limit?: number | null;
    statement_day?: number | null;
    due_day?: number | null;
    is_default?: boolean;
  },
): Promise<Account> {
  const existing = await listAccounts(supabase, userId);
  // The first account is the default whether or not the user said so.
  const makeDefault = input.is_default || existing.length === 0;
  if (makeDefault) await clearDefault(supabase, userId);

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      name: input.name,
      kind: input.kind,
      identifier: input.identifier ?? null,
      opening_balance: input.opening_balance ?? 0,
      credit_limit: input.credit_limit ?? null,
      statement_day: input.statement_day ?? null,
      due_day: input.due_day ?? null,
      is_default: makeDefault,
    })
    .select(ACCOUNT_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as Account;
}

export async function updateAccount(
  supabase: SupabaseClient,
  userId: number,
  id: string,
  patch: Partial<
    Pick<
      Account,
      | "name"
      | "kind"
      | "identifier"
      | "opening_balance"
      | "credit_limit"
      | "statement_day"
      | "due_day"
      | "is_default"
      | "archived"
    >
  >,
): Promise<Account | null> {
  if (patch.is_default) await clearDefault(supabase, userId);
  const { data, error } = await supabase
    .from("accounts")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select(ACCOUNT_COLUMNS);
  if (error) throw error;
  return (data?.[0] as unknown as Account) ?? null;
}

/**
 * Archive rather than delete: the expenses that pointed at this account keep
 * their history, and the balance stays reconstructable.
 */
export async function archiveAccount(
  supabase: SupabaseClient,
  userId: number,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("accounts")
    .update({ archived: true, is_default: false })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw error;
  return Boolean(data?.length);
}

async function clearDefault(supabase: SupabaseClient, userId: number) {
  await supabase
    .from("accounts")
    .update({ is_default: false })
    .eq("user_id", userId)
    .eq("is_default", true);
}

/**
 * Balances for the whole account set. Reads the raw rows and does the maths
 * in TypeScript — the dataset is a few thousand rows and this keeps the
 * arithmetic in one tested place rather than spread across SQL views.
 */
export async function loadBalanceSheet(
  supabase: SupabaseClient,
  userId: number,
): Promise<BalanceSheet> {
  const accounts = await listAccounts(supabase, userId);
  if (!accounts.length)
    return {
      accounts: [],
      assets: 0,
      liabilities: 0,
      net: 0,
      unassigned: { expenses: 0, incomes: 0 },
    };

  const [expRes, incRes, trfRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("account_id, amount")
      .eq("user_id", userId),
    supabase.from("incomes").select("account_id, amount").eq("user_id", userId),
    supabase
      .from("transfers")
      .select("from_account_id, to_account_id, amount")
      .eq("user_id", userId),
  ]);

  return balanceSheet(accounts, {
    expenses: (expRes.data ?? []) as LedgerRows["expenses"],
    incomes: (incRes.data ?? []) as LedgerRows["incomes"],
    transfers: (trfRes.data ?? []) as LedgerRows["transfers"],
  });
}
