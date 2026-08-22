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
  },
): Promise<Income> {
  const { data, error } = await supabase
    .from("incomes")
    .insert({ user_id: userId, ...entry })
    .select("id, user_id, amount, source, income_date, logged_at")
    .single();
  if (error) throw error;
  return data as Income;
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
