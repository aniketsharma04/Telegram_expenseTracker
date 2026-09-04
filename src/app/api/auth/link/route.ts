import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { issueLinkCode } from "@/lib/identity";

export const dynamic = "force-dynamic";

/**
 * Issue a short code the user sends to the bot as `/link ABC123`, attaching
 * that Telegram chat to this account.
 *
 * This is what makes Telegram a *channel* rather than the login: someone who
 * signed up by email can still get reminders in Telegram, and someone who
 * started on Telegram never needs this at all.
 */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const code = await issueLinkCode(createServiceClient(), userId);
  if (!code)
    return NextResponse.json(
      { error: "Couldn't create a link code right now." },
      { status: 500 },
    );

  return NextResponse.json({
    code,
    expires_in_minutes: 15,
    instructions: `Send /link ${code} to the bot within 15 minutes.`,
  });
}
