import { SupabaseClient } from "@supabase/supabase-js";
import { localDate } from "./parser";

/**
 * Per-user daily limits (v12).
 *
 * Every LLM call, transcription and vision read costs the operator money. On
 * a personal deployment that's invisible; with strangers on it, one person
 * uploading receipts in a loop can spend the month's budget in an afternoon.
 *
 * The limits are deliberately generous — high enough that a real person will
 * never see them, low enough that abuse stops. They're per day, so a mistake
 * costs one day, not a bill.
 */

export type QuotaKind = "llm_text" | "llm_vision" | "voice" | "ingest";

const DEFAULT_LIMITS: Record<QuotaKind, number> = {
  llm_text: 200, // free-text messages the rules parser couldn't handle
  llm_vision: 40, // receipt photos
  voice: 60, // voice notes
  ingest: 400, // captured bank messages
};

/** `QUOTA_LLM_VISION=100` overrides one limit; 0 disables that feature. */
export function limitFor(kind: QuotaKind): number {
  const raw = process.env[`QUOTA_${kind.toUpperCase()}`];
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_LIMITS[kind];
}

export interface QuotaVerdict {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  /** What to tell the user when they've hit it. */
  message: string | null;
}

/** Pure: the verdict for a known usage count. */
export function evaluate(
  used: number,
  limit: number,
  kind: QuotaKind,
): QuotaVerdict {
  const allowed = used < limit;
  return {
    allowed,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    message: allowed ? null : limitMessage(kind),
  };
}

function limitMessage(kind: QuotaKind): string {
  switch (kind) {
    case "llm_vision":
      return "You've hit today's limit for reading receipt photos. It resets tomorrow, and you can still type the amount in.";
    case "voice":
      return "You've hit today's limit for voice notes. It resets tomorrow, and typing still works.";
    case "ingest":
      return "You've hit today's limit for captured messages. It resets tomorrow.";
    default:
      return "You've hit today's limit for smart parsing. It resets tomorrow, and simple entries like \"250 groceries\" still work.";
  }
}

/**
 * Check and count in one step. Returns allowed:true when the counter table
 * isn't there yet — a missing migration must not lock people out of the app.
 */
export async function consumeQuota(
  supabase: SupabaseClient,
  userId: number,
  kind: QuotaKind,
): Promise<QuotaVerdict> {
  const limit = limitFor(kind);
  if (limit === 0)
    return {
      allowed: false,
      used: 0,
      limit,
      remaining: 0,
      message: limitMessage(kind),
    };

  const day = localDate();
  try {
    const { data, error } = await supabase
      .from("usage_counters")
      .select("count")
      .eq("user_id", userId)
      .eq("day", day)
      .eq("kind", kind)
      .limit(1);
    if (error) throw error;

    const used = Number(data?.[0]?.count ?? 0);
    const verdict = evaluate(used, limit, kind);
    if (!verdict.allowed) return verdict;

    // Not atomic, and deliberately so: a lost increment under a race costs
    // one extra call, while a failed write must never block the user.
    const { error: writeError } = await supabase
      .from("usage_counters")
      .upsert(
        { user_id: userId, day, kind, count: used + 1 },
        { onConflict: "user_id,day,kind" },
      );
    if (writeError) throw writeError;

    return {
      ...verdict,
      used: used + 1,
      remaining: Math.max(0, limit - used - 1),
    };
  } catch (err) {
    console.error("quota check failed (v12 migration applied?)", err);
    return { allowed: true, used: 0, limit, remaining: limit, message: null };
  }
}

/** Today's usage across every kind — for the account screen. */
export async function usageToday(
  supabase: SupabaseClient,
  userId: number,
): Promise<Array<{ kind: QuotaKind; used: number; limit: number }>> {
  try {
    const { data, error } = await supabase
      .from("usage_counters")
      .select("kind, count")
      .eq("user_id", userId)
      .eq("day", localDate());
    if (error) throw error;
    const used = new Map(
      (data ?? []).map((r) => [r.kind as QuotaKind, Number(r.count)]),
    );
    return (Object.keys(DEFAULT_LIMITS) as QuotaKind[]).map((kind) => ({
      kind,
      used: used.get(kind) ?? 0,
      limit: limitFor(kind),
    }));
  } catch {
    return [];
  }
}
