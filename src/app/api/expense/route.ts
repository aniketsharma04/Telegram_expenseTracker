import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase-server";
import { localDate } from "@/lib/parser";
import {
  logExpenseFromText,
  insertExpense,
  loadCategories,
} from "@/lib/log-expense";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // free-text mode may call the LLM fallback

function authedUser(req: NextRequest): number | null {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  return verifyToken(req.cookies.get(COOKIE_NAME)?.value) ?? verifyToken(bearer);
}

/**
 * Log an expense from the app (mobile or web dashboard).
 *
 * Two body shapes:
 *   { text: "250 groceries yesterday" }        → same rules→LLM pipeline as the bot
 *   { amount: 250, category: "Groceries",
 *     merchant?: "More", expense_date?: "…" }  → direct form entry, no parsing
 */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Free-text mode — the bot's brain, minus the chat.
  if (typeof body.text === "string" && body.text.trim()) {
    const text = body.text.trim().slice(0, 500);
    const result = await logExpenseFromText(supabase, userId, text, "app_text");
    return NextResponse.json(result);
  }

  // Form mode — the app sends already-structured fields.
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }

  const categories = await loadCategories(supabase);
  const category = categories.find(
    (c) =>
      typeof body.category === "string" &&
      c.name.toLowerCase() === body.category.trim().toLowerCase(),
  )?.name;
  if (!category) {
    return NextResponse.json({ error: "unknown category" }, { status: 400 });
  }

  const merchant =
    typeof body.merchant === "string" && body.merchant.trim()
      ? body.merchant.trim().slice(0, 80)
      : null;

  const expense_date =
    typeof body.expense_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.expense_date)
      ? body.expense_date
      : localDate();

  const expense = await insertExpense(supabase, {
    amount,
    category,
    merchant,
    expense_date,
    user_id: userId,
    raw_message: `[app form] ${amount} ${category}${merchant ? ` ${merchant}` : ""}`,
    source: "app_form",
    parsed_by: "user",
  });
  return NextResponse.json({ status: "logged", expense, nudge: false });
}

/** Undo: delete one of your own expenses by id (never a family member's). */
export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: (data?.length ?? 0) > 0 });
}
