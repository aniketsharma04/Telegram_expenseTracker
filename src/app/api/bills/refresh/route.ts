import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { localDate } from "@/lib/parser";
import { getBills, loadBillStatuses, refreshBill } from "@/lib/bills";
import { getBbpsProvider } from "@/lib/bbps";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Re-fetch one linked bill now: { id } → { fetch, bill (status) } */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (typeof body.id !== "string")
    return NextResponse.json({ error: "missing id" }, { status: 400 });

  const supabase = createServiceClient();
  const bill = (await getBills(supabase, userId)).find((b) => b.id === body.id);
  if (!bill) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!bill.biller_id)
    return NextResponse.json(
      { error: "bill isn't linked to a biller" },
      { status: 400 },
    );

  const fetch = await refreshBill(
    supabase,
    getBbpsProvider(supabase),
    userId,
    bill,
  );
  const status = (await loadBillStatuses(supabase, userId, localDate())).find(
    (b) => b.id === bill.id,
  );
  return NextResponse.json({ fetch, bill: status ?? null });
}
