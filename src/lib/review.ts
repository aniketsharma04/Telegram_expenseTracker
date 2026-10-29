import { timingSafeEqual } from "node:crypto";
import { normaliseEmail } from "./identity";

/**
 * Store-review sign-in. Google Play (and later Apple) reviewers must be able
 * to sign in, but they can't receive our emailed codes. One configured
 * address accepts one fixed code instead:
 *
 *   REVIEW_EMAIL=review@example.com   REVIEW_CODE=<8+ characters>
 *
 * Off unless both are set, and a short code disables it — a guessable code
 * here would be a back door into a real account.
 */

const MIN_CODE_LENGTH = 8;

function config(): { email: string; code: string } | null {
  const email = process.env.REVIEW_EMAIL?.trim();
  const code = process.env.REVIEW_CODE?.trim();
  if (!email || !code || code.length < MIN_CODE_LENGTH) return null;
  return { email: normaliseEmail(email), code };
}

export function isReviewEmail(email: string): boolean {
  const c = config();
  return Boolean(c) && normaliseEmail(email) === c!.email;
}

export function reviewCodeMatches(email: string, code: string): boolean {
  const c = config();
  if (!c || normaliseEmail(email) !== c.email) return false;
  const a = Buffer.from(code.trim());
  const b = Buffer.from(c.code);
  return a.length === b.length && timingSafeEqual(a, b);
}
