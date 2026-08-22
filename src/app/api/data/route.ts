import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { getFamily, familyMembers } from "@/lib/family";
import { localDate } from "@/lib/parser";
import { getBudgets } from "@/lib/budgets";
import { getIncomes } from "@/lib/income";
import { budgetProgress, detectAnomalies, detectRecurring } from "@/lib/insights";

export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 180;

/**
 * Single scoped payload for the dashboard (and, later, the mobile app):
 * the signed-in user, their family + members, categories, and every expense
 * belonging to the member set. Auth via the session cookie — the browser
 * never talks to the database directly.
 */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, first_name, username")
    .eq("id", userId)
    .limit(1);
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  const user = users?.[0];
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const family = await getFamily(supabase, userId);
  const members = family ? await familyMembers(supabase, family.id) : [];
  const memberIds = family ? members.map((m) => m.id) : [userId];

  const since = localDate(LOOKBACK_DAYS);
  let [expRes, catRes] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "id, user_id, amount, category, merchant, expense_date, logged_at, source, paid_by, split_id",
      )
      .in("user_id", memberIds)
      .gte("expense_date", since)
      .order("logged_at", { ascending: false }),
    supabase.from("categories").select("name, color"),
  ]);
  if (expRes.error) {
    // Pre-migration schema without split columns — retry with the old shape.
    expRes = (await supabase
      .from("expenses")
      .select("id, user_id, amount, category, merchant, expense_date, logged_at, source")
      .in("user_id", memberIds)
      .gte("expense_date", since)
      .order("logged_at", { ascending: false })) as typeof expRes;
  }
  if (expRes.error) return NextResponse.json({ error: expRes.error.message }, { status: 500 });
  if (catRes.error) return NextResponse.json({ error: catRes.error.message }, { status: 500 });

  // v4 extras — all personal-scope, all tolerant of the migration not being applied yet.
  const today = localDate();
  const expenses = expRes.data ?? [];
  const mine = expenses.filter((e) => e.user_id === userId);
  let [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1];
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  const incomeSince = `${y}-${String(m).padStart(2, "0")}-01`; // last month + this month
  const [budgets, incomes] = await Promise.all([
    getBudgets(supabase, userId),
    getIncomes(supabase, userId, incomeSince),
  ]);

  return NextResponse.json({
    user: { id: user.id, name: user.first_name || user.username || "You" },
    family: family
      ? {
          id: family.id,
          name: family.name,
          role: family.role,
          invite_code: family.invite_code,
          members,
        }
      : null,
    categories: catRes.data ?? [],
    expenses,
    today,
    budgets: budgetProgress(
      budgets.map((b) => ({ id: b.id, category: b.category, monthly_cap: Number(b.monthly_cap) })),
      mine,
      today,
    ),
    incomes: incomes.map((i) => ({
      id: i.id,
      amount: Number(i.amount),
      source: i.source,
      income_date: i.income_date,
    })),
    insights: {
      recurring: detectRecurring(mine, today).filter(
        (r) => r.daysUntil >= 0 && r.daysUntil <= 12,
      ),
      anomalies: detectAnomalies(mine, today),
    },
  });
}
