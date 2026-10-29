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
  /requesting money/i,
  /has requested/i,
  /collect request/i,
  /\bdeclined\b/i,
  /\bfailed\b/i,
  /\breversed\b/i,
  /\bunsuccessful\b/i,
  /\bcancelled\b/i,
  /total amount due/i,
  /minimum amount due/i,
  /statement (is )?(generated|ready)/i,
  /\boffer\b/i,
  /\bcashback offer\b/i,
  /\bapply now\b/i,
  /\bloan offer\b/i,
  /\beligible for\b/i,
];

const DEBIT_WORDS =
  /\b(debited|debit|spent|paid|sent|withdrawn|withdrawal|purchase|deducted|charged|transferred to)\b/i;
const CREDIT_WORDS =
  /\b(credited|credit|received|deposited|refund(?:ed)?|added to)\b/i;
/** "Payment of Rs 600 to X is successful" — a debit with no debit word in it. */
const PAYMENT_DONE =
  /\bpayment of\b.*\b(?:successful(?:ly)?|completed|done)\b/i;

/** "Rs.20.00", "INR 1,250", "₹ 20", "20.0" after a direction word. */
const AMOUNT_PATTERNS = [
  /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /\b(?:debited|credited)\s+(?:by|for|with)\s+([\d,]+(?:\.\d{1,2})?)/i,
  /\b(?:debited|credited)\s+([\d,]+(?:\.\d{1,2})?)/i,
];

/** "Avl Bal Rs.4980.00", "Available Balance: INR 4,980", "Bal Rs 4980". */
const BALANCE_PATTERNS = [
  /(?:avl|available|avbl|a\/c)\s*(?:bal|balance)\s*(?:is)?\s*[:.]?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  /\bbal(?:ance)?\s*[:.]?\s*(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
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
    .replace(/(?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d+)?/gi, " ")
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
  /(?:\s+|(?<=[.,;:]))(?:on|ref|refno|upi|rrn|txn|avl|avbl|available|bal|balance|not you|if not|call|sms|dial|to block|-\s*\w+\s*bank)\b.*$/i;

function cleanCounterparty(raw: string | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(TAIL_NOISE, "").trim();
  s = s.replace(/[.,;:]+$/, "").trim();
  // A bare date or number is not a name.
  if (!s || /^[\d\s\-/.:]+$/.test(s)) return null;
  return s.slice(0, 60);
}

function extractCounterparty(text: string): {
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
      name: cleanCounterparty(at?.[1] ?? to?.[1] ?? onMerchant?.[1]),
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
export function parseBankMessage(text: string): BankTxn | null {
  if (!text || text.trim().length < 12) return null;
  const body = text.replace(/\s+/g, " ").trim();

  for (const pattern of NOT_A_TRANSACTION) if (pattern.test(body)) return null;
  if (carriesCode(body)) return null;

  const debit = DEBIT_WORDS.test(body) || PAYMENT_DONE.test(body);
  const credit = CREDIT_WORDS.test(body);
  if (!debit && !credit) return null;

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

  const { name, channel } = extractCounterparty(body);

  // Both directions named, or neither the account nor a counterparty known:
  // parsed, but worth a human glance before it changes any total.
  const ambiguous = (debit && credit) || (!accountHint && !name);

  return {
    direction:
      debit && !credit ? "debit" : credit && !debit ? "credit" : "debit",
    amount,
    accountHint,
    balance,
    counterparty: name,
    reference,
    channel,
    confidence: ambiguous ? "low" : "high",
  };
}

/**
 * Does this text look like it came from a bank at all? Used to decide
 * whether a forwarded message should go to the ingest path instead of the
 * ordinary expense parser.
 */
export function looksLikeBankMessage(text: string): boolean {
  if (!text) return false;
  const body = text.replace(/\s+/g, " ");
  const money = /(?:rs\.?|inr|₹)\s*[\d,]/i.test(body);
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
