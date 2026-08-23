import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { localDate } from "@/lib/parser";
import { BILL_KINDS, BillKind, loadBillStatuses } from "@/lib/bills";
import { confirmDetected, dismissDetected, listDetected } from "@/lib/detected";

export const dynamic = "force-dynamic";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Pending detections awaiting confirm/dismiss (?status=linked|dismissed to review). */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  if (!["pending", "linked", "dismissed"].includes(status))
    return fail("invalid status");
  const detected = await listDetected(
    createServiceClient(),
    userId,
    status as "pending",
  );
  return NextResponse.json({ detected_bills: detected });
}

/**
 * Confirm a detection: { id, bill_id?, name?, kind?, amount?, due_day? }
 *
 * With `bill_id` the amount/due day land on that existing bill (a new
 * statement for something already tracked); without it a new bill is created.
 */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("invalid JSON");
  }
  if (typeof body.id !== "string") return fail("missing id");

  const overrides: Partial<{
    name: string;
    kind: BillKind;
    amount: number;
    due_day: number;
  }> = {};
  if (typeof body.name === "string" && body.name.trim())
    overrides.name = body.name.trim().slice(0, 60);
  if (body.kind !== undefined) {
    if (!BILL_KINDS.includes(body.kind as BillKind))
      return fail("invalid kind");
    overrides.kind = body.kind as BillKind;
  }
  if (body.amount !== undefined) {
    const a = Number(body.amount);
    if (!Number.isFinite(a) || a <= 0 || a > 100_000_000)
      return fail("invalid amount");
    overrides.amount = a;
  }
  if (body.due_day !== undefined) {
    const d = Number(body.due_day);
    if (!Number.isInteger(d) || d < 1 || d > 31)
      return fail("due_day must be 1–31");
    overrides.due_day = d;
  }

  try {
    const supabase = createServiceClient();
    const { bill, detected } = await confirmDetected(
      supabase,
      userId,
      body.id,
      typeof body.bill_id === "string" ? body.bill_id : null,
      overrides,
    );
    if (!detected) return fail("not found", 404);
    if (!bill) return fail("bill not found", 404);
    const status = (await loadBillStatuses(supabase, userId, localDate())).find(
      (b) => b.id === bill.id,
    );
    return NextResponse.json({
      status: "linked",
      bill: status ?? null,
      detected,
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "confirm failed", 500);
  }
}

/** Dismiss a detection so it stops coming back. */
export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("missing id");
  try {
    const dismissed = await dismissDetected(createServiceClient(), userId, id);
    return NextResponse.json({ dismissed });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "dismiss failed", 500);
  }
}
