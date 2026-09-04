import { createHash, randomInt } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { normaliseEmail } from "./identity";

/**
 * Email sign-in codes (v12).
 *
 * A six-digit code, hashed at rest, valid for ten minutes, five guesses, and
 * rate-limited per address. The rules are pure functions so the security
 * properties are tested rather than asserted.
 */

export const CODE_LENGTH = 6;
export const CODE_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
/** Codes an address may request in the window, before it has to wait. */
export const MAX_PER_HOUR = 5;

export interface StoredCode {
  id: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  consumed_at: string | null;
}

/** Cryptographically random, never a predictable sequence. */
export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/**
 * Hashed with the app secret so a database leak alone can't be replayed, and
 * bound to the address so a code issued for one email can't verify another.
 */
export function hashCode(email: string, code: string, secret: string): string {
  return createHash("sha256")
    .update(`${normaliseEmail(email)}:${code}:${secret}`)
    .digest("hex");
}

export type CodeVerdict =
  | { ok: true }
  | {
      ok: false;
      reason: "expired" | "used" | "too_many_attempts" | "mismatch";
    };

/**
 * Pure: is this the right code, and is the record still usable?
 *
 * Checks state before the code itself, so an exhausted or expired record
 * gives the same answer regardless of what was typed.
 */
export function checkCode(
  record: StoredCode | null,
  suppliedHash: string,
  now: Date = new Date(),
): CodeVerdict {
  if (!record) return { ok: false, reason: "mismatch" };
  if (record.consumed_at) return { ok: false, reason: "used" };
  if (record.attempts >= MAX_ATTEMPTS)
    return { ok: false, reason: "too_many_attempts" };
  if (Date.parse(record.expires_at) < now.getTime())
    return { ok: false, reason: "expired" };
  return record.code_hash === suppliedHash
    ? { ok: true }
    : { ok: false, reason: "mismatch" };
}

/** Pure: has this address asked for too many codes lately? */
export function isRateLimited(
  recentCount: number,
  max: number = MAX_PER_HOUR,
): boolean {
  return recentCount >= max;
}

export function expiryFrom(now: Date = new Date()): string {
  return new Date(now.getTime() + CODE_TTL_MINUTES * 60_000).toISOString();
}

// ── Storage ─────────────────────────────────────────────────────────────────

export async function recentCodeCount(
  supabase: SupabaseClient,
  email: string,
): Promise<number> {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count, error } = await supabase
    .from("auth_codes")
    .select("id", { count: "exact", head: true })
    .ilike("email", normaliseEmail(email))
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

export async function issueCode(
  supabase: SupabaseClient,
  email: string,
  code: string,
  secret: string,
): Promise<void> {
  const address = normaliseEmail(email);
  // A new code invalidates the old one, so an intercepted earlier code dies.
  await supabase
    .from("auth_codes")
    .update({ consumed_at: new Date().toISOString() })
    .ilike("email", address)
    .is("consumed_at", null);

  const { error } = await supabase.from("auth_codes").insert({
    email: address,
    code_hash: hashCode(address, code, secret),
    expires_at: expiryFrom(),
  });
  if (error) throw error;
}

/** The live code for an address, newest first. */
export async function latestCode(
  supabase: SupabaseClient,
  email: string,
): Promise<StoredCode | null> {
  const { data, error } = await supabase
    .from("auth_codes")
    .select("id, code_hash, expires_at, attempts, consumed_at")
    .ilike("email", normaliseEmail(email))
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as StoredCode) ?? null;
}

export async function recordAttempt(
  supabase: SupabaseClient,
  record: StoredCode,
): Promise<void> {
  await supabase
    .from("auth_codes")
    .update({ attempts: record.attempts + 1 })
    .eq("id", record.id);
}

export async function consume(
  supabase: SupabaseClient,
  record: StoredCode,
): Promise<void> {
  await supabase
    .from("auth_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", record.id);
}
