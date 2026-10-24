import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Merchant normalisation (v8).
 *
 * Bank and card statements name the same shop a dozen ways —
 * "UPI/SWIGGY*ORDER8823/HDFC", "SWIGGY LTD", "swiggy bangalore". Every
 * merchant-level insight downstream (top merchants, recurring detection,
 * anomaly flags) is only as good as this collapsing step.
 *
 * Two stages: strip the statement noise, then match against a rule table
 * (shared defaults plus anything the user has taught us).
 */

export interface MerchantRule {
  pattern: string; // lowercase substring to look for
  canonical: string; // the name it maps to
  category: string | null;
  user_id: number | null; // null = shared default
}

export interface Normalised {
  merchant: string;
  /** Category hint from the rule, when it carries one. */
  category: string | null;
  /** True when a rule matched rather than just tidying the raw string. */
  matched: boolean;
}

/** Payment-rail prefixes and refs that carry no information about the shop. */
const NOISE = [
  /^upi[\s/-]*/i,
  /^pos[\s/-]*/i,
  /^neft[\s/-]*/i,
  /^imps[\s/-]*/i,
  /^ach[\s/-]*/i,
  /^ecs[\s/-]*/i,
  /^atd[\s/-]*/i,
  /^mps[\s/-]*/i,
  /^vps[\s/-]*/i,
  /^payment\s+to\s+/i,
  /^paid\s+to\s+/i,
];

/**
 * Pure: tidy a raw statement string into something a human would write.
 * Runs before rule matching and is also the fallback when nothing matches.
 */
/** Handle suffixes that name the payment gateway, not the shop. */
const HANDLE_NOISE = new Set(["stores", "store", "rzp", "razorpay", "payu", "pay", "upi", "online", "merchant", "cf", "ccavenue"]);

/**
 * A UPI handle ("swiggy.stores@axisbank") as a shop name, or an honest label
 * when it's only an id: a QR code's handle or a phone number names nobody.
 */
function nameFromHandle(handle: string): string {
  const local = handle.split("@")[0].trim();
  const digits = (local.match(/\d/g) ?? []).length;
  if (/^\+?\d{10,12}$/.test(local)) return "UPI transfer";
  if (/^(paytmqr|bharatpe|q\d|gpay-|phonepeqr|upiqr|mab\.)/i.test(local) || digits >= 6)
    return "UPI merchant";
  const words = local
    .split(/[._-]+/)
    .filter((w) => w && !HANDLE_NOISE.has(w.toLowerCase()) && !/^\d+$/.test(w));
  if (!words.length) return "UPI merchant";
  return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

export function cleanMerchant(raw: string): string {
  if (/^[\w.\-+]{2,}@[a-z]{2,}$/i.test(raw.trim())) return nameFromHandle(raw);
  let s = raw.trim();
  for (const pattern of NOISE) s = s.replace(pattern, "");

  // Everything after the first separator is usually a reference number.
  s = s.split(/[/|@]/)[0];
  // "SWIGGY*ORDER8823" → "SWIGGY"
  s = s.split("*")[0];
  // Trailing transaction refs: "AMAZON 4471123", "ZOMATO-88231"
  s = s.replace(/[\s-]+[a-z]*\d{4,}[a-z\d]*$/i, "");
  s = s
    .replace(/[^a-z0-9&.' -]/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!s) return raw.trim();

  // SHOUTING statements read better in title case; leave mixed case alone
  // so "IndiGo" and "BookMyShow" survive intact.
  if (s === s.toUpperCase()) {
    s = s
      .toLowerCase()
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }
  return s;
}

/**
 * Pure: map a raw merchant string onto a canonical name.
 * A user's own rule beats a shared default; among equals, the longest
 * pattern wins so "amazon pay" doesn't lose to "amazon".
 */
export function normaliseMerchant(
  raw: string | null | undefined,
  rules: MerchantRule[],
): Normalised | null {
  if (!raw || !raw.trim()) return null;
  const haystack = raw.toLowerCase();

  const matches = rules
    .filter((r) => r.pattern && haystack.includes(r.pattern.toLowerCase()))
    .sort((a, b) => {
      const own = Number(b.user_id !== null) - Number(a.user_id !== null);
      return own !== 0 ? own : b.pattern.length - a.pattern.length;
    });

  if (matches.length) {
    return {
      merchant: matches[0].canonical,
      category: matches[0].category,
      matched: true,
    };
  }
  return { merchant: cleanMerchant(raw), category: null, matched: false };
}

/** Shared defaults plus this user's own rules, in one list. */
export async function loadMerchantRules(
  supabase: SupabaseClient,
  userId: number,
): Promise<MerchantRule[]> {
  try {
    const { data, error } = await supabase
      .from("merchants")
      .select("pattern, canonical, category, user_id")
      .or(`user_id.is.null,user_id.eq.${userId}`);
    if (error) throw error;
    return (data ?? []) as MerchantRule[];
  } catch (err) {
    console.error("loadMerchantRules failed (v8 migration applied?)", err);
    return [];
  }
}

/**
 * Teach the table a mapping — called when the user corrects a merchant name,
 * mirroring how category corrections already train the keyword table.
 */
export async function learnMerchant(
  supabase: SupabaseClient,
  userId: number,
  pattern: string,
  canonical: string,
  category: string | null = null,
): Promise<void> {
  const key = pattern.trim().toLowerCase();
  if (key.length < 3) return; // too short to be a safe substring match
  try {
    await supabase
      .from("merchants")
      .upsert(
        { user_id: userId, pattern: key, canonical, category },
        { onConflict: "user_id,pattern" },
      );
  } catch (err) {
    console.error("learnMerchant failed", err);
  }
}
