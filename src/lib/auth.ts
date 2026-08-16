import { createHmac, timingSafeEqual } from "crypto";

/**
 * Phase C auth: the bot's /dashboard command issues a short-lived signed
 * login link; opening it exchanges the token for a long-lived session cookie.
 * No passwords — Telegram identity is the identity.
 */

export const COOKIE_NAME = "et_session";

function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!s) throw new Error("AUTH_SECRET / TELEGRAM_WEBHOOK_SECRET not set");
  return s;
}

export function signToken(userId: number, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** Returns the user id when the token is valid and unexpired, else null. */
export function verifyToken(token: string | null | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [uid, exp, sig] = parts;
  const expected = createHmac("sha256", secret()).update(`${uid}.${exp}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  const id = Number(uid);
  return Number.isFinite(id) && id > 0 ? id : null;
}
