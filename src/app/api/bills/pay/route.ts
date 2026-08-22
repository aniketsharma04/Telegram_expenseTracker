import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { localDate } from "@/lib/parser";
import { markBillPaid, unmarkBillPaid } from "@/lib/bills";
import { collectBudgetAlerts, pushAlertsToTelegram } from "@/lib/budgets";

export const dynamic = "force-dynamic";

/** Mark a bill paid: { bill_id, amount, paid_on? } → logs the expense + records the payment. */
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
  if (typeof body.bill_id !== "string") {
    return NextResponse.json({ error: "missing bill_id" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }
  const paid_on =
    typeof body.paid_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.paid_on)
      ? body.paid_on
      : localDate();

  const supabase = createServiceClient();
  try {
    const result = await markBillPaid(
      supabase,
      userId,
      body.bill_id,
      amount,
      paid_on,
      "app_bill",
    );
    const alerts = await collectBudgetAlerts(supabase, userId);
    if (alerts.length > 0) await pushAlertsToTelegram(userId, alerts);
    return NextResponse.json({ status: "paid", ...result, alerts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "mark paid failed";
    return NextResponse.json(
      { error: message },
      { status: message === "bill not found" ? 404 : 500 },
    );
  }
}

/** Undo a mark-paid: ?id=<payment id>. Removes the payment and its expense. */
export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  try {
    const deleted = await unmarkBillPaid(createServiceClient(), userId, id);
    return NextResponse.json({ deleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "undo failed" },
      { status: 500 },
    );
  }
}
