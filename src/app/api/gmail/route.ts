import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { localDate } from "@/lib/parser";
import { gmailConfigured } from "@/lib/gmail";
import {
  disconnectGmail,
  getGmailAccount,
  listDetected,
  syncGmail,
} from "@/lib/detected";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Connection status for the Settings screen. The refresh token never leaves the server. */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  const account = await getGmailAccount(createServiceClient(), userId);
  return NextResponse.json({
    configured: gmailConfigured(),
    connected: Boolean(account),
    email: account?.email ?? null,
    last_sync_at: account?.last_sync_at ?? null,
    last_error: account?.last_error ?? null,
  });
}

/** Scan the inbox now. Returns the counts plus the refreshed pending list. */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  const supabase = createServiceClient();
  const result = await syncGmail(supabase, userId, localDate());
  if (result.error && result.detected === 0) return fail(result.error, 502);
  return NextResponse.json({
    ...result,
    detected_bills: await listDetected(supabase, userId),
  });
}

/** Unlink the mailbox. Detections already found are kept. */
export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  await disconnectGmail(createServiceClient(), userId);
  return NextResponse.json({ status: "disconnected" });
}
