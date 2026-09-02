import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { loadBalanceSheet } from "@/lib/accounts";
import { ingestBankMessage, listBankMessages } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** What the capture channels have sent recently, newest first. */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  const supabase = createServiceClient();
  return NextResponse.json({
    messages: await listBankMessages(supabase, userId),
  });
}

/**
 * Feed one bank message in:
 *   { body, source: "notification"|"sms"|"telegram"|"email",
 *     external_id?, received_at? }
 *
 * Accepts a batch too — the Android listener queues messages while offline
 * and flushes them in one call:
 *   { messages: [ {body, external_id, received_at}, … ], source }
 */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return fail("invalid JSON");
  }

  const source = readSource(payload.source);
  if (!source) return fail("unknown source");

  const batch = Array.isArray(payload.messages)
    ? (payload.messages as Array<Record<string, unknown>>)
    : [payload];
  if (!batch.length) return fail("nothing to ingest");
  if (batch.length > 50) return fail("too many messages in one call");

  const supabase = createServiceClient();
  const results = [];
  for (const item of batch) {
    const body = typeof item.body === "string" ? item.body.trim() : "";
    if (!body) continue;
    results.push(
      await ingestBankMessage(supabase, userId, {
        body,
        source,
        externalId:
          typeof item.external_id === "string" ? item.external_id : null,
        receivedAt: readTimestamp(item.received_at),
      }),
    );
  }

  return NextResponse.json({
    results,
    // Balances move on every capture, so hand them back with the result.
    balances: await loadBalanceSheet(supabase, userId),
  });
}

function readSource(
  value: unknown,
): "notification" | "sms" | "telegram" | "email" | null {
  return value === "notification" ||
    value === "sms" ||
    value === "telegram" ||
    value === "email"
    ? value
    : null;
}

function readTimestamp(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value))
    return new Date(value).toISOString();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return undefined;
}
