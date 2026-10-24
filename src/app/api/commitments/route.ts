import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { loadCategories } from "@/lib/log-expense";
import { addCommitment, loadDailyStatus, removeCommitment } from "@/lib/plan";

export const dynamic = "force-dynamic";

/** Add (or re-price) a fixed monthly cost: { name, amount, category?, match? }. */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const amount = Number(body.amount);
  if (!name) return NextResponse.json({ error: "missing name" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000)
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });

  const supabase = createServiceClient();
  let category: string | null = null;
  if (typeof body.category === "string" && body.category.trim()) {
    const categories = await loadCategories(supabase);
    category =
      categories.find(
        (c) => c.name.toLowerCase() === (body.category as string).trim().toLowerCase(),
      )?.name ?? null;
  }

  try {
    const commitment = await addCommitment(supabase, userId, {
      name,
      amount: Math.round(amount),
      category,
      match: typeof body.match === "string" ? body.match.trim() || null : undefined,
    });
    const { status, commitments } = await loadDailyStatus(supabase, userId);
    return NextResponse.json({ commitment, commitments, daily: status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "save failed" },
      { status: 500 },
    );
  }
}

/** Stop counting a fixed cost: ?id=<uuid> or ?name=Rent. */
export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const target =
    req.nextUrl.searchParams.get("id") ?? req.nextUrl.searchParams.get("name");
  if (!target) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const supabase = createServiceClient();
  try {
    const removed = await removeCommitment(supabase, userId, target);
    const { status, commitments } = await loadDailyStatus(supabase, userId);
    return NextResponse.json({ removed, commitments, daily: status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "delete failed" },
      { status: 500 },
    );
  }
}
