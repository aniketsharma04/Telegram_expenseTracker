import { SupabaseClient } from "@supabase/supabase-js";

/** Income entries — personal only (family aggregation applies to expenses, not income). */

export interface Income {
  id: string;
  user_id: number;
  amount: number;
  source: string | null;
  income_date: string;
  logged_at: string;
}

export async function logIncome(
  supabase: SupabaseClient,
  userId: number,
  entry: {
    amount: number;
    source: string | null;
    income_date: string;
    raw_message: string;
    channel: string;
    /** Which account the money landed in (v8). */
    account_id?: string | null;
  },
): Promise<Income> {
  const { data, error } = await supabase
    .from("incomes")
    .insert({ user_id: userId, ...entry })
    .select("id, user_id, amount, source, income_date, logged_at")
    .single();
  if (!error) return data as Income;

  // Pre-v8 schema has no account_id — record the income anyway.
  if (entry.account_id !== undefined) {
    const { account_id: _dropped, ...legacy } = entry;
    const retry = await supabase
      .from("incomes")
      .insert({ user_id: userId, ...legacy })
      .select("id, user_id, amount, source, income_date, logged_at")
      .single();
    if (!retry.error) return retry.data as Income;
  }
  throw error;
}

export async function getIncomes(
  supabase: SupabaseClient,
  userId: number,
  sinceDate: string,
): Promise<Income[]> {
  try {
    const { data, error } = await supabase
      .from("incomes")
      .select("id, user_id, amount, source, income_date, logged_at")
      .eq("user_id", userId)
      .gte("income_date", sinceDate)
      .order("income_date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Income[];
  } catch (err) {
    console.error("getIncomes failed (migration applied?)", err);
    return [];
  }
}

export async function deleteIncome(
  supabase: SupabaseClient,
  userId: number,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("incomes")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
