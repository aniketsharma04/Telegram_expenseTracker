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
  const sentences = `${body}`
    .replace(/\r/g, "")
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z"'(])/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const i = sentences.findIndex(
    (s) => MONEY.test(s) && (DEBIT_WORDS.test(s) || CREDIT_WORDS.test(s)),
  );
  if (i === -1) return null;
  const next = sentences[i + 1];
  return next && BALANCE.test(next) ? `${sentences[i]} ${next}` : sentences[i];
}
