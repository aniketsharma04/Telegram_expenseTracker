import { SupabaseClient } from "@supabase/supabase-js";
import { localDate } from "./parser";
import { getIncomes } from "./income";
import { getBills } from "./bills";
import { detectRecurring } from "./insights";
import {
  computeDailyStatus,
  type BudgetExpense,
  type CommitmentLike,
  type DailyStatus,
  type PlanLike,
} from "./daily-budget";

/**
 * The daily-budget plan (v14): DB access around the pure engine in
 * daily-budget.ts. Every read is wrapped so the feature quietly reports
 * "not set up" until the v14 migration is applied.
 */

export interface Plan extends PlanLike {
  user_id: number;
  morning_brief: boolean;
  evening_report: boolean;
  live_updates: boolean;
}

export interface Commitment extends CommitmentLike {
  user_id: number;
}

/** A fixed cost the app spotted but the user hasn't listed. */
export interface CommitmentSuggestion {
  name: string;
  amount: number;
  category: string | null;
  match: string | null;
  from: "recurring" | "bill";
}

const PLAN_COLUMNS =
  "user_id, monthly_income, savings_goal, morning_brief, evening_report, live_updates";
const COMMITMENT_COLUMNS = "id, user_id, name, amount, category, match";

export async function getPlan(
  supabase: SupabaseClient,
  userId: number,
): Promise<Plan | null> {
  try {
    const { data, error } = await supabase
      .from("budget_plans")
      .select(PLAN_COLUMNS)
      .eq("user_id", userId)
      .limit(1);
    if (error) throw error;
    const row = data?.[0];
    if (!row) return null;
    return {
      ...row,
      monthly_income: row.monthly_income == null ? null : Number(row.monthly_income),
      savings_goal: Number(row.savings_goal ?? 0),
    } as Plan;
  } catch (err) {
    console.error("getPlan failed (v14 migration applied?)", err);
    return null;
  }
}

export type PlanPatch = Partial<
  Pick<Plan, "monthly_income" | "savings_goal" | "morning_brief" | "evening_report" | "live_updates">
>;

export async function savePlan(
  supabase: SupabaseClient,
  userId: number,
  patch: PlanPatch,
): Promise<Plan> {
  const { data, error } = await supabase
    .from("budget_plans")
    .upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    )
    .select(PLAN_COLUMNS)
    .single();
  if (error) throw error;
  return {
    ...data,
    monthly_income: data.monthly_income == null ? null : Number(data.monthly_income),
    savings_goal: Number(data.savings_goal ?? 0),
  } as Plan;
}

export async function getCommitments(
  supabase: SupabaseClient,
  userId: number,
): Promise<Commitment[]> {
  try {
    const { data, error } = await supabase
      .from("commitments")
      .select(COMMITMENT_COLUMNS)
      .eq("user_id", userId)
      .eq("active", true)
      .order("amount", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((c) => ({ ...c, amount: Number(c.amount) })) as Commitment[];
  } catch (err) {
    console.error("getCommitments failed (v14 migration applied?)", err);
    return [];
  }
}

export async function addCommitment(
  supabase: SupabaseClient,
  userId: number,
  c: { name: string; amount: number; category?: string | null; match?: string | null },
): Promise<Commitment> {
  const name = c.name.trim().slice(0, 60);
  // Same name again = change the amount, not a second rent.
  const existing = (await getCommitments(supabase, userId)).find(
    (x) => x.name.toLowerCase() === name.toLowerCase(),
  );
  const row = {
    name,
    amount: c.amount,
    category: c.category ?? null,
    match: (c.match ?? defaultMatch(name))?.toLowerCase() ?? null,
  };
  const query = existing
    ? supabase.from("commitments").update(row).eq("id", existing.id).eq("user_id", userId)
    : supabase.from("commitments").insert({ user_id: userId, ...row });
  const { data, error } = await query.select(COMMITMENT_COLUMNS).single();
  if (error) throw error;
  return { ...data, amount: Number(data.amount) } as Commitment;
}

/** Remove by id, or by name (case-insensitive). Returns the removed name. */
export async function removeCommitment(
  supabase: SupabaseClient,
  userId: number,
  idOrName: string,
): Promise<string | null> {
  const target = (await getCommitments(supabase, userId)).find(
    (c) => c.id === idOrName || c.name.toLowerCase() === idOrName.trim().toLowerCase(),
  );
  if (!target) return null;
  const { error } = await supabase
    .from("commitments")
    .update({ active: false })
    .eq("id", target.id)
    .eq("user_id", userId);
  if (error) throw error;
  return target.name;
}

/** A name like "Rent" or "Netflix" is usually also the word in the payment. */
function defaultMatch(name: string): string | null {
  const word = name.trim().toLowerCase();
  return word.length >= 3 ? word : null;
}

function previousMonth(today: string): { start: string; end: string } {
  let [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1];
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  const mm = String(m).padStart(2, "0");
  const last = new Date(y, m, 0).getDate();
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${last}` };
}

/** Everything the daily number needs, loaded and computed for one user. */
export async function loadDailyStatus(
  supabase: SupabaseClient,
  userId: number,
  today: string = localDate(),
): Promise<{ status: DailyStatus; plan: Plan | null; commitments: Commitment[] }> {
  const prev = previousMonth(today);
  const [plan, commitments, expenses, incomes] = await Promise.all([
    getPlan(supabase, userId),
    getCommitments(supabase, userId),
    monthExpenses(supabase, userId, `${today.slice(0, 7)}-01`, today),
    getIncomes(supabase, userId, prev.start),
  ]);
  const lastMonthIncome = incomes
    .filter((i) => i.income_date <= prev.end)
    .reduce((s, i) => s + Number(i.amount), 0);

  return {
    status: computeDailyStatus({ plan, commitments, expenses, today, lastMonthIncome }),
    plan,
    commitments,
  };
}

async function monthExpenses(
  supabase: SupabaseClient,
  userId: number,
  from: string,
  to: string,
): Promise<BudgetExpense[]> {
  const select = (cols: string) =>
    supabase
      .from("expenses")
      .select(cols)
      .eq("user_id", userId)
      .gte("expense_date", from)
      .lte("expense_date", to)
      .order("logged_at");
  let res = await select("id, amount, category, merchant, expense_date, budget_scope");
  // Pre-v14: no budget_scope column — everything is decided automatically.
  if (res.error) res = await select("id, amount, category, merchant, expense_date");
  if (res.error) throw res.error;
  return ((res.data ?? []) as unknown as BudgetExpense[]).map((e) => ({
    ...e,
    amount: Number(e.amount),
  }));
}

/**
 * Fixed costs worth suggesting: active bills with an amount, and monthly
 * repeats the app has seen (Netflix, the SIP, rent by UPI) — minus what's
 * already listed.
 */
export async function suggestCommitments(
  supabase: SupabaseClient,
  userId: number,
  listed: Commitment[],
  today: string = localDate(),
): Promise<CommitmentSuggestion[]> {
  const [bills, { data: history }] = await Promise.all([
    getBills(supabase, userId),
    supabase
      .from("expenses")
      .select("amount, category, merchant, expense_date")
      .eq("user_id", userId)
      .gte("expense_date", localDate(120)),
  ]);

  const known = (s: string) => {
    const k = s.toLowerCase();
    return listed.some(
      (c) => c.name.toLowerCase() === k || (c.match && k.includes(c.match)),
    );
  };

  const out: CommitmentSuggestion[] = [];
  for (const b of bills) {
    const amount = Number(b.fetched_amount ?? b.amount ?? 0);
    if (amount <= 0 || known(b.name)) continue;
    out.push({ name: b.name, amount: Math.round(amount), category: b.category, match: null, from: "bill" });
  }
  for (const r of detectRecurring((history ?? []) as BudgetExpense[], today)) {
    if (r.category === "Investments" || known(r.merchant)) continue;
    if (out.some((o) => o.name.toLowerCase() === r.merchant.toLowerCase())) continue;
    out.push({
      name: r.merchant,
      amount: r.amount,
      category: r.category,
      match: r.merchant.toLowerCase(),
      from: "recurring",
    });
  }
  return out.slice(0, 8);
}

/** Mark one expense daily / fixed / savings (null = decide automatically). */
export async function setBudgetScope(
  supabase: SupabaseClient,
  userId: number,
  expenseId: string,
  scope: "daily" | "fixed" | "savings" | null,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("expenses")
    .update({ budget_scope: scope })
    .eq("id", expenseId)
    .eq("user_id", userId)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** Users who have a plan — the cron's mailing list. */
export async function plannedUsers(
  supabase: SupabaseClient,
): Promise<Plan[]> {
  try {
    const { data, error } = await supabase.from("budget_plans").select(PLAN_COLUMNS);
    if (error) throw error;
    return (data ?? []) as Plan[];
  } catch (err) {
    console.error("plannedUsers failed (v14 migration applied?)", err);
    return [];
  }
}
