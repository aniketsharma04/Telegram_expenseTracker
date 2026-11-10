import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { localDate } from "@/lib/parser";
import { dismissRepayment, recordPayment } from "@/lib/splits";
import { readJson, splitFailure } from "@/lib/split-http";

export const dynamic = "force-dynamic";

/**
 * Settle up:
 *   { personId, direction: "they_paid" | "i_paid", amount?, date?, incomeId?, expenseId? }
 * Or answer "is this a repayment?" with No:
 *   { dismissIncomeId }
 */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  if (!body)
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  const supabase = createServiceClient();
  try {
    if (typeof body.dismissIncomeId === "string") {
      await dismissRepayment(supabase, userId, body.dismissIncomeId);
      return NextResponse.json({ ok: true });
    }
    if (typeof body.personId !== "string")
      return NextResponse.json({ error: "missing personId" }, { status: 400 });
    const direction = body.direction === "i_paid" ? "i_paid" : "they_paid";
    const amount = body.amount == null ? undefined : Number(body.amount);
    if (amount != null && !(amount > 0 && amount <= 100_000_000))
      return NextResponse.json({ error: "Enter an amount." }, { status: 400 });
    const payment = await recordPayment(
      supabase,
      userId,
      {
        personId: body.personId,
        direction,
        amount,
        date: typeof body.date === "string" ? body.date : undefined,
        incomeId: typeof body.incomeId === "string" ? body.incomeId : undefined,
        expenseId:
          typeof body.expenseId === "string" ? body.expenseId : undefined,
        via:
          body.via === "upi" ? "upi" : body.via === "cash" ? "cash" : undefined,
      },
      localDate(),
    );
    return NextResponse.json({ payment });
  } catch (err) {
    return splitFailure(err);
  }
}
