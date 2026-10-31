import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { flipExpenseToIncome, flipIncomeToExpense } from "@/lib/flip";

export const dynamic = "force-dynamic";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Wrong way round? { expense_id } becomes money received,
 * { income_id } becomes money spent.
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

  const supabase = createServiceClient();
  try {
    const result =
      typeof body.expense_id === "string" && body.expense_id
        ? await flipExpenseToIncome(supabase, userId, body.expense_id)
        : typeof body.income_id === "string" && body.income_id
          ? await flipIncomeToExpense(supabase, userId, body.income_id)
          : null;
    if (!result) return fail("expense_id or income_id is required");
    if (result.status === "not_found") return fail("not found", 404);
    if (result.status === "refused") return fail(result.reason, 409);
    return NextResponse.json(result);
  } catch (err) {
    const m = (err as { message?: unknown } | null)?.message;
    return fail(typeof m === "string" ? m : "flip failed", 500);
  }
}
