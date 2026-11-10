import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { localDate } from "@/lib/parser";
import {
  createSplit,
  deleteSplit,
  loadSplitsSummary,
  setMyUpiId,
  splitForExpense,
  type NewSplit,
} from "@/lib/splits";
import { readJson, splitFailure } from "@/lib/split-http";

export const dynamic = "force-dynamic";

const METHODS = ["equal", "exact", "shares", "percent"] as const;

/** Balances, people, recent splits and repayments to confirm. ?expense=<id>: that expense's split. */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = createServiceClient();
  try {
    const expense = req.nextUrl.searchParams.get("expense");
    if (expense)
      return NextResponse.json({
        split: await splitForExpense(supabase, userId, expense),
      });
    return NextResponse.json(
      await loadSplitsSummary(supabase, userId, localDate()),
    );
  } catch (err) {
    return splitFailure(err);
  }
}

/**
 * Split an expense:
 *   { expenseId? | amount, category, merchant?, date },
 *   paidBy: "me" | personId, method, shares: [{ person, value? }], description?
 */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  if (!body)
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });

  const method = METHODS.find((m) => m === body.method) ?? "equal";
  const shares = Array.isArray(body.shares)
    ? (body.shares as Record<string, unknown>[])
        .filter((s) => s && typeof s.person === "string")
        .map((s) => ({
          person: s.person as string,
          value: s.value == null ? undefined : Number(s.value),
        }))
    : [];
  if (shares.length > 50)
    return NextResponse.json(
      { error: "Too many people in one split." },
      { status: 400 },
    );

  const input: NewSplit = {
    expenseId: typeof body.expenseId === "string" ? body.expenseId : undefined,
    amount: body.amount == null ? undefined : Number(body.amount),
    category: typeof body.category === "string" ? body.category : undefined,
    merchant: typeof body.merchant === "string" ? body.merchant : null,
    date: typeof body.date === "string" ? body.date : localDate(),
    description: typeof body.description === "string" ? body.description : null,
    paidBy: typeof body.paidBy === "string" ? body.paidBy : "me",
    method,
    shares,
  };
  if (
    input.amount != null &&
    !(input.amount > 0 && input.amount <= 100_000_000)
  )
    return NextResponse.json({ error: "Enter an amount." }, { status: 400 });

  const supabase = createServiceClient();
  try {
    const split = await createSplit(supabase, userId, input);
    return NextResponse.json({ split });
  } catch (err) {
    return splitFailure(err);
  }
}

/** Your UPI ID for "pay me back" links: { upi_id: "name@bank" | null }. */
export async function PATCH(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  if (!body || !("upi_id" in body))
    return NextResponse.json({ error: "missing upi_id" }, { status: 400 });
  const supabase = createServiceClient();
  try {
    await setMyUpiId(
      supabase,
      userId,
      typeof body.upi_id === "string" ? body.upi_id : null,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return splitFailure(err);
  }
}

/** Remove a split or payment (?id=), putting the money rows back. */
export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const supabase = createServiceClient();
  try {
    await deleteSplit(supabase, userId, id);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return splitFailure(err);
  }
}
