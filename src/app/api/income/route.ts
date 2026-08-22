import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { localDate } from "@/lib/parser";
import { logIncome, deleteIncome } from "@/lib/income";

export const dynamic = "force-dynamic";

/** Log income: { amount, source?, income_date? }. Income is personal, never family-shared. */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }
  const source =
    typeof body.source === "string" && body.source.trim()
      ? body.source.trim().slice(0, 80)
      : null;
  const income_date =
    typeof body.income_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.income_date)
      ? body.income_date
      : localDate();

  const supabase = createServiceClient();
  try {
    const income = await logIncome(supabase, userId, {
      amount,
      source,
      income_date,
      raw_message: `[app] income ${amount}${source ? ` ${source}` : ""}`,
      channel: "app_form",
    });
    return NextResponse.json({ status: "logged", income });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "income insert failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const supabase = createServiceClient();
  try {
    const deleted = await deleteIncome(supabase, userId, id);
    return NextResponse.json({ deleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "delete failed" },
      { status: 500 },
    );
  }
}
