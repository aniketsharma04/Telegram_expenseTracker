import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { displayNameOf, getUser } from "@/lib/identity";
import { usageToday } from "@/lib/quota";
import {
  looksLikeGeminiKey,
  setUserGeminiKey,
  userGeminiKey,
} from "@/lib/ai-keys";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The account screen, and the two rights a real product owes its users:
 * take your data out, and delete it.
 *
 *   GET                    → profile, linked channels, today's usage
 *   GET  ?export=1         → every row belonging to this user, as JSON
 *   DELETE                 → erase the account and everything in it
 *
 * India's DPDP rules make export and erasure obligations rather than
 * niceties, but the honest reason to build them is simpler: a finance app
 * nobody can leave is one nobody should join.
 */

/** Tables that hang off a user, in a safe deletion order. */
const OWNED_TABLES = [
  // v15 first: a deleted account must stop getting pushes immediately.
  "push_tokens",
  "notifications",
  "commitments",
  "budget_plans",
  "receipt_items",
  "receipts",
  "bank_messages",
  "detected_bills",
  "bill_payments",
  "bills",
  "transfers",
  "budget_alerts",
  "budgets",
  "incomes",
  "expenses",
  "accounts",
  "gmail_accounts",
  "usage_counters",
  "user_api_keys",
  "family_members",
] as const;

/** Everything worth handing back in an export. */
const EXPORT_TABLES = [
  "expenses",
  "incomes",
  "accounts",
  "transfers",
  "bills",
  "bill_payments",
  "budgets",
  "receipts",
  "receipt_items",
  "detected_bills",
  "bank_messages",
  "budget_plans",
  "commitments",
  "notifications",
] as const;

export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const user = await getUser(supabase, userId);
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (req.nextUrl.searchParams.get("export")) {
    const data: Record<string, unknown[]> = {};
    for (const table of EXPORT_TABLES) {
      const { data: rows } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", userId);
      data[table] = rows ?? [];
    }
    return NextResponse.json(
      {
        exported_at: new Date().toISOString(),
        account: { id: user.id, email: user.email, name: displayNameOf(user) },
        data,
      },
      {
        headers: {
          "Content-Disposition": `attachment; filename="expense-tracker-export.json"`,
        },
      },
    );
  }

  return NextResponse.json({
    account: {
      id: user.id,
      name: displayNameOf(user),
      email: user.email,
      // What's connected, so the user can see how we reach them.
      telegram_linked: Boolean(user.telegram_id),
      consent_at: user.consent_at,
      // Whether they're on their own AI quota — never the key itself.
      own_ai_key: Boolean(await userGeminiKey(supabase, userId)),
    },
    usage: await usageToday(supabase, userId),
  });
}

/**
 * Save or clear the user's own Gemini key: { gemini_api_key: "AIza…" | null }.
 *
 * Their key means their own project's quota, which is what lets the app serve
 * many people without one shared free tier running dry. It is write-only —
 * nothing ever reads it back out to a client.
 */
export async function PATCH(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!("gemini_api_key" in body))
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const raw = body.gemini_api_key;
  if (raw === null || raw === "") {
    await setUserGeminiKey(createServiceClient(), userId, null);
    return NextResponse.json({ status: "cleared" });
  }

  if (typeof raw !== "string" || !looksLikeGeminiKey(raw)) {
    return NextResponse.json(
      {
        error:
          "That doesn't look like a Gemini API key (they start with AIza).",
      },
      { status: 400 },
    );
  }

  const saved = await setUserGeminiKey(createServiceClient(), userId, raw);
  return saved
    ? NextResponse.json({ status: "saved" })
    : NextResponse.json({ error: "Couldn't save that key." }, { status: 500 });
}

/**
 * Erase the account. Requires the caller to spell out what they're doing —
 * a stray DELETE must never wipe someone's finances.
 */
export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (req.nextUrl.searchParams.get("confirm") !== "delete-my-account") {
    return NextResponse.json(
      { error: "Add ?confirm=delete-my-account to confirm this is intended." },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const removed: Record<string, number> = {};

  for (const table of OWNED_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq("user_id", userId)
      .select("user_id");
    // A table that doesn't exist on this deployment isn't a failure.
    if (error) continue;
    removed[table] = data?.length ?? 0;
  }

  // The user row goes last, and is marked deleted rather than dropped so a
  // Telegram message from that chat can't silently recreate the account.
  const { error } = await supabase
    .from("users")
    .update({
      deleted_at: new Date().toISOString(),
      email: null,
      telegram_id: null,
      first_name: null,
      username: null,
      display_name: null,
    })
    .eq("id", userId);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ status: "deleted", removed });
}
