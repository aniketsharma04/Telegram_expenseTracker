import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { listInbox, markRead, unreadCount } from "@/lib/inbox";

export const dynamic = "force-dynamic";

/** The inbox, newest first, with the unread count. */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = createServiceClient();
  const [items, unread] = await Promise.all([
    listInbox(supabase, userId),
    unreadCount(supabase, userId),
  ]);
  return NextResponse.json({ items, unread });
}

/** Mark read: { ids: [...] }, or {} for everything. */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // An empty body means "all".
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 200)
    : undefined;

  try {
    await markRead(createServiceClient(), userId, ids);
    return NextResponse.json({ status: "read" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "update failed" },
      { status: 500 },
    );
  }
}
