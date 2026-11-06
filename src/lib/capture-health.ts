import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Is the phone still sending bank alerts?
 *
 * Android can stop passing notifications to Aaj without telling anyone: a
 * reinstall wipes notification access, an app update can leave the listener
 * unbound, and some phones kill it to save battery. The app then looks fine
 * but captures nothing — the daily number quietly goes wrong. The server is
 * the one place that knows when the last alert arrived, so it decides when
 * capture has gone quiet; the app shows the fix and the daily cron pushes.
 */

export interface CaptureHealth {
  /** When the last phone-captured alert reached the server. */
  last_at: string | null;
  /** Phone-captured alerts in the last 30 days. */
  recent: number;
  /** Capture used to work and nothing has arrived for QUIET_HOURS. */
  quiet: boolean;
}

/** Most people get several bank alerts a day; two silent days means broken. */
export const QUIET_HOURS = 48;
/** Below this, there's no track record to call a silence unusual. */
export const MIN_HISTORY = 3;
const HOUR = 3_600_000;

export function judgeCapture(
  lastAt: string | null,
  recent: number,
  now: Date = new Date(),
): CaptureHealth {
  const silentFor = lastAt ? now.getTime() - Date.parse(lastAt) : Infinity;
  return {
    last_at: lastAt,
    recent,
    quiet:
      Boolean(lastAt) &&
      recent >= MIN_HISTORY &&
      silentFor >= QUIET_HOURS * HOUR,
  };
}

/**
 * Should today's cron push about it? Only on the run that first sees the
 * silence (it runs once a day), so one quiet spell is one push, with no state
 * to keep. Later days still show the card in the app.
 */
export function quietNoticeDue(
  h: CaptureHealth,
  now: Date = new Date(),
): boolean {
  if (!h.quiet || !h.last_at) return false;
  const silentFor = now.getTime() - Date.parse(h.last_at);
  return silentFor < (QUIET_HOURS + 24) * HOUR;
}

export async function loadCaptureHealth(
  supabase: SupabaseClient,
  userId: number,
  now: Date = new Date(),
): Promise<CaptureHealth> {
  const since = new Date(now.getTime() - 30 * 24 * HOUR).toISOString();
  const [last, recent] = await Promise.all([
    supabase
      .from("bank_messages")
      .select("created_at")
      .eq("user_id", userId)
      .eq("source", "notification")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("bank_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("source", "notification")
      .gte("created_at", since),
  ]);
  const lastAt =
    (last.data?.[0] as { created_at?: string } | undefined)?.created_at ?? null;
  return judgeCapture(lastAt, recent.count ?? 0, now);
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

/** The push when capture goes quiet: what happened and the one fix that works. */
export function captureQuietNotice(lastAt: string): {
  title: string;
  body: string;
  html: string;
} {
  const since = shortDate(lastAt);
  const body = [
    `Aaj hasn't received a bank alert from your phone since ${since}, so new spends aren't being logged.`,
    "This usually happens after installing a new version of the app. Open Aaj: the card on Home takes you to the setting to turn back on.",
  ].join("\n");
  return {
    title: "Bank alerts stopped reaching Aaj",
    body,
    html: `📵 <b>Bank alerts stopped reaching Aaj</b>\n\n${body}`,
  };
}

const REPORT_FLAGS = [
  "supported",
  "granted",
  "bound",
  "batteryOptimized",
  "signedIn",
] as const;
const REPORT_NUMBERS = [
  "pending",
  "lastSeen",
  "lastCaptured",
  "connectedAt",
  "disconnectedAt",
  "uploadAt",
] as const;
const REPORT_TEXT = [
  "uploadResult",
  "pushState",
  "runtimeVersion",
  "updateId",
  "model",
  "androidVersion",
] as const;

/**
 * Keep only the known status fields. This is the guarantee that a report can
 * never carry message text, whatever a client sends.
 */
export function cleanCaptureReport(input: unknown): Record<string, unknown> {
  const src = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  const out: Record<string, unknown> = {};
  for (const k of REPORT_FLAGS)
    if (typeof src[k] === "boolean") out[k] = src[k];
  for (const k of REPORT_NUMBERS)
    if (typeof src[k] === "number" && Number.isFinite(src[k])) out[k] = src[k];
  for (const k of REPORT_TEXT)
    if (typeof src[k] === "string") out[k] = (src[k] as string).slice(0, 60);
  return out;
}
