import { SupabaseClient } from "@supabase/supabase-js";
import {
  BILL_KINDS,
  BillKind,
  KIND_CATEGORY,
  createBill,
  updateBill,
} from "./bills";
import {
  BILL_QUERY,
  DetectedBillDraft,
  DetectSource,
  extractBill,
  looksLikeBill,
} from "./bill-detect";
import { accessToken, getMessage, listMessageIds } from "./gmail";

/**
 * Detected-bill inbox (v7): rows a source proposed, waiting for the user to
 * confirm (→ becomes a real bill) or dismiss. Gmail fills it here; the
 * Android notification listener posts into the same table.
 */

export type DetectSourceName = "gmail" | "notification";

export interface DetectedBill {
  id: string;
  user_id: number;
  source: DetectSourceName;
  external_id: string;
  biller_name: string;
  kind: BillKind;
  amount: number | null;
  due_date: string | null;
  bill_date: string | null;
  account_hint: string | null;
  subject: string | null;
  snippet: string | null;
  confidence: "high" | "low";
  status: "pending" | "linked" | "dismissed";
  bill_id: string | null;
  detected_at: string;
}

const COLUMNS =
  "id, user_id, source, external_id, biller_name, kind, amount, due_date, bill_date, account_hint, subject, snippet, confidence, status, bill_id, detected_at";

// ── Gmail account ───────────────────────────────────────────────────────────

export interface GmailAccount {
  user_id: number;
  email: string;
  refresh_token: string;
  last_sync_at: string | null;
  last_error: string | null;
}

export async function getGmailAccount(
  supabase: SupabaseClient,
  userId: number,
): Promise<GmailAccount | null> {
  const { data, error } = await supabase
    .from("gmail_accounts")
    .select("user_id, email, refresh_token, last_sync_at, last_error")
    .eq("user_id", userId)
    .limit(1);
  if (error) return null; // migration not applied yet — behave as "not connected"
  return (data?.[0] as GmailAccount) ?? null;
}

export async function saveGmailAccount(
  supabase: SupabaseClient,
  userId: number,
  email: string,
  refreshToken: string,
  scope: string,
): Promise<void> {
  const { error } = await supabase.from("gmail_accounts").upsert(
    {
      user_id: userId,
      email,
      refresh_token: refreshToken,
      scope,
      connected_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function disconnectGmail(
  supabase: SupabaseClient,
  userId: number,
): Promise<void> {
  await supabase.from("gmail_accounts").delete().eq("user_id", userId);
}

/**
 * Did this failure mean "the consent is gone" rather than "Gmail hiccuped"?
 *
 * Google answers a dead refresh token with `invalid_grant`. That happens on
 * revoke, on a password change, and — the common one here — every 7 days while
 * the OAuth app is still in Testing. Only these need the user to act; network
 * blips and rate limits recover on their own, so they must not raise the flag.
 */
function isAuthFailure(message: string | null | undefined): boolean {
  return /invalid_grant|expired or revoked|invalid_token/i.test(message ?? "");
}

/** Is the stored consent dead, so the user has to reconnect? */
export function needsReauth(account: GmailAccount | null): boolean {
  return Boolean(account) && isAuthFailure(account!.last_error);
}

// ── Detected rows ───────────────────────────────────────────────────────────

export async function listDetected(
  supabase: SupabaseClient,
  userId: number,
  status: DetectedBill["status"] = "pending",
): Promise<DetectedBill[]> {
  const { data, error } = await supabase
    .from("detected_bills")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("status", status)
    .order("detected_at", { ascending: false })
    .limit(50);
  if (error) return []; // pre-migration
  return (data ?? []).map((r) => ({
    ...(r as unknown as DetectedBill),
    amount: r.amount == null ? null : Number(r.amount),
  }));
}

/**
 * Insert a draft, ignoring one we've already seen. Returns the row when it is
 * new, null when it was a duplicate — so callers can count real finds.
 */
export async function recordDetected(
  supabase: SupabaseClient,
  userId: number,
  source: DetectSourceName,
  externalId: string,
  draft: DetectedBillDraft,
  context: { subject?: string; snippet?: string },
): Promise<DetectedBill | null> {
  const { data, error } = await supabase
    .from("detected_bills")
    .insert({
      user_id: userId,
      source,
      external_id: externalId,
      biller_name: draft.biller_name,
      kind: draft.kind,
      amount: draft.amount,
      due_date: draft.due_date,
      bill_date: draft.bill_date,
      account_hint: draft.account_hint,
      subject: context.subject?.slice(0, 200) ?? null,
      snippet: context.snippet?.slice(0, 400) ?? null,
      confidence: draft.confidence,
    })
    .select(COLUMNS);
  if (error) {
    if (error.code === "23505") return null; // already detected
    throw error;
  }
  return (data?.[0] as unknown as DetectedBill) ?? null;
}

/** Has this external id already been processed (in any status)? */
export async function seenExternalIds(
  supabase: SupabaseClient,
  userId: number,
  source: DetectSourceName,
  ids: string[],
): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data, error } = await supabase
    .from("detected_bills")
    .select("external_id")
    .eq("user_id", userId)
    .eq("source", source)
    .in("external_id", ids);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.external_id as string));
}

export async function dismissDetected(
  supabase: SupabaseClient,
  userId: number,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("detected_bills")
    .update({ status: "dismissed" })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Confirm a detection.
 *
 * With `billId` the detection updates an existing bill's amount (a new
 * statement for a bill already tracked); without one it creates a bill from
 * the draft. Either way the detection is marked linked.
 */
export async function confirmDetected(
  supabase: SupabaseClient,
  userId: number,
  id: string,
  billId: string | null,
  overrides: Partial<{
    name: string;
    kind: BillKind;
    amount: number;
    due_day: number;
  }> = {},
): Promise<{ bill: { id: string } | null; detected: DetectedBill | null }> {
  const { data, error } = await supabase
    .from("detected_bills")
    .select(COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .limit(1);
  if (error) throw error;
  const det = data?.[0] as unknown as DetectedBill | undefined;
  if (!det) return { bill: null, detected: null };

  const amount =
    overrides.amount ?? (det.amount == null ? null : Number(det.amount));
  const kind =
    overrides.kind ?? (BILL_KINDS.includes(det.kind) ? det.kind : "other");
  const dueDay =
    overrides.due_day ??
    (det.due_date ? Number(det.due_date.slice(8, 10)) : null) ??
    1;

  let bill: { id: string };
  if (billId) {
    const updated = await updateBill(supabase, userId, billId, {
      amount,
      due_day: dueDay,
    });
    if (!updated) return { bill: null, detected: det };
    bill = { id: updated.id };
  } else {
    const created = await createBill(supabase, userId, {
      name: (overrides.name ?? det.biller_name).slice(0, 60),
      kind,
      category: KIND_CATEGORY[kind],
      due_day: dueDay,
      amount,
      upi_id: null,
      payee_name: null,
      consumer_number: det.account_hint,
      detected_from: det.source,
    });
    bill = { id: created.id };
  }

  const { data: linked } = await supabase
    .from("detected_bills")
    .update({ status: "linked", bill_id: bill.id })
    .eq("id", id)
    .eq("user_id", userId)
    .select(COLUMNS);
  return { bill, detected: (linked?.[0] as unknown as DetectedBill) ?? det };
}

// ── Gmail sync ──────────────────────────────────────────────────────────────

export interface SyncResult {
  scanned: number;
  gated: number; // passed the keyword gate, sent to the LLM
  detected: number; // new rows created
  duplicates: number;
  error?: string;
  /**
   * This run is the one that found the consent dead. Set only on the first
   * such run — a later pass sees the flag already stored and leaves it false,
   * so the cron nudges the user once instead of every day.
   */
  newly_expired?: boolean;
}

/**
 * One Gmail pass for a user: search → keyword gate → LLM extract → record.
 *
 * `maxMessages` bounds the LLM spend of a single run; the daily cron re-runs
 * anyway, and already-seen message ids are skipped before any extraction.
 */
export async function syncGmail(
  supabase: SupabaseClient,
  userId: number,
  todayIST: string,
  maxMessages = 25,
): Promise<SyncResult> {
  const out: SyncResult = { scanned: 0, gated: 0, detected: 0, duplicates: 0 };
  const account = await getGmailAccount(supabase, userId);
  if (!account) return { ...out, error: "Gmail isn't connected" };

  try {
    const token = await accessToken(account.refresh_token);
    const ids = await listMessageIds(token, BILL_QUERY, 60);
    const seen = await seenExternalIds(supabase, userId, "gmail", ids);
    const fresh = ids.filter((id) => !seen.has(id)).slice(0, maxMessages);
    out.duplicates = ids.length - fresh.length;

    for (const id of fresh) {
      const msg = await getMessage(token, id);
      out.scanned++;
      const source: DetectSource = {
        subject: msg.subject,
        from: msg.from,
        body: msg.body || msg.snippet,
      };
      if (!looksLikeBill(source)) continue;
      out.gated++;
      const draft = await extractBill(source, todayIST);
      if (!draft) continue;
      const row = await recordDetected(supabase, userId, "gmail", id, draft, {
        subject: msg.subject,
        snippet: msg.snippet,
      });
      if (row) out.detected++;
      else out.duplicates++;
    }

    await supabase
      .from("gmail_accounts")
      .update({ last_sync_at: new Date().toISOString(), last_error: null })
      .eq("user_id", userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail sync failed";
    out.error = message;
    // `account` holds the state from before this run, so comparing against it
    // tells us whether the expiry is news.
    out.newly_expired =
      isAuthFailure(message) && !isAuthFailure(account.last_error);
    await supabase
      .from("gmail_accounts")
      .update({ last_sync_at: new Date().toISOString(), last_error: message })
      .eq("user_id", userId);
  }
  return out;
}

/** Telegram nudge for newly found bills. */
export function detectedNotice(rows: DetectedBill[]): string | null {
  if (!rows.length) return null;
  const lines = rows.slice(0, 5).map((r) => {
    const amount =
      r.amount != null
        ? `₹${Number(r.amount).toLocaleString("en-IN")}`
        : "amount unclear";
    const due = r.due_date ? `, due ${r.due_date}` : "";
    return `• <b>${r.biller_name}</b>: ${amount}${due}`;
  });
  const more = rows.length > 5 ? `\n…and ${rows.length - 5} more` : "";
  return [
    `📧 Found ${rows.length} bill${rows.length > 1 ? "s" : ""} in your email:`,
    ...lines,
    more,
    "\nOpen the app → Bills to confirm or dismiss.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Telegram nudge when the Gmail consent dies. Sent once per expiry, so it
 * says what happened and what to do rather than just reporting an error.
 */
export function reauthNotice(appUrl?: string): string {
  const where = appUrl
    ? `<a href="${appUrl.replace(/\/$/, "")}">Open the app</a>`
    : "Open the app";
  return [
    "📧 <b>Gmail needs reconnecting</b>",
    "",
    "Google drops the connection every 7 days while the app is unpublished. Nothing is wrong with your account.",
    `${where} → Settings → Reconnect Gmail to keep finding bills in your email.`,
  ].join("\n");
}
