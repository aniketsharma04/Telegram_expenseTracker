import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { loadDailyStatus, savePlan, suggestCommitments, type PlanPatch } from "@/lib/plan";

export const dynamic = "force-dynamic";

/** The daily budget: today's number, the plan behind it, and fixed-cost suggestions. */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = createServiceClient();
  const { status, plan, commitments } = await loadDailyStatus(supabase, userId);
  const suggestions = await suggestCommitments(supabase, userId, commitments);
  return NextResponse.json({ daily: status, plan, commitments, suggestions });
}

/**
 * Change the plan: { monthly_income?, savings_goal?, payday?, morning_brief?,
 * evening_report?, live_updates? }. monthly_income: null = use last month's;
 * payday: null = calendar months.
 */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const patch: PlanPatch = {};
  const money = (v: unknown, allowZero: boolean) => {
    const n = Number(v);
    return Number.isFinite(n) && (allowZero ? n >= 0 : n > 0) && n <= 1_000_000_000
      ? Math.round(n)
      : null;
  };

  if (body.monthly_income !== undefined) {
    if (body.monthly_income === null) patch.monthly_income = null;
    else {
      const n = money(body.monthly_income, false);
      if (n === null)
        return NextResponse.json({ error: "invalid income" }, { status: 400 });
      patch.monthly_income = n;
    }
  }
  if (body.savings_goal !== undefined) {
    const n = money(body.savings_goal, true);
    if (n === null)
      return NextResponse.json({ error: "invalid savings goal" }, { status: 400 });
    patch.savings_goal = n;
  }
  // v16: salary day — the budget month starts on it. null = calendar months.
  if (body.payday !== undefined) {
    const day = body.payday === null ? null : Number(body.payday);
    if (day !== null && !(Number.isInteger(day) && day >= 1 && day <= 31))
      return NextResponse.json({ error: "payday must be 1–31" }, { status: 400 });
    patch.payday = day;
  }
  for (const key of ["morning_brief", "evening_report", "live_updates"] as const) {
    if (typeof body[key] === "boolean") patch[key] = body[key] as boolean;
  }
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const supabase = createServiceClient();
  try {
    await savePlan(supabase, userId, patch);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "plan save failed" },
      { status: 500 },
    );
  }
  const { status, plan, commitments } = await loadDailyStatus(supabase, userId);
  return NextResponse.json({ daily: status, plan, commitments });
}
