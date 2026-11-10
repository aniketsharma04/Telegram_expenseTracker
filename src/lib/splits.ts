import { SupabaseClient } from "@supabase/supabase-js";
import { insertExpense } from "./log-expense";
import {
  allocate,
  balancesWithMe,
  checkSplit,
  fromPaise,
  guessRepayments,
  ME,
  membersFor,
  nameScore,
  toPaise,
  UPI_ID,
  type Member,
  type SplitLike,
  type SplitMethod,
} from "./split-math";

/**
 * Splits with friends (v24) — the DB side. Maths lives in split-math.ts.
 *
 * Two records move together:
 *  - the ledger: `splits` + `split_members` (paid/owed per person, paise)
 *  - the cash view in `expenses`/`incomes`, so every spend total and account
 *    balance stays right with no special cases:
 *      you paid   → your row = your share; a "Lent" row holds the rest
 *      friend paid → one row for your share (no account)
 *      paid back  → their credit links to the payment (not earnings);
 *                   your payment to them becomes "Settle up" (not spending)
 *
 * Supabase-js has no transactions, so multi-step writes undo what they did
 * when a later step fails.
 */

export const LENT = "Lent";
export const SETTLE_UP = "Settle up";
/** Sources on rows this module writes. `split_*` never count as a manual twin. */
const SRC_SHARE_OWED = "split_owed"; // your share when a friend paid
const SRC_LENT = "split_lent"; // the lent part of a captured payment

export interface Person {
  id: string;
  name: string;
  upi_id: string | null;
  phone: string | null;
  bank_names: string[];
  linked_user_id: number | null;
}

export interface SplitRecord {
  id: string;
  kind: "expense" | "payment";
  total: number; // paise
  description: string | null;
  category: string | null;
  split_date: string;
  method: string;
  group_id: string | null;
  expense_id: string | null;
  lent_id: string | null;
  income_id: string | null;
  created_at: string;
  members: {
    person_id: string | null;
    paid: number;
    owed: number;
    weight: number | null;
  }[];
}

const PERSON_COLUMNS = "id, name, upi_id, phone, bank_names, linked_user_id";
const SPLIT_COLUMNS =
  "id, kind, total, description, category, split_date, method, group_id, expense_id, lent_id, income_id, created_at, split_members (person_id, paid, owed, weight)";

const keyOf = (personId: string | null) => personId ?? ME;
export const toLike = (s: SplitRecord): SplitLike => ({
  id: s.id,
  kind: s.kind,
  total: Number(s.total),
  members: s.members.map((m) => ({
    key: keyOf(m.person_id),
    paid: Number(m.paid),
    owed: Number(m.owed),
  })),
});

export class SplitError extends Error {}

// ── People ──────────────────────────────────────────────────────────────────

export async function listPeople(
  supabase: SupabaseClient,
  ownerId: number,
): Promise<Person[]> {
  const { data, error } = await supabase
    .from("people")
    .select(PERSON_COLUMNS)
    .eq("owner_id", ownerId)
    .eq("archived", false)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Person[];
}

function cleanPerson(p: { name?: unknown; upi_id?: unknown; phone?: unknown }) {
  const out: Partial<Pick<Person, "name" | "upi_id" | "phone">> = {};
  if (p.name !== undefined) {
    const name = String(p.name ?? "")
      .trim()
      .slice(0, 60);
    if (!name) throw new SplitError("A name is needed.");
    out.name = name;
  }
  if (p.upi_id !== undefined) {
    const v = String(p.upi_id ?? "").trim();
    if (v && !UPI_ID.test(v))
      throw new SplitError("That doesn't look like a UPI ID (name@bank).");
    out.upi_id = v || null;
  }
  if (p.phone !== undefined) {
    const v = String(p.phone ?? "").replace(/[\s-]/g, "");
    if (v && !/^\+?[0-9]{10,13}$/.test(v))
      throw new SplitError("That doesn't look like a phone number.");
    out.phone = v || null;
  }
  return out;
}

export async function addPerson(
  supabase: SupabaseClient,
  ownerId: number,
  input: { name: unknown; upi_id?: unknown; phone?: unknown },
): Promise<Person> {
  const row = cleanPerson(input);
  // Same name again: reuse instead of a second "Rahul".
  const existing = (await listPeople(supabase, ownerId)).find(
    (p) => p.name.toLowerCase() === row.name!.toLowerCase(),
  );
  if (existing) return existing;
  const { data, error } = await supabase
    .from("people")
    .insert({ owner_id: ownerId, ...row })
    .select(PERSON_COLUMNS)
    .single();
  if (error) throw error;
  return data as Person;
}

export async function updatePerson(
  supabase: SupabaseClient,
  ownerId: number,
  id: string,
  input: { name?: unknown; upi_id?: unknown; phone?: unknown },
): Promise<Person> {
  const { data, error } = await supabase
    .from("people")
    .update(cleanPerson(input))
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select(PERSON_COLUMNS)
    .single();
  if (error) throw error;
  return data as Person;
}

/** Hide someone. Refused while money is still owed either way. */
export async function archivePerson(
  supabase: SupabaseClient,
  ownerId: number,
  id: string,
): Promise<void> {
  const balance =
    balancesWithMe((await loadSplits(supabase, ownerId)).map(toLike)).get(id) ??
    0;
  if (balance !== 0)
    throw new SplitError(
      "Settle up or forgive what's owed before removing them.",
    );
  const { error } = await supabase
    .from("people")
    .update({ archived: true })
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (error) throw error;
}

export async function setMyUpiId(
  supabase: SupabaseClient,
  userId: number,
  upiId: string | null,
): Promise<void> {
  const v = upiId?.trim() || null;
  if (v && !UPI_ID.test(v))
    throw new SplitError("That doesn't look like a UPI ID (name@bank).");
  const { error } = await supabase
    .from("users")
    .update({ upi_id: v })
    .eq("id", userId);
  if (error) throw error;
}

// ── Reading ─────────────────────────────────────────────────────────────────

export async function loadSplits(
  supabase: SupabaseClient,
  ownerId: number,
): Promise<SplitRecord[]> {
  const { data, error } = await supabase
    .from("splits")
    .select(SPLIT_COLUMNS)
    .eq("owner_id", ownerId)
    .order("split_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (
    (data ?? []) as unknown as (Omit<SplitRecord, "members"> & {
      split_members: SplitRecord["members"];
    })[]
  ).map(({ split_members, ...s }) => ({
    ...s,
    total: Number(s.total),
    members: (split_members ?? []).map((m) => ({
      ...m,
      paid: Number(m.paid),
      owed: Number(m.owed),
      weight: m.weight == null ? null : Number(m.weight),
    })),
  }));
}

export interface RepaymentPrompt {
  incomeId: string;
  personId: string;
  personName: string;
  bankName: string | null;
  amount: number; // paise
  date: string;
}

export interface SplitsSummary {
  myUpiId: string | null;
  people: (Person & { balance: number })[]; // balance: + they owe you (paise)
  owedToMe: number;
  iOwe: number;
  recent: SplitRecord[];
  repayments: RepaymentPrompt[];
}

/** Everything the app shows about splits, in one load. */
export async function loadSplitsSummary(
  supabase: SupabaseClient,
  userId: number,
  today: string,
): Promise<SplitsSummary> {
  const [people, splits, me] = await Promise.all([
    listPeople(supabase, userId),
    loadSplits(supabase, userId),
    supabase.from("users").select("upi_id").eq("id", userId).limit(1),
  ]);
  const balances = balancesWithMe(splits.map(toLike));
  const withBalance = people
    .map((p) => ({ ...p, balance: balances.get(p.id) ?? 0 }))
    .sort(
      (a, b) =>
        Math.abs(b.balance) - Math.abs(a.balance) ||
        a.name.localeCompare(b.name),
    );

  let repayments: RepaymentPrompt[] = [];
  if ([...balances.values()].some((v) => v > 0)) {
    const since = new Date(Date.parse(`${today}T00:00:00Z`) - 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { data } = await supabase
      .from("incomes")
      .select("id, amount, source, income_date")
      .eq("user_id", userId)
      .gte("income_date", since)
      .is("split_id", null)
      .eq("repayment_checked", false)
      .order("income_date", { ascending: false })
      .limit(50);
    const guesses = guessRepayments(
      (data ?? []) as {
        id: string;
        amount: number;
        source: string | null;
        income_date: string;
      }[],
      balances,
      people.map((p) => ({ key: p.id, name: p.name, bankNames: p.bank_names })),
    );
    const byId = new Map(people.map((p) => [p.id, p]));
    const incomeById = new Map(
      (
        (data ?? []) as {
          id: string;
          source: string | null;
          income_date: string;
        }[]
      ).map((i) => [i.id, i]),
    );
    repayments = guesses.map((g) => ({
      incomeId: g.incomeId,
      personId: g.personKey,
      personName: byId.get(g.personKey)?.name ?? "",
      bankName: incomeById.get(g.incomeId)?.source ?? null,
      amount: g.amount,
      date: incomeById.get(g.incomeId)?.income_date ?? today,
    }));
  }

  return {
    myUpiId:
      (me.data?.[0] as { upi_id?: string | null } | undefined)?.upi_id ?? null,
    people: withBalance,
    owedToMe: [...balances.values()]
      .filter((v) => v > 0)
      .reduce((a, b) => a + b, 0),
    iOwe: -[...balances.values()]
      .filter((v) => v < 0)
      .reduce((a, b) => a + b, 0),
    recent: splits.slice(0, 30),
    repayments,
  };
}

// ── Writing a split ─────────────────────────────────────────────────────────

export interface NewSplit {
  /** Split an expense already logged (captured or typed). You paid it. */
  expenseId?: string;
  /** Or a new one. Needed when expenseId is absent. */
  amount?: number; // rupees
  category?: string;
  merchant?: string | null;
  date?: string;
  description?: string | null;
  /** "me", or a person id when a friend paid. */
  paidBy: string;
  method: SplitMethod;
  /** Who's in it. "me" may be left out (you paid for them). */
  shares: { person: string; value?: number }[]; // exact values in rupees
}

interface ExpenseRow {
  id: string;
  user_id: number;
  amount: number;
  category: string;
  merchant: string | null;
  expense_date: string;
  account_id: string | null;
  source: string | null;
}

async function ownExpense(
  supabase: SupabaseClient,
  userId: number,
  id: string,
): Promise<ExpenseRow> {
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "id, user_id, amount, category, merchant, expense_date, account_id, source",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1);
  if (error) throw error;
  const row = data?.[0] as ExpenseRow | undefined;
  if (!row) throw new SplitError("That expense wasn't found.");
  return { ...row, amount: Number(row.amount) };
}

export async function createSplit(
  supabase: SupabaseClient,
  userId: number,
  input: NewSplit,
): Promise<SplitRecord> {
  const people = await listPeople(supabase, userId);
  const known = new Set(people.map((p) => p.id));
  const keyFor = (k: string) => {
    if (k === ME) return ME;
    if (!known.has(k))
      throw new SplitError("Someone in this split isn't in your people list.");
    return k;
  };
  const payer = keyFor(input.paidBy);
  if (!input.shares.length) throw new SplitError("Pick who to split with.");
  const shares = input.shares.map((s) => ({
    key: keyFor(s.person),
    value: input.method === "exact" ? toPaise(Number(s.value ?? 0)) : s.value,
  }));
  // Payer first, so leftover paise land on them.
  shares.sort((a, b) => (a.key === payer ? -1 : b.key === payer ? 1 : 0));

  let base: ExpenseRow | null = null;
  if (input.expenseId) {
    if (payer !== ME)
      throw new SplitError("An expense from your account was paid by you.");
    base = await ownExpense(supabase, userId, input.expenseId);
    if (base.category === LENT || base.category === SETTLE_UP)
      throw new SplitError("That entry is already part of a split.");
    const { data: taken } = await supabase
      .from("splits")
      .select("id")
      .eq("owner_id", userId)
      .or(`expense_id.eq.${base.id},lent_id.eq.${base.id}`)
      .limit(1);
    if (taken?.length) throw new SplitError("That expense is already split.");
  }

  const total = toPaise(base ? base.amount : Number(input.amount));
  if (!(total > 0)) throw new SplitError("Enter an amount.");
  let owed: Map<string, number>;
  try {
    owed = allocate(total, input.method, shares);
  } catch (err) {
    throw new SplitError(
      err instanceof Error ? err.message : "Those shares don't work.",
    );
  }
  const members: Member[] = membersFor(total, payer, owed);
  if (!members.some((m) => m.key === ME))
    members.push({ key: ME, paid: 0, owed: 0 });
  const problem = checkSplit({ kind: "expense", total, members });
  if (problem) throw new SplitError(problem);
  if (
    members
      .filter((m) => m.key !== ME)
      .every((m) => m.owed === 0 && m.paid === 0)
  )
    throw new SplitError("Add at least one other person.");

  const mine = owed.get(ME) ?? 0;
  const category = base?.category ?? (input.category || "Uncategorized");
  const merchant = base ? base.merchant : input.merchant?.trim() || null;
  const date = base?.expense_date ?? input.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new SplitError("Pick a date.");
  const splitId = crypto.randomUUID();
  const note = `[split] ${fromPaise(total)} ${category}${merchant ? ` ${merchant}` : ""}`;

  // Undo list, run in reverse if a later step fails.
  const undo: (() => PromiseLike<unknown>)[] = [];
  let expenseId: string | null = null;
  let lentId: string | null = null;
  try {
    if (payer === ME) {
      const lent = total - mine;
      if (base) {
        if (mine > 0) {
          // Your row shrinks to your share; the rest becomes "Lent".
          await mustUpdate(supabase, "expenses", base.id, userId, {
            amount: fromPaise(mine),
            split_id: splitId,
          });
          undo.push(() =>
            mustUpdate(supabase, "expenses", base!.id, userId, {
              amount: base!.amount,
              split_id: null,
            }),
          );
          expenseId = base.id;
          if (lent > 0) {
            const row = await insertExpense(supabase, {
              user_id: userId,
              amount: fromPaise(lent),
              category: LENT,
              merchant,
              raw_message: note,
              source: SRC_LENT,
              parsed_by: "split",
              expense_date: date,
              split_id: splitId,
              account_id: base.account_id,
            });
            lentId = row.id;
            undo.push(() =>
              supabase
                .from("expenses")
                .delete()
                .eq("id", row.id)
                .eq("user_id", userId),
            );
          }
        } else {
          // You paid for them entirely: the whole row is lent.
          await mustUpdate(supabase, "expenses", base.id, userId, {
            category: LENT,
            split_id: splitId,
          });
          undo.push(() =>
            mustUpdate(supabase, "expenses", base!.id, userId, {
              category: base!.category,
              split_id: null,
            }),
          );
          lentId = base.id;
        }
      } else {
        // A new payment typed in: "app" rows, so the bank alert that follows
        // is recognised as the same money (see findManualTwin).
        if (mine > 0) {
          const row = await insertExpense(supabase, {
            user_id: userId,
            amount: fromPaise(mine),
            category,
            merchant,
            raw_message: note,
            source: "app",
            parsed_by: "split",
            expense_date: date,
            split_id: splitId,
          });
          expenseId = row.id;
          undo.push(() =>
            supabase
              .from("expenses")
              .delete()
              .eq("id", row.id)
              .eq("user_id", userId),
          );
        }
        if (lent > 0) {
          const row = await insertExpense(supabase, {
            user_id: userId,
            amount: fromPaise(lent),
            category: LENT,
            merchant,
            raw_message: note,
            source: "app",
            parsed_by: "split",
            expense_date: date,
            split_id: splitId,
          });
          lentId = row.id;
          undo.push(() =>
            supabase
              .from("expenses")
              .delete()
              .eq("id", row.id)
              .eq("user_id", userId),
          );
        }
      }
    } else if (mine > 0) {
      // A friend paid: your share is spending today; no money left your account.
      const row = await insertExpense(supabase, {
        user_id: userId,
        amount: fromPaise(mine),
        category,
        merchant,
        raw_message: note,
        source: SRC_SHARE_OWED,
        parsed_by: "split",
        expense_date: date,
        split_id: splitId,
      });
      expenseId = row.id;
      undo.push(() =>
        supabase
          .from("expenses")
          .delete()
          .eq("id", row.id)
          .eq("user_id", userId),
      );
    }

    return await insertSplit(supabase, userId, {
      id: splitId,
      kind: "expense",
      total,
      description: input.description?.trim().slice(0, 120) || merchant,
      category,
      split_date: date,
      method: input.method,
      expense_id: expenseId,
      lent_id: lentId,
      income_id: null,
      members,
      weights: new Map(
        input.method === "shares" || input.method === "percent"
          ? shares.map((s) => [s.key, Number(s.value)])
          : [],
      ),
    });
  } catch (err) {
    for (const step of undo.reverse())
      await Promise.resolve(step()).catch(() => {});
    throw err;
  }
}

async function mustUpdate(
  supabase: SupabaseClient,
  table: "expenses" | "incomes",
  id: string,
  userId: number,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase
    .from(table)
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

async function insertSplit(
  supabase: SupabaseClient,
  userId: number,
  s: Omit<SplitRecord, "members" | "created_at" | "group_id"> & {
    members: Member[];
    weights: Map<string, number>;
    via?: "upi" | "cash";
  },
): Promise<SplitRecord> {
  const { members, weights, via, ...row } = s;
  // `via` only when set, so a pre-v25 database (no column) still takes the rest.
  const { error } = await supabase
    .from("splits")
    .insert({ owner_id: userId, ...row, ...(via ? { via } : {}) });
  if (error) throw error;
  const memberRows = members.map((m) => ({
    split_id: s.id,
    person_id: m.key === ME ? null : m.key,
    paid: m.paid,
    owed: m.owed,
    weight: weights.get(m.key) ?? null,
  }));
  const res = await supabase.from("split_members").insert(memberRows);
  if (res.error) {
    await supabase
      .from("splits")
      .delete()
      .eq("id", s.id)
      .eq("owner_id", userId);
    throw res.error;
  }
  const [saved] = (await loadSplits(supabase, userId)).filter(
    (x) => x.id === s.id,
  );
  return saved;
}

// ── Settling up ─────────────────────────────────────────────────────────────

export interface NewPayment {
  personId: string;
  /** they_paid: they paid you back. i_paid: you paid them. */
  direction: "they_paid" | "i_paid";
  amount?: number; // rupees; defaults to the linked credit/debit
  date?: string;
  /** The bank credit that was their repayment. */
  incomeId?: string;
  /** The bank debit that was your payment to them. */
  expenseId?: string;
  /**
   * v25: "upi" when paid from Aaj's Pay button — its bank alert gets linked
   * when it arrives. "cash" (or absent) is never auto-linked.
   */
  via?: "upi" | "cash";
}

export async function recordPayment(
  supabase: SupabaseClient,
  userId: number,
  input: NewPayment,
  today: string,
): Promise<SplitRecord> {
  const person = (await listPeople(supabase, userId)).find(
    (p) => p.id === input.personId,
  );
  if (!person) throw new SplitError("That person wasn't found.");

  let amount = input.amount != null ? toPaise(Number(input.amount)) : 0;
  let date = input.date ?? today;
  type IncomeRow = {
    id: string;
    amount: number;
    source: string | null;
    income_date: string;
    split_id: string | null;
  };
  let income: IncomeRow | null = null;
  let debit: ExpenseRow | null = null;

  if (input.incomeId) {
    if (input.direction !== "they_paid")
      throw new SplitError("A credit is them paying you.");
    const { data, error } = await supabase
      .from("incomes")
      .select("id, amount, source, income_date, split_id")
      .eq("id", input.incomeId)
      .eq("user_id", userId)
      .limit(1);
    if (error) throw error;
    const row = data?.[0] as IncomeRow | undefined;
    if (!row) throw new SplitError("That credit wasn't found.");
    if (row.split_id)
      throw new SplitError("That credit is already recorded as a repayment.");
    income = row;
    amount = toPaise(Number(row.amount));
    date = row.income_date;
  }
  if (input.expenseId) {
    if (input.direction !== "i_paid")
      throw new SplitError("A debit is you paying them.");
    debit = await ownExpense(supabase, userId, input.expenseId);
    if (debit.category === LENT || debit.category === SETTLE_UP)
      throw new SplitError("That entry is already part of a split.");
    amount = toPaise(debit.amount);
    date = debit.expense_date;
  }
  if (!(amount > 0)) throw new SplitError("Enter an amount.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new SplitError("Pick a date.");

  const members: Member[] =
    input.direction === "they_paid"
      ? [
          { key: person.id, paid: amount, owed: 0 },
          { key: ME, paid: 0, owed: amount },
        ]
      : [
          { key: ME, paid: amount, owed: 0 },
          { key: person.id, paid: 0, owed: amount },
        ];

  const splitId = crypto.randomUUID();
  const undo: (() => PromiseLike<unknown>)[] = [];
  try {
    if (debit) {
      await mustUpdate(supabase, "expenses", debit.id, userId, {
        category: SETTLE_UP,
        split_id: splitId,
      });
      undo.push(() =>
        mustUpdate(supabase, "expenses", debit!.id, userId, {
          category: debit!.category,
          split_id: null,
        }),
      );
    }
    const saved = await insertSplit(supabase, userId, {
      id: splitId,
      kind: "payment",
      total: amount,
      description:
        input.direction === "they_paid"
          ? `${person.name} paid you`
          : `You paid ${person.name}`,
      // For a linked debit, its old category — so deleting this puts it back.
      category: debit?.category ?? null,
      split_date: date,
      method: "payment",
      expense_id: debit?.id ?? null,
      lent_id: null,
      income_id: income?.id ?? null,
      members,
      weights: new Map(),
      via: income || debit ? undefined : input.via,
    });
    // Paid from the Pay button: the bank alert may have landed already.
    if (input.via === "upi" && input.direction === "i_paid" && !debit)
      await linkRecentDebit(supabase, userId, saved, person).catch((err) =>
        console.error("linking the UPI debit failed", err),
      );
    if (income) {
      await mustUpdate(supabase, "incomes", income.id, userId, {
        split_id: splitId,
        repayment_checked: true,
      });
      // Learn the bank's name for them, so the next one is certain.
      const bankName = income.source?.trim();
      if (
        bankName &&
        !person.bank_names.some(
          (n) => n.toLowerCase() === bankName.toLowerCase(),
        )
      )
        await supabase
          .from("people")
          .update({ bank_names: [...person.bank_names, bankName].slice(-5) })
          .eq("id", person.id)
          .eq("owner_id", userId);
    }
    return saved;
  } catch (err) {
    for (const step of undo.reverse())
      await Promise.resolve(step()).catch(() => {});
    await supabase
      .from("splits")
      .delete()
      .eq("id", splitId)
      .eq("owner_id", userId);
    throw err;
  }
}

/** "No, that's not a repayment": stop asking about this credit. */
export async function dismissRepayment(
  supabase: SupabaseClient,
  userId: number,
  incomeId: string,
): Promise<void> {
  await mustUpdate(supabase, "incomes", incomeId, userId, {
    repayment_checked: true,
  });
}

/**
 * Remove a split or payment and put the money rows back as they were:
 * your share and the lent part merge again, a friend-paid share goes, a
 * repayment credit counts as income again, a payment debit gets its
 * category back.
 */
export async function deleteSplit(
  supabase: SupabaseClient,
  userId: number,
  splitId: string,
): Promise<void> {
  const s = (await loadSplits(supabase, userId)).find((x) => x.id === splitId);
  if (!s) throw new SplitError("That split wasn't found.");
  const payerIsMe = s.members.some((m) => m.person_id === null && m.paid > 0);

  const rows = async (ids: (string | null)[]) => {
    const real = ids.filter(Boolean) as string[];
    if (!real.length) return [] as ExpenseRow[];
    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, user_id, amount, category, merchant, expense_date, account_id, source",
      )
      .eq("user_id", userId)
      .in("id", real);
    if (error) throw error;
    return (data ?? []) as ExpenseRow[];
  };
  const [share, lent] = await Promise.all([
    rows([s.expense_id]),
    rows([s.lent_id]),
  ]);
  const shareRow = share[0];
  const lentRow = lent[0];

  if (s.kind === "payment") {
    if (shareRow)
      await mustUpdate(supabase, "expenses", shareRow.id, userId, {
        category: s.category || "Uncategorized",
        split_id: null,
      });
    if (s.income_id)
      await mustUpdate(supabase, "incomes", s.income_id, userId, {
        split_id: null,
        repayment_checked: false,
      });
  } else if (payerIsMe) {
    if (shareRow && lentRow) {
      await mustUpdate(supabase, "expenses", shareRow.id, userId, {
        amount: Number(shareRow.amount) + Number(lentRow.amount),
        split_id: null,
      });
      await supabase
        .from("expenses")
        .delete()
        .eq("id", lentRow.id)
        .eq("user_id", userId);
    } else if (lentRow && !shareRow) {
      // Paid for them entirely: a typed entry goes; a captured one is yours again.
      if (lentRow.source === "app")
        await supabase
          .from("expenses")
          .delete()
          .eq("id", lentRow.id)
          .eq("user_id", userId);
      else
        await mustUpdate(supabase, "expenses", lentRow.id, userId, {
          category: s.category || "Uncategorized",
          split_id: null,
        });
    } else if (shareRow) {
      await mustUpdate(supabase, "expenses", shareRow.id, userId, {
        split_id: null,
      });
    }
  } else if (shareRow && shareRow.source === SRC_SHARE_OWED) {
    await supabase
      .from("expenses")
      .delete()
      .eq("id", shareRow.id)
      .eq("user_id", userId);
  }

  const { error } = await supabase
    .from("splits")
    .delete()
    .eq("id", s.id)
    .eq("owner_id", userId);
  if (error) throw error;
}

/** The split an expense row belongs to, if any (for the edit sheet). */
export async function splitForExpense(
  supabase: SupabaseClient,
  userId: number,
  expenseId: string,
): Promise<SplitRecord | null> {
  const { data } = await supabase
    .from("splits")
    .select("id")
    .eq("owner_id", userId)
    .or(`expense_id.eq.${expenseId},lent_id.eq.${expenseId}`)
    .limit(1);
  const id = (data?.[0] as { id?: string } | undefined)?.id;
  if (!id) return null;
  return (await loadSplits(supabase, userId)).find((x) => x.id === id) ?? null;
}

// ── Linking a UPI payment to its bank alert (v25) ───────────────────────────

const DAY = 86_400_000;
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);

interface DebitRow {
  id: string;
  amount: number;
  category: string;
  merchant: string | null;
  expense_date: string;
  source: string | null;
  split_id: string | null;
}

/** Mark a captured debit as this payment: "Settle up", not spending. */
async function linkDebit(
  supabase: SupabaseClient,
  userId: number,
  paymentId: string,
  debit: DebitRow,
) {
  // Read before writing: undoing the payment puts this category back.
  const original = debit.category;
  await mustUpdate(supabase, "expenses", debit.id, userId, {
    category: SETTLE_UP,
    split_id: paymentId,
  });
  const { error } = await supabase
    .from("splits")
    .update({ expense_id: debit.id, category: original })
    .eq("id", paymentId)
    .eq("owner_id", userId);
  if (error) {
    await mustUpdate(supabase, "expenses", debit.id, userId, {
      category: original,
      split_id: null,
    });
    throw error;
  }
}

/**
 * Right after a Pay-button payment is recorded: the bank alert may already
 * be in. Same amount, a day either side, captured, not yet part of a split —
 * and the payee name points at this person, or it's the only candidate.
 */
async function linkRecentDebit(
  supabase: SupabaseClient,
  userId: number,
  payment: SplitRecord,
  person: Person,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("expenses")
    .select("id, amount, category, merchant, expense_date, source, split_id")
    .eq("user_id", userId)
    .eq("amount", fromPaise(payment.total))
    .gte("expense_date", shift(payment.split_date, -1))
    .is("split_id", null)
    .limit(20);
  if (error) throw error;
  const candidates = ((data ?? []) as DebitRow[]).filter(
    (e) =>
      e.expense_date <= shift(payment.split_date, 1) &&
      String(e.source ?? "").startsWith("auto_") &&
      e.category !== LENT &&
      e.category !== SETTLE_UP,
  );
  const named = candidates.filter(
    (e) =>
      nameScore(e.merchant, {
        name: person.name,
        bankNames: person.bank_names,
      }) >= 0.5,
  );
  const pick =
    named.length === 1
      ? named[0]
      : candidates.length === 1
        ? candidates[0]
        : null;
  if (!pick) return false;
  await linkDebit(supabase, userId, payment.id, pick);
  return true;
}

/**
 * Called by capture for every new debit: is it the bank's alert for a
 * payment you made from the Pay button? Same amount, within a day, still
 * unlinked. Only "upi" payments are considered — a cash settle-up has no
 * alert coming, so it can never grab an unrelated debit. Returns true when
 * the debit was filed as a settle-up.
 */
export async function linkUpiSettlement(
  supabase: SupabaseClient,
  userId: number,
  debit: DebitRow,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("splits")
    .select(SPLIT_COLUMNS)
    .eq("owner_id", userId)
    .eq("kind", "payment")
    .eq("via", "upi")
    .is("expense_id", null)
    .is("income_id", null)
    .gte("split_date", shift(debit.expense_date, -1))
    .limit(20);
  if (error) return false; // pre-v25: no via column — nothing to link
  const paise = toPaise(Number(debit.amount));
  const pending = (
    (data ?? []) as unknown as (SplitRecord & {
      split_members: SplitRecord["members"];
    })[]
  ).filter(
    (s) =>
      s.split_date <= shift(debit.expense_date, 1) &&
      Number(s.total) === paise &&
      (s.split_members ?? []).some(
        (m) => m.person_id === null && Number(m.paid) === paise,
      ),
  );
  if (!pending.length) return false;
  let pick = pending[0];
  if (pending.length > 1) {
    // Two payments of the same amount: let the payee name decide, or wait.
    const people = await listPeople(supabase, userId);
    const scored = pending
      .map((s) => {
        const to = s.split_members.find((m) => m.person_id)?.person_id;
        const p = people.find((x) => x.id === to);
        return {
          s,
          score: p
            ? nameScore(debit.merchant, {
                name: p.name,
                bankNames: p.bank_names,
              })
            : 0,
        };
      })
      .filter((x) => x.score >= 0.5);
    if (scored.length !== 1) return false;
    pick = scored[0].s;
  }
  await linkDebit(supabase, userId, pick.id, debit);
  return true;
}
