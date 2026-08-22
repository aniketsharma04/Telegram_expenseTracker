import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { loadCategories } from "@/lib/log-expense";
import { setBudget, removeBudget } from "@/lib/budgets";

export const dynamic = "force-dynamic";

/** Set a monthly cap: { category: string | null, monthly_cap: number }. null = overall. */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const cap = Number(body.monthly_cap);
  if (!Number.isFinite(cap) || cap <= 0 || cap > 1_000_000_000) {
    return NextResponse.json({ error: "invalid cap" }, { status: 400 });
  }

  const supabase = createServiceClient();
  let category: string | null = null;
  if (body.category != null) {
    const categories = await loadCategories(supabase);
    const match = categories.find(
      (c) =>
        typeof body.category === "string" &&
        c.name.toLowerCase() === body.category.trim().toLowerCase(),
    );
    if (!match) return NextResponse.json({ error: "unknown category" }, { status: 400 });
    category = match.name;
  }

  try {
    const budget = await setBudget(supabase, userId, category, cap);
    return NextResponse.json({ status: "set", budget });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "budget save failed" },
      { status: 500 },
    );
  }
}

/** Remove a cap: ?category=Groceries, or ?category=overall (the overall cap). */
export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const raw = req.nextUrl.searchParams.get("category");
  if (!raw) return NextResponse.json({ error: "missing category" }, { status: 400 });
  const category = raw.toLowerCase() === "overall" ? null : raw;

  const supabase = createServiceClient();
  try {
    const deleted = await removeBudget(supabase, userId, category);
    return NextResponse.json({ deleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "delete failed" },
      { status: 500 },
    );
  }
}
