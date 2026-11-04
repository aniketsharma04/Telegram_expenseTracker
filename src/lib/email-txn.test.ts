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

/**
 * "DEBIT TRANSACTION ALERT" mails are tables: no single line has both an
 * amount and "debited", so these used to be ignored — 9 real debits in the
 * owner's inbox in one week (28–30 Oct 2026).
 */
describe("emailTxnText on label/value alerts", () => {
  // What htmlToText makes of a <table>: one "Label value" row per line.
  const table = `Dear Customer,
Greetings from the bank. The following transaction has been made on your account:
Account Number XXXXXX4521
Transaction Date 28-10-2026 18:42:10
Transaction Amount INR 1,250.00
Transaction Type Debit
Description UPI/612345678901/SWIGGY LIMITED
Available Balance INR 10,250.50
If this was not you, call 1800 425 1400.
Pre-approved loan up to Rs 5,00,000. Apply now.`;

  it("reads a table alert as a debit with amount, merchant and balance", () => {
    const text = emailTxnText("DEBIT TRANSACTION ALERT", table);
    expect(text).toMatch(/^INR 1,250\.00 debited from A\/c XXXXXX4521/);
    const txn = parseBankMessage(text!);
    expect(txn?.direction).toBe("debit");
    expect(txn?.amount).toBe(1250);
    expect(txn?.balance).toBe(10250.5);
    expect(txn?.counterparty ?? "").toMatch(/swiggy/i);
  });

  it("takes the direction from a type field over a generic subject", () => {
    const text = emailTxnText(
      "Transaction alert",
      "Account No: XX9876\nAmount: Rs. 25,000.00\nDr/Cr: CR\nRemarks: NEFT-SALARY ACME TECH\nAvailable Balance: Rs. 61,200.00",
    );
    const txn = parseBankMessage(text!);
    expect(txn?.direction).toBe("credit");
    expect(txn?.amount).toBe(25000);
  });

  it("reads colon and next-line layouts", () => {
    const text = emailTxnText(
      "Debit Alert",
      "Card No:\nXXXX1111\nAmount:\nINR 499.00\nMerchant Name:\nNETFLIX\nDate:\n29/10/2026",
    );
    const txn = parseBankMessage(text!);
    expect(txn?.amount).toBe(499);
    expect(txn?.direction).toBe("debit");
  });

  it("never invents a transaction without a stated direction", () => {
    // A promo with a price and an "Amount" line, but no debit/credit anywhere.
    expect(
      emailTxnText(
        "🪔 StockEdge Premium for just ₹1,499/yr",
        "Amount ₹1,499\nOffer valid till 5 Nov",
      ),
    ).toBeNull();
    // A card bill is not a credit, even with "Credit" in the subject.
    expect(
      emailTxnText(
        "Your Credit Card payment due alert",
        "Total Amount Due INR 12,450.00\nMinimum Amount Due INR 620.00\nDue Date 15-11-2026",
      ),
    ).toBeNull();
    expect(
      emailTxnText("OTP for transaction", "Amount INR 2,000\nOTP 482913"),
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

describe("emailTxnText keeps the payment rail", () => {
  it("marks a UPI table alert as UPI", () => {
    const text = emailTxnText(
      "DEBIT TRANSACTION ALERT",
      "Transaction Amount INR 80.00\nTransaction Type Debit\nDescription UPI/612345678902/RAPIDO",
    );
    expect(parseBankMessage(text!)?.channel).toBe("upi");
  });
});
