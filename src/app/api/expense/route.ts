import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { localDate } from "@/lib/parser";
import {
  logExpenseFromText,
  logSplitExpense,
  insertExpense,
  deleteExpenseScoped,
  loadCategories,
  learnKeyword,
} from "@/lib/log-expense";
import { collectBudgetAlerts, pushAlertsToTelegram } from "@/lib/budgets";
import { getFamily, familyMembers } from "@/lib/family";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // free-text mode may call the LLM fallback

/** After any successful log: budget alerts → Telegram ping + API response. */
async function alertsFor(userId: number): Promise<string[]> {
  const supabase = createServiceClient();
  const alerts = await collectBudgetAlerts(supabase, userId);
  if (alerts.length > 0) await pushAlertsToTelegram(userId, alerts);
  return alerts;
}

/**
 * Log an expense from the app (mobile or web dashboard).
 *
 * Body shapes:
 *   { text: "250 groceries yesterday" }             → same rules→LLM pipeline as the bot
 *   { amount, category, merchant?, expense_date?,
 *     split?: true }                                → form entry; split = equal family split
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
    const alerts = result.status === "logged" ? await alertsFor(userId) : [];
    return NextResponse.json({ ...result, alerts });
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

  // Split mode: equal shares across the family, payer covers rounding.
  if (body.split === true) {
    const family = await getFamily(supabase, userId);
    if (!family) {
      return NextResponse.json({ error: "no family to split with" }, { status: 400 });
    }
    const members = await familyMembers(supabase, family.id);
    if (members.length < 2) {
      return NextResponse.json({ error: "family has no other members" }, { status: 400 });
    }
    const split = await logSplitExpense(
      supabase,
      userId,
      members.map((m) => m.id),
      {
        amount,
        category,
        merchant,
        expense_date,
        raw_message: `[app split] ${amount} ${category}${merchant ? ` ${merchant}` : ""}`,
        source: "app_form",
        parsed_by: "user",
      },
    );
    const alerts = await alertsFor(userId);
    return NextResponse.json({
      status: "logged",
      expense: split.payerShare,
      nudge: false,
      split: { perHead: split.perHead, count: split.count, total: amount },
      alerts,
    });
  }

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
  const alerts = await alertsFor(userId);
  return NextResponse.json({ status: "logged", expense, nudge: false, alerts });
}

/** Edit one of your own expenses: amount, category, merchant, and/or date. */
export async function PATCH(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const patch: Record<string, unknown> = {};

  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
      return NextResponse.json({ error: "invalid amount" }, { status: 400 });
    }
    patch.amount = amount;
  }

  let learnedCategory: string | null = null;
  if (body.category !== undefined) {
    const categories = await loadCategories(supabase);
    const match = categories.find(
      (c) =>
        typeof body.category === "string" &&
        c.name.toLowerCase() === body.category.trim().toLowerCase(),
    );
    if (!match) return NextResponse.json({ error: "unknown category" }, { status: 400 });
    patch.category = match.name;
    learnedCategory = match.name;
  }

  if (body.merchant !== undefined) {
    patch.merchant =
      typeof body.merchant === "string" && body.merchant.trim()
        ? body.merchant.trim().slice(0, 80)
        : null;
  }

  if (body.expense_date !== undefined) {
    if (
      typeof body.expense_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.expense_date)
    ) {
      return NextResponse.json({ error: "invalid date" }, { status: 400 });
    }
    patch.expense_date = body.expense_date;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("expenses")
    .update(patch)
    .eq("id", body.id)
    .eq("user_id", userId)
    .select("id, amount, category, merchant, expense_date")
    .limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const expense = data?.[0];
  if (!expense) return NextResponse.json({ error: "not found" }, { status: 404 });

  // A manual correction is the strongest categorization signal — learn from it.
  if (learnedCategory && expense.merchant) {
    const categories = await loadCategories(supabase);
    await learnKeyword(supabase, categories, learnedCategory, expense.merchant);
  }

  const alerts = await alertsFor(userId);
  return NextResponse.json({ status: "updated", expense, alerts });
}

/** Undo: delete one of your own expenses (payer deleting a split removes the group). */
export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const supabase = createServiceClient();
  try {
    const removed = await deleteExpenseScoped(supabase, userId, id);
    return NextResponse.json({ deleted: removed > 0, removed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "delete failed" },
      { status: 500 },
    );
  }
}
