import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { cleanCaptureReport } from "@/lib/capture-health";

export const dynamic = "force-dynamic";

/** The phone's capture status, sent on app open. Never message text. */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { error } = await createServiceClient()
    .from("capture_status")
    .upsert(
      {
        user_id: userId,
        reported_at: new Date().toISOString(),
        report: cleanCaptureReport(body),
      },
      { onConflict: "user_id" },
    );
  if (error) console.error("capture status failed", error);
  return NextResponse.json({ ok: !error });
}
