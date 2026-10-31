/**
 * Masks personal details before text leaves for an AI model. Gemini's free
 * tier may keep prompts and use them for training, so a bill email or a typed
 * message should reach it with only what extraction needs: amounts, dates,
 * biller names and the last four digits of an account.
 *
 * What goes:
 *   - email addresses and UPI ids          → [email]@domain, [upi-id]
 *   - Indian phone numbers                 → [phone]
 *   - PAN, Aadhaar, IFSC                   → [pan], [aadhaar], [ifsc]
 *   - card, account and consumer numbers   → XXXX1234 (last four kept)
 *   - the greeting name ("Dear Rahul,")    → "Dear customer,"
 *   - link paths and query strings         → the bare domain
 *
 * Amounts survive: a number written after ₹/Rs/INR is never masked, and
 * neither are dates. Pure, so it's unit-tested without a model.
 */

const CURRENCY = /(?:₹|rs\.?|inr|mrp)\s*$/i;

/** Is this match written as an amount (₹ / Rs / INR just before it)? */
function isAmount(whole: string, offset: number): boolean {
  return CURRENCY.test(whole.slice(Math.max(0, offset - 6), offset));
}

export function redactForAI(text: string): string {
  let out = text;

  // Links first: tracking URLs carry ids and tokens in the path and query.
  out = out.replace(
    /\bhttps?:\/\/([a-z0-9.-]+)(?:[/?#][^\s<>"')\]]*)?/gi,
    (_m, host: string) => `https://${host}`,
  );

  // The domain stays: it's often how a biller is recognised (…@tatapower.com).
  out = out.replace(
    /\b[\w.+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/gi,
    (_m, domain: string) => `[email]@${domain}`,
  );
  // A UPI id is name@handle with no domain after the @ (a full stop may follow).
  out = out.replace(/\b[\w.-]{2,}@[a-z][a-z0-9]+\b(?!\.[a-z])/gi, "[upi-id]");

  out = out.replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[pan]");
  out = out.replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, "[ifsc]");

  // Cards (4-4-4-4) before Aadhaar (4-4-4), so a card's tail isn't read as one.
  out = out.replace(
    /(?<!\d|\d[.,])\d{4}([ -])\d{4}\1\d{4}\1\d{4}(?!\d|[.,]\d)/g,
    (m) => `XXXX${m.slice(-4)}`,
  );
  out = out.replace(
    /(?<!\d|\d[.,]|\d[ -])\d{4}([ -])\d{4}\1\d{4}(?!\d|[.,]\d|[ -]\d)/g,
    "[aadhaar]",
  );

  // +91 98765 43210, 098765-43210, 9876543210
  out = out.replace(
    /(?<![\d₹])(?:\+91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g,
    (m, offset: number, whole: string) =>
      isAmount(whole, offset) ? m : "[phone]",
  );

  // Unbroken runs of 8+ digits: accounts, consumer, policy and reference
  // numbers. Dates keep their separators, so they never match.
  out = out.replace(
    /(?<!\d|\d[.,])\d{8,}(?!\d|[.,]\d)/g,
    (m, offset: number, whole: string) =>
      isAmount(whole, offset) ? m : `XXXX${m.slice(-4)}`,
  );

  out = out.replace(
    /\b(dear|hi|hello|hey)\s+(?:(?:mr|mrs|ms|dr|shri|smt)\.?\s+)?[a-z][a-z.]*(?:\s+[a-z][a-z.]*){0,3}\s*,/gi,
    (_m, greet: string) => `${greet} customer,`,
  );

  return out;
}
