import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { localDate } from "@/lib/parser";
import {
  archiveGoal,
  getGoals,
  goalOutlook,
  monthlyFor,
  saveGoal,
} from "@/lib/goals";

export const dynamic = "force-dynamic";

/** Active goals with progress and when each will be reached. */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const today = localDate();
  const goals = await getGoals(createServiceClient(), userId);
  return NextResponse.json({
    goals: goals.map((g) => ({ ...g, ...goalOutlook(g, today) })),
  });
}

/**
 * Create or edit: { id?, name, target_amount, target_date?, monthly? }.
 * With a date and no monthly amount, the monthly amount is worked out.
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const target = Number(body.target_amount);
  const date =
    typeof body.target_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.target_date)
      ? body.target_date
      : null;
  if (!name)
    return NextResponse.json({ error: "missing name" }, { status: 400 });
  if (!Number.isFinite(target) || target <= 0 || target > 1_000_000_000)
    return NextResponse.json({ error: "invalid target" }, { status: 400 });

  const today = localDate();
  if (date && date <= today)
    return NextResponse.json(
      { error: "the date should be in the future" },
      { status: 400 },
    );

  const supabase = createServiceClient();
  const existing =
    typeof body.id === "string"
      ? (await getGoals(supabase, userId)).find((g) => g.id === body.id)
      : undefined;
  if (typeof body.id === "string" && !existing)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  let monthly =
    body.monthly === undefined || body.monthly === null
      ? NaN
      : Number(body.monthly);
  if (!Number.isFinite(monthly)) {
    if (!date)
      return NextResponse.json(
        { error: "give a monthly amount or a date" },
        { status: 400 },
      );
    monthly = monthlyFor(target, existing?.saved ?? 0, date, today);
  }
  if (monthly < 0 || monthly > target)
    return NextResponse.json(
      { error: "invalid monthly amount" },
      { status: 400 },
    );

  try {
    const goal = await saveGoal(supabase, userId, {
      id: existing?.id,
      name,
      target_amount: Math.round(target),
      monthly: Math.round(monthly),
      target_date: date,
    });
    return NextResponse.json({
      goal: { ...goal, ...goalOutlook(goal, today) },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "save failed" },
      { status: 500 },
    );
  }
}

/** Stop a goal: ?id=<uuid>. What it saved stays saved — it's your money. */
export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  try {
    const removed = await archiveGoal(createServiceClient(), userId, id);
    return NextResponse.json({ removed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "delete failed" },
      { status: 500 },
    );
  }
}
