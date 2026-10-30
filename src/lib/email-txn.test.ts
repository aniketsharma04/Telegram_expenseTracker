import { describe, expect, it } from "vitest";
import { emailTxnText, MAIL_QUERY } from "./email-txn";
import { parseBankMessage } from "./bank-message";

/**
 * Bank alert emails carry one sentence that matters inside a long template:
 * greeting, the transaction, a balance, then a footer of offers and legal
 * text. The footer must not decide anything.
 */
describe("emailTxnText", () => {
  const hdfcUpi = `Dear Customer,

Rs.249.00 has been debited from account **4321 to VPA swiggy@icici SWIGGY on 28-10-26. Your UPI transaction reference number is 612345678901.

If you did not authorize this transaction, please report it immediately by calling 18002586161.

Warm Regards,
HDFC Bank

Get pre-approved personal loan offer up to Rs.5,00,000. Apply now! T&C apply.`;

  it("keeps the transaction sentence and drops the promo footer", () => {
    const text = emailTxnText(
      "❗ You have done a UPI txn. Check details!",
      hdfcUpi,
    );
    expect(text).toContain("Rs.249.00 has been debited");
    expect(text).not.toMatch(/loan offer|apply now/i);
    const txn = parseBankMessage(text!);
    expect(txn?.direction).toBe("debit");
    expect(txn?.amount).toBe(249);
    expect(txn?.counterparty).toMatch(/swiggy/i);
  });

  it("keeps a balance stated in the next sentence", () => {
    const text = emailTxnText(
      "Transaction alert",
      "Dear Customer, INR 1,200.00 was spent on your ICICI Bank Credit Card XX9876 at AMAZON on 27-Oct-26. Available Credit Limit: INR 48,800.00. Not you? Call 18001080.",
    );
    const txn = parseBankMessage(text!);
    expect(txn?.amount).toBe(1200);
    expect(txn?.direction).toBe("debit");
  });

  it("returns null when no sentence moves money", () => {
    expect(
      emailTxnText(
        "Your statement is ready",
        "Dear Customer, your credit card statement for October is attached. Total amount due Rs.12,450.",
      ),
    ).toBeNull();
    expect(
      emailTxnText("Big Diwali sale", "Flat 50% off. Shop now!"),
    ).toBeNull();
  });
});

describe("parseBankMessage on card-bill payments", () => {
  it("doesn't count paying a card bill as income", () => {
    // The bank debit for this payment is the real transaction.
    expect(
      parseBankMessage(
        "Payment of Rs.12,450.00 received towards your ICICI Bank Credit Card XX9876. Thank you.",
      ),
    ).toBeNull();
  });
});

describe("MAIL_QUERY", () => {
  it("covers bills and recent transaction alerts, not promotions", () => {
    expect(MAIL_QUERY).toContain("-category:promotions");
    expect(MAIL_QUERY).toMatch(/newer_than:45d/);
    expect(MAIL_QUERY).toMatch(/newer_than:10d/);
    expect(MAIL_QUERY).toMatch(/debited/);
  });
});
