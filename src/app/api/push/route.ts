import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { registerPushToken, unregisterPushToken } from "@/lib/inbox";

export const dynamic = "force-dynamic";

/** Register this device: { token: "ExponentPushToken[…]", platform: "android" | "ios" }. */
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
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const platform = body.platform === "ios" ? "ios" : body.platform === "android" ? "android" : null;
  if (!token || !platform)
    return NextResponse.json({ error: "token and platform required" }, { status: 400 });

  try {
    const ok = await registerPushToken(createServiceClient(), userId, token, platform);
    if (!ok) return NextResponse.json({ error: "not an Expo push token" }, { status: 400 });
    return NextResponse.json({ status: "registered" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "register failed" },
      { status: 500 },
    );
  }
}

/** Forget this device (logout): ?token=ExponentPushToken[…] */
export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });
  try {
    await unregisterPushToken(createServiceClient(), userId, token);
    return NextResponse.json({ status: "removed" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "remove failed" },
      { status: 500 },
    );
  }
}
