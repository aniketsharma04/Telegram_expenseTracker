import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { getBbpsProvider, validateParams } from "@/lib/bbps";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // async fetch + polling

/**
 * Preview a bill before saving: { biller_id, params: {"Consumer Number": "…"} }
 * → { ok, bill } or { ok: false, code, error }. Nothing is stored.
 */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { biller_id?: unknown; params?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (
    typeof body.biller_id !== "string" ||
    typeof body.params !== "object" ||
    !body.params
  ) {
    return NextResponse.json(
      { error: "need biller_id and params" },
      { status: 400 },
    );
  }
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.params as Record<string, unknown>)) {
    if (typeof v === "string") params[k.slice(0, 60)] = v.trim().slice(0, 64);
  }

  const provider = getBbpsProvider(createServiceClient());
  const biller = await provider.getBiller(body.biller_id);
  if (!biller)
    return NextResponse.json({ error: "unknown biller" }, { status: 404 });
  const invalid = validateParams(biller, params);
  if (invalid)
    return NextResponse.json({ ok: false, code: "invalid", error: invalid });

  const result = await provider.fetchBill(biller.id, params, null);
  return NextResponse.json({
    ...result,
    biller: { id: biller.id, name: biller.name, category: biller.category },
  });
}
