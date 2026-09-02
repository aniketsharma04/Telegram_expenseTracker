import { describe, it, expect } from "vitest";
import {
  looksLikeBankMessage,
  matchAccountByHint,
  parseBankMessage,
} from "./bank-message";

/**
 * The samples below follow the templates HDFC, ICICI, SBI, Axis, Kotak and
 * the UPI apps actually send. Getting these right is the whole feature.
 */

describe("parseBankMessage — real templates", () => {
  it("reads an HDFC UPI debit with the balance", () => {
    const txn = parseBankMessage(
      "Rs.20.00 debited from a/c XX1234 on 02-09-26 to VPA chaiwala@ybl. Avl Bal Rs.4980.00. Not you? Call 18002586161",
    );
    expect(txn?.direction).toBe("debit");
    expect(txn?.amount).toBe(20);
    expect(txn?.accountHint).toBe("1234");
    expect(txn?.balance).toBe(4980);
    expect(txn?.counterparty).toBe("chaiwala@ybl");
    expect(txn?.channel).toBe("upi");
    expect(txn?.confidence).toBe("high");
  });

  it("reads an SBI UPI debit", () => {
    const txn = parseBankMessage(
      "Dear UPI user A/C X1234 debited by 250.0 on date 02Sep26 trf to BLUE TOKAI Refno 123456789012. If not u? call 1800111109. -SBI",
    );
    expect(txn?.direction).toBe("debit");
    expect(txn?.amount).toBe(250);
    expect(txn?.accountHint).toBe("1234");
    expect(txn?.counterparty).toBe("BLUE TOKAI");
    expect(txn?.reference).toBe("123456789012");
  });

  it("reads an ICICI debit", () => {
    const txn = parseBankMessage(
      "ICICI Bank Acct XX789 debited for Rs 1,250.00 on 02-Sep-26; Swiggy credited. UPI:445566778899. Call 18002662 for dispute.",
    );
    expect(txn?.amount).toBe(1250);
    expect(txn?.accountHint).toBe("789");
    expect(txn?.reference).toBe("445566778899");
  });

  it("reads a card spend with no account balance", () => {
    const txn = parseBankMessage(
      "Spent Card no. XX4455 INR 899.00 02-09-26 19:42:11 AMAZON. Not you? Report at axisbank.com",
    );
    expect(txn?.direction).toBe("debit");
    expect(txn?.amount).toBe(899);
    expect(txn?.accountHint).toBe("4455");
    expect(txn?.balance).toBeNull();
    expect(txn?.channel).toBe("card");
  });

  it("reads a salary credit and keeps the balance", () => {
    const txn = parseBankMessage(
      "Your a/c no. XXXXXXXX1234 is credited by Rs.85,000.00 on 01-09-26 by a/c linked to VPA payroll@icici. Avl Bal Rs.89,980.00",
    );
    expect(txn?.direction).toBe("credit");
    expect(txn?.amount).toBe(85000);
    expect(txn?.balance).toBe(89980);
  });

  it("reads an ATM withdrawal", () => {
    const txn = parseBankMessage(
      "Rs.5000 withdrawn from a/c XX1234 at ATM CONNAUGHT PLACE on 02-09-26. Avl Bal Rs.4000.00",
    );
    expect(txn?.direction).toBe("debit");
    expect(txn?.amount).toBe(5000);
    expect(txn?.channel).toBe("atm");
    expect(txn?.balance).toBe(4000);
  });

  it("handles the user's own example end to end", () => {
    const txn = parseBankMessage(
      "Rs.20.00 debited from a/c XX1234. Avl Bal Rs.4980.00",
    );
    expect(txn?.amount).toBe(20);
    expect(txn?.balance).toBe(4980);
  });
});

describe("parseBankMessage — what must never become a transaction", () => {
  const rejected = [
    [
      "an OTP",
      "123456 is your OTP for a transaction of Rs.2000 at Amazon. Do not share.",
    ],
    [
      "a payment request",
      "Ravi has requested Rs.500 via UPI. Approve in your app.",
    ],
    ["a scheduled debit", "Your SIP of Rs.5000 will be debited on 05-09-26."],
    [
      "a failed payment",
      "Your payment of Rs.999 has failed. Amount will be reversed.",
    ],
    ["a declined card", "Transaction of Rs.2500 on Card XX1234 was declined."],
    [
      "a card statement",
      "Total amount due Rs.12,450 on Card XX1234 by 18-09-26.",
    ],
    [
      "a promo",
      "Get 10% cashback offer up to Rs.500 on your next spend. Apply now.",
    ],
    [
      "a bill reminder",
      "Your electricity bill of Rs.1,240 is due on 12-09-26.",
    ],
    ["plain chat", "hey did you pay the rent"],
  ] as const;

  for (const [label, text] of rejected) {
    it(`rejects ${label}`, () => {
      expect(parseBankMessage(text)).toBeNull();
    });
  }

  it("rejects text with no direction word at all", () => {
    expect(parseBankMessage("Rs.500 at Blue Tokai on 02-09-26")).toBeNull();
  });

  it("rejects something far too short to judge", () => {
    expect(parseBankMessage("Rs.20")).toBeNull();
  });
});

describe("confidence", () => {
  it("flags a message naming neither an account nor a counterparty", () => {
    const txn = parseBankMessage("Rs.300.00 has been debited on 02-09-26.");
    expect(txn?.confidence).toBe("low");
  });

  it("is confident when the account and the payee are both known", () => {
    const txn = parseBankMessage(
      "Rs.300.00 debited from a/c XX1234 to VPA store@paytm on 02-09-26",
    );
    expect(txn?.confidence).toBe("high");
  });
});

describe("looksLikeBankMessage", () => {
  it("recognises a forwarded bank SMS", () => {
    expect(
      looksLikeBankMessage(
        "Rs.20.00 debited from a/c XX1234 on 02-09-26 to VPA chaiwala@ybl. Avl Bal Rs.4980.00",
      ),
    ).toBe(true);
  });

  it("leaves an ordinary expense message to the normal parser", () => {
    expect(looksLikeBankMessage("250 lunch at swiggy")).toBe(false);
    expect(looksLikeBankMessage("300 zomato")).toBe(false);
  });
});

describe("matchAccountByHint", () => {
  const accounts = [
    { id: "hdfc", identifier: "1234" },
    { id: "icici", identifier: "9876" },
    { id: "cash", identifier: null },
  ];

  it("matches on the masked digits", () => {
    expect(matchAccountByHint("1234", accounts)?.id).toBe("hdfc");
  });

  it("matches when the message shows more digits than we stored", () => {
    expect(matchAccountByHint("XXXX1234", accounts)?.id).toBe("hdfc");
  });

  it("returns nothing when no account matches", () => {
    expect(matchAccountByHint("5555", accounts)).toBeNull();
  });

  it("refuses to guess between two equally good matches", () => {
    const ambiguous = [
      { id: "a", identifier: "1234" },
      { id: "b", identifier: "1234" },
    ];
    expect(matchAccountByHint("1234", ambiguous)).toBeNull();
  });

  it("has nothing to match without a hint", () => {
    expect(matchAccountByHint(null, accounts)).toBeNull();
  });
});
