import { BILL_SUBJECTS } from "./bill-detect";
import { CREDIT_WORDS, DEBIT_WORDS } from "./bank-message";

/**
 * Transactions from email (v18): bank and card alert emails become ledger
 * rows through the same ingest path as SMS and notifications, so the same
 * purchase arriving by both routes is logged once.
 *
 * One Gmail search covers both jobs the mail scan does: bills (45 days back,
 * as before) and transaction alerts (10 days back, so connecting Gmail
 * doesn't pour weeks of history into the ledger).
 */
export const MAIL_QUERY = [
  "-category:promotions",
  "-category:social",
  "(",
  `(newer_than:45d (${BILL_SUBJECTS}))`,
  "OR",
  '(newer_than:10d subject:(debited OR credited OR "transaction alert" OR txn OR transaction OR UPI OR spent OR "payment successful" OR "money sent" OR "money received"))',
  ")",
].join(" ");

const MONEY =
  /(?:rs\.?|inr|₹)\s*[\d,]|\b(?:debited|credited)\s+(?:by|for|with)?\s*\d/i;
const BALANCE = /\b(?:bal|balance|limit)\b/i;

/**
 * The sentence of a bank email that reports the transaction, plus a balance
 * stated right after it — or null when no sentence moves money. Emails wrap
 * that sentence in greetings and a footer of loan offers and "apply now",
 * which would trip the parser's promo rules if it saw the whole thing.
 */
export function emailTxnText(subject: string, body: string): string | null {
  const clean = `${body}`.replace(/\r/g, "").replace(/[​-‍﻿]/g, "");
  const sentences = clean
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const i = sentences.findIndex(
    (s) => MONEY.test(s) && (DEBIT_WORDS.test(s) || CREDIT_WORDS.test(s)),
  );
  if (i !== -1) {
    const next = sentences[i + 1];
    return next && BALANCE.test(next)
      ? `${sentences[i]} ${next}`
      : sentences[i];
  }
  return tableTxnText(subject, clean);
}

// ── Label/value alerts ──────────────────────────────────────────────────────
//
// Many banks (Bank of India, Indian Bank, Union, Canara, IDBI, card issuers'
// "DEBIT TRANSACTION ALERT" mails) send an HTML table instead of a sentence:
//
//   Account Number      XXXXXX1234
//   Transaction Amount  INR 1,250.00
//   Transaction Type    Debit
//   Description         UPI/612345678901/SWIGGY
//   Available Balance   INR 10,250.50
//
// No single line has both an amount and "debited", so the sentence search
// finds nothing and the debit used to be dropped. Here the labelled fields are
// read and rewritten as the one-line SMS the parser already understands. The
// direction must be stated outright — by the subject ("Debit transaction
// alert") or a type field ("Dr", "Credit") — never guessed from an amount, so
// a promo mail with a price in it can't become a transaction.

const AMOUNT_VALUE = /(?:rs\.?|inr|₹)?\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i;

function field(text: string, label: RegExp): string | null {
  // A label at the start of a line, then the value after ":", "-", "|" or just
  // spaces (HTML table cells flatten to "Label value"), or on the next line.
  const re = new RegExp(
    `(?:^|\\n)[ \\t]*(?:${label.source})(?:[ \\t]*[:\\-–|][ \\t]*\\n?[ \\t]*|[ \\t]+|[ \\t]*\\n[ \\t]*)([^\\n]+)`,
    "i",
  );
  const m = text.match(re);
  return m ? m[1].replace(/\s+/g, " ").trim() : null;
}

function directionOf(subject: string, text: string): "debit" | "credit" | null {
  const type = field(
    text,
    /(?:transaction|txn)\s*type|type\s*of\s*transaction|dr\s*\/\s*cr/,
  );
  const says = (s: string) =>
    /\b(debit|debited|dr|withdrawal|spent|purchase)\b/i.test(s)
      ? "debit"
      : /\b(credit|credited|cr|deposit|refund)\b/i.test(s)
        ? "credit"
        : null;
  if (type) return says(type);
  // "Credit card payment due" is a bill, not a credit: card names say nothing
  // about direction, and bills, statements and reminders are never alerts.
  const s = subject.replace(/\b(credit|debit)\s+card\b/gi, "card");
  if (/\b(due|statement|reminder|bill|e-?mandate|otp|offer)\b/i.test(s))
    return null;
  return /transaction|txn|alert|account update/i.test(s) ? says(s) : null;
}

function tableTxnText(subject: string, text: string): string | null {
  const direction = directionOf(subject, text);
  if (!direction) return null;

  const amountRaw = field(
    text,
    /(?:transaction|txn)?\s*amount(?:\s*\((?:rs\.?|inr|₹)\))?|amt/,
  );
  const amount = amountRaw?.match(AMOUNT_VALUE)?.[1];
  if (!amount || Number(amount.replace(/,/g, "")) <= 0) return null;

  const account = field(
    text,
    /(?:account|a\/c|acct|card)\s*(?:number|no\.?)?/,
  )?.match(/[x*•X]*\d{3,6}\b/)?.[0];
  const what = field(
    text,
    /description|narration|remarks?|particulars|merchant(?:\s*name)?|beneficiary(?:\s*name)?|paid\s*to|(?:info|to)(?=\s*:)/,
  );
  const when = field(
    text,
    /(?:transaction|txn|value)?\s*date(?:\s*(?:&|and)\s*time)?/,
  );
  const balance = field(
    text,
    /(?:available|avl\.?|avail\.?|closing)\s*(?:bal(?:ance)?)/,
  )?.match(AMOUNT_VALUE)?.[1];

  const party = what ? counterpartyOf(what) : null;
  const rail = what
    ?.match(/\b(UPI|NEFT|IMPS|RTGS|POS|ATM)\b/i)?.[1]
    ?.toUpperCase();
  const verb = direction === "debit" ? "debited from" : "credited to";
  const parts = [
    `INR ${amount} ${verb} A/c ${account ?? ""}`.trim(),
    when ? `on ${when}` : "",
    party?.name ? `${direction === "debit" ? "at" : "from"} ${party.name}` : "",
    // Keep the rail the parser reads off the wording (UPI / NEFT / IMPS / card).
    rail ? `via ${rail}` : "",
  ].filter(Boolean);
  return [
    `${parts.join(" ")}.`,
    party?.ref ? `Ref no ${party.ref}.` : "",
    balance ? `Avl Bal INR ${balance}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * "UPI/612345678901/SWIGGY LIMITED", "POS 4521XXXX NETFLIX.COM",
 * "NEFT-HDFC0001234-ACME TECH" → the name and the reference, as the SMS
 * wording the parser reads ("at NAME", "Ref no 612345678901").
 */
function counterpartyOf(desc: string): {
  name: string | null;
  ref: string | null;
} {
  const bits = desc
    .split(/[/\-|:]+/)
    .map((b) => b.trim())
    .filter(Boolean);
  const ref = bits.find((b) => /^\d{9,}$/.test(b)) ?? null;
  const words = bits
    .filter((b) => /[a-z]{3,}/i.test(b))
    .filter(
      (b) =>
        !/^(upi|neft|imps|rtgs|pos|ecom|ach|nach|mb|ib|p2m|p2a|dr|cr)$/i.test(
          b,
        ),
    )
    .map((b) =>
      b
        .replace(/^(?:upi|pos|ecom)\s+/i, "")
        .replace(/\b\d{4,}\b/g, "")
        .trim(),
    )
    .filter(Boolean);
  const name = words.sort((a, b) => b.length - a.length)[0] ?? null;
  return { name: name ? name.slice(0, 60) : null, ref };
}
