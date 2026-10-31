import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { localDate } from "@/lib/parser";
import {
  decideFoundSubscription,
  decideSubscription,
  findSubscriptions,
  listSubscriptions,
  monthlyTotal,
  subscriptionView,
  yearlySaved,
} from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 190;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Supabase errors are plain objects, not Error instances. */
function messageOf(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === "string" ? m : fallback;
}

async function load(userId: number) {
  const supabase = createServiceClient();
  const today = localDate();
  const { data: expenses, error } = await supabase
    .from("expenses")
    .select("amount, category, merchant, expense_date")
    .eq("user_id", userId)
    .gte("expense_date", localDate(LOOKBACK_DAYS));
  if (error) throw error;
  const stored = await listSubscriptions(supabase, userId);
  const found = findSubscriptions(expenses ?? [], today);
  return { supabase, stored, found };
}

/** Subscriptions with totals. Read-only: new finds aren't saved until decided. */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  try {
    const { stored, found } = await load(userId);
    return NextResponse.json({
      subscriptions: subscriptionView(stored, found),
      monthly: monthlyTotal(stored),
      yearly_saved: yearlySaved(stored),
    });
  } catch (err) {
    return fail(messageOf(err, "list failed"), 500);
  }
}

/** Keep or cancel: { id | merchant_key, decision: "keep" | "cancel" }. */
export async function PATCH(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("invalid JSON");
  }
  const decision = body.decision;
  if (decision !== "keep" && decision !== "cancel")
    return fail('decision must be "keep" or "cancel"');

  try {
    const { supabase, found } = await load(userId);
    if (typeof body.id === "string" && body.id) {
      const sub = await decideSubscription(supabase, userId, body.id, decision);
      return sub
        ? NextResponse.json({ subscription: sub })
        : fail("not found", 404);
    }
    if (typeof body.merchant_key === "string" && body.merchant_key) {
      const f = found.find((x) => x.merchant_key === body.merchant_key);
      if (!f) return fail("not found", 404);
      const sub = await decideFoundSubscription(supabase, userId, f, decision);
      return NextResponse.json({ subscription: sub });
    }
    return fail("id or merchant_key is required");
  } catch (err) {
    return fail(messageOf(err, "update failed"), 500);
  }
}
