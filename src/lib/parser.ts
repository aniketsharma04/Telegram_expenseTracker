/**
 * Rules-based parser (the fast path).
 *
 * Turns a raw message like "300 zomato" or "spent 1.2k on groceries yesterday"
 * into { amount, category, merchant, expenseDate } with no external calls.
 * Anything it can't handle is flagged so a later LLM fallback (v2) can take over.
 */

export interface CategoryRule {
  name: string;
  keywords: string[];
}

export interface ParseResult {
  ok: boolean;
  amount: number | null;
  category: string | null; // null = no keyword matched → "Uncategorized"
  merchant: string | null;
  expenseDate: string; // YYYY-MM-DD
  error?: "no_amount";
}

const TIMEZONE = "Asia/Kolkata";

/** Today's date (YYYY-MM-DD) in the user's timezone, minus `offsetDays`. */
export function localDate(offsetDays = 0, now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

/**
 * Pull the first monetary amount out of the text.
 * Handles "300", "₹300", "rs 300", "Rs.300", "1,200", "1.5k".
 */
export function extractAmount(text: string): {
  amount: number | null;
  rest: string;
} {
  const re = /(?:₹|rs\.?\s*|inr\s*)?(\d[\d,]*(?:\.\d+)?)\s*(k\b)?/i;
  const match = re.exec(text);
  if (!match) return { amount: null, rest: text };

  let amount = parseFloat(match[1].replace(/,/g, ""));
  if (match[2]) amount *= 1000;
  if (!Number.isFinite(amount) || amount <= 0)
    return { amount: null, rest: text };

  const rest = (
    text.slice(0, match.index) +
    " " +
    text.slice(match.index + match[0].length)
  ).trim();
  return { amount, rest };
}

/** Words that carry no merchant meaning and get stripped before naming the merchant. */
const FILLER_WORDS = new Set([
  "on",
  "for",
  "at",
  "in",
  "to",
  "the",
  "a",
  "an",
  "of",
  "my",
  "spent",
  "paid",
  "bought",
  "got",
  "from",
  "and",
  "with",
  "via",
  "roughly",
  "about",
  "around",
  "approx",
  "nearly",
  "some",
  "worth",
  "rupees",
  "rs",
]);

const DATE_WORDS: Array<{ re: RegExp; offsetDays: number }> = [
  { re: /\bday before yesterday\b/i, offsetDays: 2 },
  { re: /\byesterday\b/i, offsetDays: 1 },
  { re: /\btoday\b/i, offsetDays: 0 },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1));
}

/**
 * Parse a raw expense message against the category keyword table.
 * `now` is injectable for tests.
 */
export function parseExpense(
  text: string,
  categories: CategoryRule[],
  now: Date = new Date(),
): ParseResult {
  let working = text.trim();

  // 1. Relative date words ("yesterday") set the expense date and drop out of the text.
  let offsetDays = 0;
  for (const { re, offsetDays: offset } of DATE_WORDS) {
    if (re.test(working)) {
      offsetDays = offset;
      working = working.replace(re, " ");
      break;
    }
  }
  const expenseDate = localDate(offsetDays, now);

  // 2. First number in the message is the amount.
  const { amount, rest } = extractAmount(working);
  if (amount === null) {
    return {
      ok: false,
      amount: null,
      category: null,
      merchant: null,
      expenseDate,
      error: "no_amount",
    };
  }

  // 3. Match remaining words against the keyword table. Longest keyword wins so
  //    "metro card" beats "card"-style partial matches.
  const haystack = rest.toLowerCase();
  let category: string | null = null;
  let matchedKeyword: string | null = null;
  for (const cat of categories) {
    for (const keyword of cat.keywords) {
      const kw = keyword.toLowerCase().trim();
      if (!kw) continue;
      const wordRe = new RegExp(
        `(?:^|[^a-z0-9])${escapeRegExp(kw)}(?:$|[^a-z0-9])`,
        "i",
      );
      if (
        wordRe.test(` ${haystack} `) &&
        (!matchedKeyword || kw.length > matchedKeyword.length)
      ) {
        category = cat.name;
        matchedKeyword = kw;
      }
    }
  }

  // 4. Merchant = what's left after dropping filler words; fall back to the keyword.
  const merchantWords = rest
    .split(/\s+/)
    .filter((w) => w && !FILLER_WORDS.has(w.toLowerCase()));
  let merchant: string | null =
    merchantWords.length > 0 ? titleCase(merchantWords.join(" ")) : null;
  if (!merchant && matchedKeyword) merchant = titleCase(matchedKeyword);
  if (merchant && merchant.length > 80) merchant = merchant.slice(0, 80);

  return { ok: true, amount, category, merchant, expenseDate };
}
