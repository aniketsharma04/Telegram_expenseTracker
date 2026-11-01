import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import {
  applyCardAction,
  CardInputError,
  loadCards,
  type CardAction,
} from "@/lib/cards/service";

export const dynamic = "force-dynamic";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function messageOf(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  const m = (err as { message?: unknown } | null)?.message;
  return typeof m === "string" ? m : fallback;
}

/** Aaj Cards: your cards, missed rewards, next-card picks and the catalogue. */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  try {
    return NextResponse.json(await loadCards(createServiceClient(), userId));
  } catch (err) {
    return fail(messageOf(err, "cards failed"), 500);
  }
}

/**
 * { action: "confirm", bank, last4, product_key } — "this is my card"
 * { action: "dismiss", bank, last4 }              — "not mine / not a credit card"
 * { action: "add", bank, product_key }            — a card with no alerts yet
 * { action: "set_product", id, product_key }
 * { action: "hide" | "remove", id }
 * { action: "profile", score_band?, monthly_income? }
 * { action: "clear_stress" }                     — "this is wrong" on the stress card
 * { action: "forget" }                           — delete all cards and the card profile
 * Returns the refreshed view.
 */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  let body: CardAction;
  try {
    body = await req.json();
  } catch {
    return fail("invalid JSON");
  }
  if (!body || typeof body !== "object" || typeof body.action !== "string")
    return fail("action is required");
  const supabase = createServiceClient();
  try {
    await applyCardAction(supabase, userId, body);
    return NextResponse.json(await loadCards(supabase, userId));
  } catch (err) {
    if (err instanceof CardInputError) return fail(err.message);
    return fail(messageOf(err, "update failed"), 500);
  }
}
