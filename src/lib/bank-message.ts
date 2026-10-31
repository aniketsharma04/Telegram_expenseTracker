/**
 * Bank message parser (v9) — the shared brain for auto-capture.
 *
 * Every Indian bank, wallet and card issuer sends a transaction SMS or push
 * notification in roughly the same shape: a direction, an amount, a masked
 * account, a counterparty, and — the valuable part — very often the
 * available balance afterwards.
 *
 *   "Rs.20.00 debited from a/c XX1234 on 02-09-26 to VPA shop@ybl.
 *    Avl Bal Rs.4980.00"
 *
 * That trailing balance is why this module matters. Without it we could only
 * ever infer a balance by subtracting our own records, which drifts the
 * moment one message is missed. With it, the bank tells us the truth and any
 * gap between "what I've logged" and "what the bank says" becomes a number
 * the user can see and fix.
 *
 * Channel-agnostic on purpose: the same function serves the Android
 * notification listener, a forwarded SMS, and an email alert.
 */

export type Direction = "debit" | "credit";
export type TxnChannel = "upi" | "card" | "atm" | "netbanking" | "unknown";

export interface BankTxn {
  direction: Direction;
  amount: number;
  /** Last digits of the account or card the message names, e.g. "1234". */
  accountHint: string | null;
  /** Balance the bank reported *after* this transaction, when it says so. */
  balance: number | null;
  /** VPA, merchant or person on the other side. */
  counterparty: string | null;
  reference: string | null;
  channel: TxnChannel;
  /** low = parsed, but something was ambiguous; the app should confirm it. */
  confidence: "high" | "low";
  /** The text didn't settle which way the money went (see ingest's AI check). */
  directionUnsure?: boolean;
}

/**
 * Messages that mention money but move none. Checked first and hard-stopped:
 * a false positive here invents a transaction that never happened, which is
 * far worse than missing one.
 */
const NOT_A_TRANSACTION = [
  /\bwill be debited\b/i,
  /\bwill be deducted\b/i,
  /\bdue\b.{0,20}\bon\b/i,
  /payment request/i,
  // "You've received an IPO request … Click to accept": an ask, not money.
  /\b(?:ipo|mandate|money|autopay|upi)\s+request\b/i,
  /\bclick to (?:accept|approve|pay)\b/i,
  /\bapprove to\b/i,
  // Paying a card bill: the bank's debit is the transaction, not this "credit".
  /\breceived towards your\b.{0,30}\bcard\b/i,
  // "Recharge Reminder … expires today. Ignore if already paid."
  /\breminder\b/i,
  /\bif already paid\b/i,
  /\bexpires?\s+(?:today|tomorrow|on|in|soon)\b/i,
  /requesting money/i,
  /has requested/i,
  /collect request/i,
  // Money promised back later hasn't moved yet.
  /\bwill be (?:refunded|reversed|credited)\b/i,
  /\bcancelled\b/i,
  /total amount due/i,
  /minimum amount due/i,
  /statement (is )?(generated|ready)/i,
  /\boffer\b/i,
  /\bcashback offer\b/i,
  /\bapply now\b/i,
  /\bloan offer\b/i,
  /\beligible for\b/i,
  // "Bills paid. Cashback unlocked! Pay any bill of ₹100+ and get ₹5 back"
  /\bcashback unlocked\b/i,
  /\bpay any\b/i,
  /\bwhat are you waiting for\b/i,
  // "₹100+" is a threshold in an ad, never an amount that moved.
  /(?:rs\.?|inr|₹)\s*[\d,]+\+/i,
];

/** A payment that didn't go through — unless the message is the money back. */
const FAILED = [
  /\bdeclined\b/i,
  /\bfailed\b/i,
  /\breversed\b/i,
  /\bunsuccessful\b/i,
];

export const DEBIT_WORDS =
  /\b(debited|debit|spent|paid|sent|withdrawn|withdrawal|purchase|deducted|charged|transferred(?: to)?)\b/i;
export const CREDIT_WORDS =
  /\b(credited|credit|received|deposited|cash deposit|refund(?:ed)?|added to)\b/i;

/**
 * "Rs 500 credited back to your a/c for the failed UPI transaction": the
 * payment failed, but this message is the money coming home — real, and in.
 */
const MONEY_BACK =
  /\b(?:credited back|refunded|reversed to your|has been reversed|money back)\b|\brefund\b.{0,40}\bcredited\b/i;
/**
 * Who moved money to whom. Direction words alone can't tell: "Money received.
 * Ravi has sent ₹500 to your bank account" has both "received" and "sent".
 * These read the sentence shape — money arriving *in your* account, or leaving
 * *from your* account — and win over the bare words.
 */
const ACCOUNT_WORD = String.raw`(?:a\/c|ac|acct|account)`;
const INTO_YOU = [
  // "has sent ₹500 to your bank account", "transferred … to your A/c XX12"
  new RegExp(
    String.raw`\b(?:sent|transferred|deposited|credited|added|received)\b.{0,80}?\b(?:to|in|into)\s+your\s+(?:[\w-]+\s+){0,5}?${ACCOUNT_WORD}\b`,
    "i",
  ),
  // "A/C XX1090 credited by Rs 6", "your A/c XX12 has been credited with"
  new RegExp(
    String.raw`\b${ACCOUNT_WORD}\b(?:(?!debit)[^;]){0,40}?\bcredited\b`,
    "i",
  ),
  // "credited to HDFC Bank A/c XX1234"
  new RegExp(
    String.raw`\bcredited\s+(?:to|in(?:to)?)\s+(?:your\s+)?(?:[\w-]+\s+){0,4}?${ACCOUNT_WORD}\b`,
    "i",
  ),
  /\breceived\b.{0,60}?\bfrom\b/i,
  /\bmoney received\b/i,
  /\bsent you\b/i,
];
const FROM_YOU = [
  // "debited from a/c XX12", "Sent Rs.500 from Kotak Bank AC X1234"
  new RegExp(
    String.raw`\b(?:debited|deducted|withdrawn|sent|paid|transferred|spent)\b.{0,60}?\bfrom\s+(?:your\s+)?(?:(?!to\b)[\w-]+\s+){0,4}?(?:${ACCOUNT_WORD}|card|wallet)\b`,
    "i",
  ),
  // "A/c XX1234 is debited for", "Acct XX123 debited for …; SWIGGY credited"
  new RegExp(
    String.raw`\b(?:${ACCOUNT_WORD}|card)\b(?:(?!credit)[^;]){0,40}?\bdebited\b`,
    "i",
  ),
  /\byou(?:'ve| have)?\s+(?:paid|sent|spent|transferred)\b/i,
  /\b(?:has been|was|is)\s+(?:sent|paid|transferred)\s+to\s+(?!your\b)/i,
  /\bauto-?debited\b/i,
  /\bspent\b/i,
  /\bwithdrawn\b/i,
];

/** Position of the earliest match among `patterns`, or -1. */
function firstMatch(patterns: RegExp[], text: string): number {
  let best = -1;
  for (const p of patterns) {
    const at = text.match(p)?.index;
    if (at !== undefined && (best < 0 || at < best)) best = at;
  }
  return best;
}

/** "Credit Card" and "Debit Card" name a card, not a direction. */
const cardNamesOut = (text: string) =>
  text.replace(/\b(?:credit|debit)\s+card\b/gi, "card");

/** "Payment of Rs 600 to X is successful" — a debit with no debit word in it. */
/** Sales language: "get ₹50", "earn up to ₹150", "when you refer", "on your next payment". */
const OFFER =
  /\b(?:get|earn|win)\s+(?:flat\s+|up\s?to\s+|upto\s+)?(?:rs\.?|inr|₹)\s*[\d,]+|\bwhen you (?:send|pay|refer|spend|shop|invite|add|recharge)\b|\bon your (?:next|first) (?:payment|transaction|order|recharge)\b/i;

const PAYMENT_DONE =
  /\bpayment of\b.*\b(?:successful(?:ly)?|completed|done)\b/i;

/** "Rs.20.00", "Rs:500", "INR 1,250", "₹ 20", "20.0" after a direction word. */
const AMOUNT_PATTERNS = [
  /(?:rs\.?|inr|₹)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i,
  /\b(?:debited|credited)\s+(?:by|for|with)\s+([\d,]+(?:\.\d{1,2})?)/i,
  /\b(?:debited|credited)\s+([\d,]+(?:\.\d{1,2})?)/i,
];

/** "Avl Bal Rs.4980.00", "Available Balance: INR 4,980", "Bal Rs 4980". */
const BALANCE_PATTERNS = [
  /(?:avl|available|avbl|a\/c)\s*(?:bal|balance)\s*(?:is)?\s*[:.]?\s*(?:rs\.?|inr|₹)?\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i,
  /\bbal(?:ance)?\s*[:.]?\s*(?:rs\.?|inr|₹)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i,
];

/** "a/c XX1234", "A/C x1234", "Acct XX123", "Card no. XX1234", "ac 1234". */
const ACCOUNT_PATTERNS = [
  /(?:a\/c|acct|account|ac)\s*(?:no\.?)?\s*[xX*•]*(\d{3,6})\b/i,
  /card\s*(?:no\.?)?\s*[xX*•]*(\d{3,6})\b/i,
  /\b[xX*]{2,}(\d{3,6})\b/,
];

const REFERENCE_PATTERNS = [
  /\bUPI\/P2[AM]\/(\d{6,20})\b/i, // Axis: UPI/P2M/<ref>/<name>
  /\b(?:upi|ref(?:no)?|rrn|txn(?:\s*id)?)\s*[:.# ]\s*(\w{6,20})\b/i,
];

const num = (raw: string): number => Number(raw.replace(/,/g, ""));

const CODE_WORD =
  /\b(?:otp|one[- ]time password|verification code|passcode)\b/i;

/**
 * An OTP message, not a payment: a code word *and* a 4–8 digit code. Many
 * real debit alerts end "never share your OTP" — those must still count, so
 * the word alone isn't enough. Amounts, dates, masked accounts and long
 * reference numbers are removed before looking for the code.
 * Mirrors CaptureStore.carriesCode on the phone, which drops these unsent.
 */
export function carriesCode(text: string): boolean {
  if (!CODE_WORD.test(text)) return false;
  const rest = text
    .replace(/(?:rs\.?|inr|₹)\s*:?\s*[\d,]+(?:\.\d+)?/gi, " ")
    .replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, " ")
    .replace(
      /(?:a\/c|acct|account|ac|card)\s*(?:no\.?)?\s*[xX*•]*\d{3,6}\b/gi,
      " ",
    )
    .replace(/\b\d{9,}\b/g, " ");
  return /\b\d{4,8}\b/.test(rest);
}

/** Everything after the counterparty that is noise rather than a name. */
// Noise must start a word (or follow punctuation) — otherwise "AMAZON" loses its "ON".
const TAIL_NOISE =
  /(?:\s+|(?<=[.,;:]))(?:on|ref|refno|upi|rrn|txn|avl|avbl|available|updated|remaining|bal|balance|not you|if not|call|sms|dial|to block|-\s*\w+\s*bank)\b.*$/i;

function cleanCounterparty(raw: string | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(TAIL_NOISE, "").trim();
  s = s
    .replace(/[.,;:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  // A bare date or number is not a name, and "your bank account" is you.
  if (!s || /^[\d\s\-/.:]+$/.test(s) || /^your\b/i.test(s)) return null;
  // "at 7:02:53 PM" is when, not where.
  if (/^\d{1,2}:\d{2}/.test(s)) return null;
  return s.slice(0, 60);
}

function extractCounterparty(
  text: string,
  direction: Direction,
): {
  name: string | null;
  channel: TxnChannel;
} {
  // Axis puts the payee in the UPI path: "UPI/P2M/<ref>/BLINKIT".
  const upiPath = text.match(
    /\bUPI\/P2[AM]\/\d{6,20}\/([^/]+?)(?=\/|\s+not you|\s+\w+ bank\b|$)/i,
  );
  if (upiPath) return { name: cleanCounterparty(upiPath[1]), channel: "upi" };

  // A VPA is unambiguous, so it wins.
  const vpa = text.match(/\b([\w.\-]{2,}@[a-z]{2,})\b/i);
  if (vpa) return { name: vpa[1], channel: "upi" };

  // ICICI: "debited for Rs 250.00 on 24-Oct-26; SWIGGY credited."
  const credited = text.match(/;\s*([^;.]+?)\s+credited\b/i);
  if (credited && DEBIT_WORDS.test(text))
    return {
      name: cleanCounterparty(credited[1]),
      channel: /\bupi\b/i.test(text) ? "upi" : "unknown",
    };

  // Money in: the name is the sender, never the "to your account" part.
  if (direction === "credit") {
    const sender =
      text.match(
        /(?:^|[.!:]\s*)([A-Za-z][\w &'-]{1,60}?)\s+(?:has\s+)?sent\s+(?:you\s+)?(?:rs\.?|inr|₹)/i,
      )?.[1] ??
      text.match(
        /\bfrom\s+(?!your\b|a\/c|ac\b|acct)(.+?)(?=\s+(?:to|in|into|on|via|towards|for|has|was|is)\s|[.(;]|$)/i,
      )?.[1];
    return {
      name: cleanCounterparty(sender),
      channel: /\bupi\b/i.test(text) ? "upi" : "unknown",
    };
  }

  const trf = text.match(/\b(?:trf|transfer(?:red)?)\s+to\s+(.+)$/im);
  if (trf) return { name: cleanCounterparty(trf[1]), channel: "netbanking" };

  const to = text.match(/\bto\s+(?:vpa\s+)?(.+)$/im);
  const at = text.match(/\bat\s+(.+)$/im);
  const from = text.match(/\bfrom\s+(?!a\/c|ac\b|acct)(.+)$/im);

  if (/\batm\b|cash\s*(?:wdl|withdrawal)/i.test(text))
    return { name: cleanCounterparty(at?.[1]), channel: "atm" };
  if (/\bcard\b|\bpos\b|\bspent\b/i.test(text)) {
    // ICICI cards: "spent using ICICI Bank Card XX1234 on 24-Oct-26 on NETFLIX."
    const onMerchant = text.match(/\bon\s+\d[\w-]*\s+on\s+([^.]+)/i);
    return {
      name:
        cleanCounterparty(at?.[1]) ??
        cleanCounterparty(to?.[1]) ??
        cleanCounterparty(onMerchant?.[1]),
      channel: "card",
    };
  }

  const name = cleanCounterparty(to?.[1] ?? at?.[1] ?? from?.[1]);
  return { name, channel: /\bupi\b/i.test(text) ? "upi" : "unknown" };
}

/**
 * Pure: read one bank SMS or notification. Returns null when the text isn't a
 * completed transaction — an OTP, a payment request, a declined payment, a
 * statement or a promo all land here, and all of them must stay out of the
 * ledger.
 */
export function parseBankMessage(
  text: string,
  /** Settled elsewhere (the AI check, the user): read the rest around it. */
  knownDirection?: Direction,
): BankTxn | null {
  if (!text || text.trim().length < 12) return null;
  const body = text.replace(/\s+/g, " ").trim();

  for (const pattern of NOT_A_TRANSACTION) if (pattern.test(body)) return null;
  if (!MONEY_BACK.test(body) && FAILED.some((p) => p.test(body))) return null;
  if (carriesCode(body)) return null;

  const words = cardNamesOut(body);
  const debit = DEBIT_WORDS.test(words) || PAYMENT_DONE.test(words);
  const credit = CREDIT_WORDS.test(words);
  if (!debit && !credit) return null;

  // The sentence shape decides; bare words only when it says nothing. With
  // both shapes present the first is the transaction and the rest is detail.
  const into = firstMatch(INTO_YOU, words);
  const out = firstMatch(FROM_YOU, words);
  let direction: Direction;
  let unsure: boolean;
  if (knownDirection) {
    direction = knownDirection;
    unsure = false;
  } else if (into >= 0 && (out < 0 || into < out)) {
    direction = "credit";
    unsure = out >= 0;
  } else if (out >= 0) {
    direction = "debit";
    unsure = into >= 0;
  } else {
    direction = credit && !debit ? "credit" : "debit";
    unsure = debit && credit;
  }

  let amount: number | null = null;
  for (const pattern of AMOUNT_PATTERNS) {
    const m = body.match(pattern);
    if (m) {
      amount = num(m[1]);
      break;
    }
  }
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return null;

  let balance: number | null = null;
  for (const pattern of BALANCE_PATTERNS) {
    const m = body.match(pattern);
    if (m) {
      const value = num(m[1]);
      // The balance must not be the transaction amount read twice.
      if (
        Number.isFinite(value) &&
        m.index !== body.match(AMOUNT_PATTERNS[0])?.index
      ) {
        balance = value;
        break;
      }
    }
  }

  let accountHint: string | null = null;
  for (const pattern of ACCOUNT_PATTERNS) {
    const m = body.match(pattern);
    if (m) {
      accountHint = m[1];
      break;
    }
  }

  let reference: string | null = null;
  for (const pattern of REFERENCE_PATTERNS) {
    const m = body.match(pattern);
    if (m) {
      reference = m[1];
      break;
    }
  }

  // "Get Rs.200 credited to your account when you refer…": an offer reads
  // like a credit. Real alerts carry an account, a reference or a balance —
  // an offer pitch with none of them is an ad, while a real alert with an
  // offer footer stays a transaction.
  if (OFFER.test(body) && !accountHint && !reference && balance === null)
    return null;

  const { name, channel } = extractCounterparty(body, direction);

  // Direction unclear, or neither the account nor a counterparty known:
  // parsed, but worth a human glance before it changes any total.
  const ambiguous = unsure || (!accountHint && !name);

  return {
    direction,
    amount,
    accountHint,
    balance,
    counterparty: name,
    reference,
    channel,
    confidence: ambiguous ? "low" : "high",
    directionUnsure: unsure,
  };
}

/**
 * Google Pay bundles several payments into one notification:
 *   "2 new completed transaction updates. ⋅ Ravi has sent ₹1 to your bank
 *    account\n⋅ ₹30 has been sent to MOTHER DAIRY"
 * Each bullet that carries an amount is its own transaction. Anything else
 * comes back whole.
 */
export function splitGroupedNotification(text: string): string[] {
  const items = text
    .split(/\s*[⋅•]\s+/)
    .map((s) => s.trim())
    .filter((s) => /(?:rs\.?|inr|₹)\s*:?\s*\d/i.test(s));
  return items.length >= 2 ? items : [text];
}

/**
 * Does this text look like it came from a bank at all? Used to decide
 * whether a forwarded message should go to the ingest path instead of the
 * ordinary expense parser.
 */
export function looksLikeBankMessage(text: string): boolean {
  if (!text) return false;
  const body = text.replace(/\s+/g, " ");
  const money = /(?:rs\.?|inr|₹)\s*:?\s*[\d,]/i.test(body);
  const account = ACCOUNT_PATTERNS.some((p) => p.test(body));
  const moved = DEBIT_WORDS.test(body) || CREDIT_WORDS.test(body);
  return moved && (money || account) && body.length > 25;
}

/**
 * Pick the account a message refers to by its masked digits. Returns null
 * when nothing matches or two accounts match equally well — guessing which
 * account moved is worse than leaving it unassigned.
 */
export function matchAccountByHint<
  T extends { id: string; identifier: string | null },
>(hint: string | null, accounts: T[]): T | null {
  if (!hint) return null;
  const digits = hint.replace(/\D/g, "");
  if (digits.length < 3) return null;

  const matches = accounts.filter((a) => {
    const own = (a.identifier ?? "").replace(/\D/g, "");
    if (own.length < 3) return false;
    return own.endsWith(digits) || digits.endsWith(own);
  });
  return matches.length === 1 ? matches[0] : null;
}
