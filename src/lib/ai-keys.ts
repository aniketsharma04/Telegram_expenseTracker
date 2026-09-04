import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Which Gemini key to call with (v13).
 *
 * Two things this does, and one it deliberately doesn't:
 *
 *   ✓ Bring-your-own-key. A user can supply their own Gemini key; their
 *     requests then run on their own project's quota. This is what makes the
 *     app scale to many users without the operator paying for all of them,
 *     and it's each user's own free tier being used as intended.
 *
 *   ✓ Failover. Several operator keys can be configured; a key that returns
 *     "quota exhausted" is put on cooldown and the next one is used. That's
 *     resilience — a revoked or throttled key shouldn't take the app down.
 *
 *   ✗ Multiplying the free tier. Google's limits are per *project*, not per
 *     key, so several keys from one project add nothing at all; and spinning
 *     up extra projects to get around the quota is against Google's terms.
 *     Failover here is for keys you're legitimately entitled to use.
 */

/** A key is rested for the remainder of the day once it reports exhaustion. */
const COOLDOWN_MS = 60 * 60 * 1000;

export interface KeyState {
  key: string;
  /** Epoch ms until which this key is resting; 0 when ready. */
  restingUntil: number;
}

/** Operator keys, newest config wins: GEMINI_API_KEYS (comma-separated) or GEMINI_API_KEY. */
export function configuredKeys(): string[] {
  const many = process.env.GEMINI_API_KEYS;
  if (many?.trim()) {
    return [
      ...new Set(
        many
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      ),
    ];
  }
  const single = process.env.GEMINI_API_KEY?.trim();
  return single ? [single] : [];
}

/**
 * Pure: the first key that isn't resting, else null.
 * Order is stable so the primary key is preferred while it's healthy.
 */
export function pickKey(
  states: KeyState[],
  now: number = Date.now(),
): string | null {
  return states.find((s) => s.restingUntil <= now)?.key ?? null;
}

/** Pure: rest one key, leaving the others untouched. */
export function restKey(
  states: KeyState[],
  key: string,
  now: number = Date.now(),
  cooldownMs: number = COOLDOWN_MS,
): KeyState[] {
  return states.map((s) =>
    s.key === key ? { ...s, restingUntil: now + cooldownMs } : s,
  );
}

/**
 * Pure: does this response mean "this key is out of quota" rather than
 * "the request was wrong"? Only the former is worth trying another key for.
 */
export function isQuotaError(status: number, body: string): boolean {
  if (status === 429) return true;
  if (status !== 403 && status !== 400) return false;
  return /quota|rate limit|resource[_ ]exhausted|billing/i.test(body);
}

// ── Process-wide state ──────────────────────────────────────────────────────
// Serverless instances are short-lived, so this is a best-effort memory of
// which keys are struggling. Losing it costs one wasted call.

let states: KeyState[] = [];
let signature = "";

function pool(): KeyState[] {
  const keys = configuredKeys();
  const sig = keys.join("|");
  if (sig !== signature) {
    signature = sig;
    states = keys.map((key) => ({ key, restingUntil: 0 }));
  }
  return states;
}

export function geminiConfigured(): boolean {
  return configuredKeys().length > 0;
}

export interface GeminiAttempt {
  status: number;
  body: string;
}

/**
 * Run `call` with a working key, retrying with the next one when a key
 * reports exhaustion.
 *
 * `preferredKey` (a user's own) is tried first and never rested on the shared
 * pool — one user's exhausted key must not affect anybody else.
 */
export async function withGeminiKey<T>(
  call: (
    apiKey: string,
  ) => Promise<{ result: T | null; attempt: GeminiAttempt }>,
  preferredKey?: string | null,
): Promise<T | null> {
  const order: Array<{ key: string; shared: boolean }> = [];
  if (preferredKey?.trim())
    order.push({ key: preferredKey.trim(), shared: false });

  const shared = pool();
  for (const s of shared) order.push({ key: s.key, shared: true });
  if (!order.length) return null;

  const now = Date.now();
  for (const { key, shared: isShared } of order) {
    if (isShared) {
      const state = shared.find((s) => s.key === key);
      if (state && state.restingUntil > now) continue; // resting; skip
    }

    const { result, attempt } = await call(key);
    if (result !== null) return result;

    if (isQuotaError(attempt.status, attempt.body)) {
      if (isShared) states = restKey(shared, key);
      console.warn(
        `gemini key exhausted (${attempt.status}); ${isShared ? "resting it and " : ""}trying the next`,
      );
      continue;
    }
    // A real error (bad request, malformed schema): another key won't help.
    return null;
  }
  return null;
}

// ── A user's own key ────────────────────────────────────────────────────────

/**
 * Stored service-role-only, exactly like Gmail refresh tokens: it's a
 * credential belonging to the user, and no client payload should ever
 * contain it.
 */
export async function userGeminiKey(
  supabase: SupabaseClient,
  userId: number,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", userId)
      .eq("provider", "gemini")
      .limit(1);
    if (error) throw error;
    return (data?.[0]?.api_key as string) ?? null;
  } catch (err) {
    console.error("userGeminiKey failed (v13 migration applied?)", err);
    return null;
  }
}

export async function setUserGeminiKey(
  supabase: SupabaseClient,
  userId: number,
  apiKey: string | null,
): Promise<boolean> {
  try {
    if (!apiKey) {
      const { error } = await supabase
        .from("user_api_keys")
        .delete()
        .eq("user_id", userId)
        .eq("provider", "gemini");
      if (error) throw error;
      return true;
    }
    const { error } = await supabase
      .from("user_api_keys")
      .upsert(
        { user_id: userId, provider: "gemini", api_key: apiKey.trim() },
        { onConflict: "user_id,provider" },
      );
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("setUserGeminiKey failed (v13 migration applied?)", err);
    return false;
  }
}

/** Loose shape check so an obvious typo is caught before the first call. */
export function looksLikeGeminiKey(key: string): boolean {
  const k = key.trim();
  return k.startsWith("AIza") && k.length >= 30 && k.length <= 60;
}
