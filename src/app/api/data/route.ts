import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase-server";
import { getFamily, familyMembers } from "@/lib/family";
import { localDate } from "@/lib/parser";

export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 180;

/**
 * Single scoped payload for the dashboard (and, later, the mobile app):
 * the signed-in user, their family + members, categories, and every expense
 * belonging to the member set. Auth via the session cookie — the browser
 * never talks to the database directly.
 */
export async function GET(req: NextRequest) {
  // Cookie session (web) or Bearer token (mobile app) — same signed format.
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const userId = verifyToken(req.cookies.get(COOKIE_NAME)?.value) ?? verifyToken(bearer);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: users, error: userError } = await supabase
    .from("users")
    .select("id, first_name, username")
    .eq("id", userId)
    .limit(1);
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });
  const user = users?.[0];
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const family = await getFamily(supabase, userId);
  const members = family ? await familyMembers(supabase, family.id) : [];
  const memberIds = family ? members.map((m) => m.id) : [userId];

  const [expRes, catRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, user_id, amount, category, merchant, expense_date, logged_at, source")
      .in("user_id", memberIds)
      .gte("expense_date", localDate(LOOKBACK_DAYS))
      .order("logged_at", { ascending: false }),
    supabase.from("categories").select("name, color"),
  ]);
  if (expRes.error) return NextResponse.json({ error: expRes.error.message }, { status: 500 });
  if (catRes.error) return NextResponse.json({ error: catRes.error.message }, { status: 500 });

  return NextResponse.json({
    user: { id: user.id, name: user.first_name || user.username || "You" },
    family: family
      ? {
          id: family.id,
          name: family.name,
          role: family.role,
          invite_code: family.invite_code,
          members,
        }
      : null,
    categories: catRes.data ?? [],
    expenses: expRes.data ?? [],
    today: localDate(),
  });
}
