import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { signToken } from "@/lib/auth";
import { authUrl, gmailConfigured } from "@/lib/gmail";

export const dynamic = "force-dynamic";

/**
 * Start the Gmail consent flow.
 *
 * `?json=1` returns the URL instead of redirecting — the mobile app opens it
 * in a system browser (Bearer tokens don't survive a redirect chain).
 * The OAuth `state` is a short-lived signed token, so the callback knows who
 * came back without trusting anything in the query string.
 */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!gmailConfigured())
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set" },
      { status: 503 },
    );

  const url = authUrl(signToken(userId, 600));
  return req.nextUrl.searchParams.get("json")
    ? NextResponse.json({ url })
    : NextResponse.redirect(url);
}
