import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { signToken } from "@/lib/auth";
import {
  displayNameOf,
  findOrCreateEmailUser,
  isEmailShaped,
  normaliseEmail,
} from "@/lib/identity";
import { mailerConfigured, sendSignInCode } from "@/lib/mailer";
import {
  checkCode,
  consume,
  generateCode,
  hashCode,
  isRateLimited,
  issueCode,
  latestCode,
  recentCodeCount,
  recordAttempt,
} from "@/lib/otp";

export const dynamic = "force-dynamic";

/** 30 days, matching the Telegram /app token. */
const SESSION_DAYS = 30;

function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!s) throw new Error("AUTH_SECRET / TELEGRAM_WEBHOOK_SECRET not set");
  return s;
}

/**
 * Sign in with an email code — the path for everyone who doesn't use
 * Telegram.
 *
 *   POST { email }          → sends a code
 *   POST { email, code }    → returns a session token
 *
 * Deliberately does not reveal whether an address already has an account:
 * the same response comes back either way, so this can't be used to find out
 * who uses the app.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? normaliseEmail(body.email) : "";
  if (!isEmailShaped(email))
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );

  const supabase = createServiceClient();
  const code = typeof body.code === "string" ? body.code.trim() : null;

  // ── Step 2: verify ────────────────────────────────────────────────────
  if (code) {
    let record;
    try {
      record = await latestCode(supabase, email);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "lookup failed" },
        { status: 500 },
      );
    }

    const verdict = checkCode(record, hashCode(email, code, secret()));
    if (!verdict.ok) {
      if (record && verdict.reason === "mismatch")
        await recordAttempt(supabase, record);
      return NextResponse.json(
        { error: verdictMessage(verdict.reason) },
        { status: 400 },
      );
    }

    await consume(supabase, record!);
    const { user, created } = await findOrCreateEmailUser(supabase, email);
    return NextResponse.json({
      status: "signed_in",
      token: signToken(user.id, SESSION_DAYS * 24 * 3600),
      created,
      user: { id: user.id, name: displayNameOf(user), email: user.email },
    });
  }

  // ── Step 1: send a code ───────────────────────────────────────────────
  if (!mailerConfigured()) {
    return NextResponse.json(
      {
        error:
          "Email sign-in isn't set up on this deployment yet. Use the Telegram bot to sign in.",
      },
      { status: 503 },
    );
  }

  try {
    if (isRateLimited(await recentCodeCount(supabase, email))) {
      return NextResponse.json(
        { error: "Too many codes requested. Try again in an hour." },
        { status: 429 },
      );
    }

    const fresh = generateCode();
    await issueCode(supabase, email, fresh, secret());
    const mail = await sendSignInCode(email, fresh);
    if (!mail.sent)
      return NextResponse.json({ error: mail.error }, { status: 502 });

    return NextResponse.json({ status: "code_sent" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "could not send the code" },
      { status: 500 },
    );
  }
}

function verdictMessage(reason: string): string {
  switch (reason) {
    case "expired":
      return "That code has expired. Ask for a new one.";
    case "used":
      return "That code has already been used. Ask for a new one.";
    case "too_many_attempts":
      return "Too many wrong tries. Ask for a new code.";
    default:
      return "That code isn't right.";
  }
}
