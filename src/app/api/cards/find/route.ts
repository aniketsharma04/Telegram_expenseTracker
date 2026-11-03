import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { CardInputError, findForUser } from "@/lib/cards/service";

export const dynamic = "force-dynamic";

/**
 * Card Finder: POST the quiz answers, get the best three cards for them —
 * scored on the user's own spending when there's enough of it.
 *
 * { goal, fee, platform, upi, spend, useMySpending }
 *
 * Read-only: nothing is stored, nothing is sent to a bank.
 */
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
  try {
    return NextResponse.json(
      await findForUser(createServiceClient(), userId, body),
    );
  } catch (err) {
    if (err instanceof CardInputError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    const message = err instanceof Error ? err.message : "finder failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
