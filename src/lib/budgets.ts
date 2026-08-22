import { SupabaseClient } from "@supabase/supabase-js";
import { localDate } from "./parser";
import { budgetProgress, BudgetLike, NON_SPEND_CATEGORIES } from "./insights";
import { sendMessage } from "./telegram";

/**
 * Per-user budgets with 80%/100% alerts. Every table access is wrapped so the
 * feature silently no-ops until the v4 migration is applied.
 */

export interface Budget extends BudgetLike {
  user_id: number;
}

export async function getBudgets(
  supabase: SupabaseClient,
  userId: number,
): Promise<Budget[]> {
  try {
    const { data, error } = await supabase
      .from("budgets")
      .select("id, user_id, category, monthly_cap")
      .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []) as Budget[];
  } catch (err) {
    console.error("getBudgets failed (migration applied?)", err);
    return [];
  }
}

export async function setBudget(
  supabase: SupabaseClient,
  userId: number,
  category: string | null,
  monthlyCap: number,
): Promise<Budget> {
  // Upsert by hand — the unique index uses coalesce(), which upsert can't target.
  const match = supabase
    .from("budgets")
    .select("id")
    .eq("user_id", userId);
  const { data: existing, error: findError } = await (category
    ? match.eq("category", category)
    : match.is("category", null));
  if (findError) throw findError;

  if (existing && existing.length > 0) {
    const { data, error } = await supabase
      .from("budgets")
      .update({ monthly_cap: monthlyCap })
      .eq("id", existing[0].id)
      .select("id, user_id, category, monthly_cap")
      .single();
    if (error) throw error;
    return data as Budget;
  }
  const { data, error } = await supabase
    .from("budgets")
    .insert({ user_id: userId, category, monthly_cap: monthlyCap })
    .select("id, user_id, category, monthly_cap")
    .single();
  if (error) throw error;
  return data as Budget;
}

export async function removeBudget(
  supabase: SupabaseClient,
  userId: number,
  category: string | null,
): Promise<boolean> {
  const del = supabase.from("budgets").delete().eq("user_id", userId);
  const { data, error } = await (category
    ? del.eq("category", category)
    : del.is("category", null)
  ).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * After an expense insert: which budget thresholds (80/100) did this month's
 * spending just cross, that we haven't alerted about yet? Marks them sent and
 * returns plain-text alert lines (no HTML) for the channel to deliver.
 */
export async function collectBudgetAlerts(
  supabase: SupabaseClient,
  userId: number,
): Promise<string[]> {
  try {
    const budgets = await getBudgets(supabase, userId);
    if (budgets.length === 0) return [];

    const today = localDate();
    const monthStart = `${today.slice(0, 7)}-01`;
    const month = today.slice(0, 7);

    const { data, error } = await supabase
      .from("expenses")
      .select("amount, category, expense_date")
      .eq("user_id", userId)
      .gte("expense_date", monthStart);
    if (error) throw error;

    const progress = budgetProgress(
      budgets,
      (data ?? []).map((e) => ({ ...e, merchant: null })),
      today,
    );

    const alerts: string[] = [];
    for (const b of progress) {
      for (const level of [100, 80]) {
        if (b.pct * 100 < level) continue;
        // Dedup: primary key (budget_id, month, level) makes the insert fail
        // the second time — that's the "already sent" signal.
        const { error: dupError } = await supabase
          .from("budget_alerts")
          .insert({ budget_id: b.id, month, level });
        if (dupError) break; // already alerted at this level (or table missing)

        const label = b.category ?? "overall spending";
        alerts.push(
          level === 100
            ? `🚨 Budget blown: ${label} is at ₹${Math.round(b.spent).toLocaleString("en-IN")} of your ₹${Math.round(b.monthly_cap).toLocaleString("en-IN")} cap this month.`
            : `⚠️ Heads up: ${label} has hit ${Math.round(b.pct * 100)}% of your ₹${Math.round(b.monthly_cap).toLocaleString("en-IN")} monthly cap.`,
        );
        break; // only the highest newly-crossed level per budget
      }
    }
    return alerts;
  } catch (err) {
    console.error("collectBudgetAlerts failed (migration applied?)", err);
    return [];
  }
}

/** Deliver alerts over Telegram (used by app channels so the ping still arrives). */
export async function pushAlertsToTelegram(
  userId: number,
  alerts: string[],
): Promise<void> {
  for (const a of alerts) {
    try {
      await sendMessage(userId, a);
    } catch (err) {
      console.error("alert push failed", err);
    }
  }
}

export { NON_SPEND_CATEGORIES };
