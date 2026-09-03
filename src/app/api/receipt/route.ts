import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { getReceipt, topItems } from "@/lib/receipts";
import { localDate } from "@/lib/parser";

export const dynamic = "force-dynamic";

/**
 * The bill behind one expense:      /api/receipt?expense_id=…
 * What you actually order, ranked:  /api/receipt?top=1&days=90
 *
 * Kept off /api/data deliberately — line items are only wanted when someone
 * opens a transaction, and shipping every line on every refresh would bloat
 * the payload for a view most people never open.
 */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const params = req.nextUrl.searchParams;

  if (params.get("top")) {
    const days = Number(params.get("days") ?? 90);
    const since = localDate(Number.isFinite(days) ? Math.min(days, 730) : 90);
    return NextResponse.json({
      items: await topItems(supabase, userId, since),
    });
  }

  const expenseId = params.get("expense_id");
  if (!expenseId)
    return NextResponse.json({ error: "missing expense_id" }, { status: 400 });

  // A missing receipt is a normal answer, not an error: most expenses are
  // typed in and never had a bill behind them.
  return NextResponse.json({
    receipt: await getReceipt(supabase, userId, expenseId),
  });
}
