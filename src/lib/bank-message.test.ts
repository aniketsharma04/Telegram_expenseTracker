import { describe, it, expect } from "vitest";
import {
  looksLikeBankMessage,
  matchAccountByHint,
  parseBankMessage,
  splitGroupedNotification,
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

  it("reads 'Rs:' with a colon (Union Bank style)", () => {
    const txn = parseBankMessage(
      "A/c *1234 Debited for Rs:500.00 on 28-10-2026 15:20:11 by Mob Bk ref no 612345678901 Avl Bal Rs:2,345.67. Never share your OTP.-Union Bank of India",
    );
    expect(txn?.direction).toBe("debit");
    expect(txn?.amount).toBe(500);
    expect(txn?.balance).toBe(2345.67);
  });

  it("reads a 'Money Transferred' alert", () => {
    const txn = parseBankMessage(
      "Money Transferred - Rs 1,500.00 from HDFC Bank A/c **1234 on 28-10-26 to RAVI KUMAR UPI: 612345678901 Not you? Call 18002586161",
    );
    expect(txn?.direction).toBe("debit");
    expect(txn?.amount).toBe(1500);
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
    // Real captures that were logged as money (Oct 2026).
    [
      "an IPO mandate request",
      "JD-PHONPE-S. You've received an IPO request from BLS POLYMERS LIMITED for Rs.15000. Click to accept. https://phone.pe/PHONPE/abs96pam",
    ],
    [
      "a recharge reminder",
      "Recharge Reminder. Your Jio recharge pack of Rs.299 for mobile number 9999999999 expires today. Ignore if already paid. Earn up to ₹10 back* using",
    ],
    [
      "a mandate to approve",
      "You've received a mandate request of Rs.499 from NETFLIX. Approve to start AutoPay.",
    ],
    [
      "a plan expiry notice",
      "Your plan of Rs.239 has expired. Recharge now to continue.",
    ],
  ] as const;

  for (const [label, text] of rejected) {
    it(`rejects ${label}`, () => {
      expect(parseBankMessage(text)).toBeNull();
    });
  }

  it("still logs a real AutoPay debit", () => {
    const txn = parseBankMessage(
      "AutoPay successful!. ₹13428 has been auto-debited towards JIO PLATFORMS LIMITED.",
    );
    expect(txn?.direction).toBe("debit");
    expect(txn?.amount).toBe(13428);
  });

  it("still logs a real credit that mentions receiving", () => {
    const txn = parseBankMessage(
      "You've received Rs.500 from Ravi Kumar in your HDFC Bank A/C XX1234 via UPI.",
    );
    expect(txn?.direction).toBe("credit");
    expect(txn?.amount).toBe(500);
  });

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

describe("parseBankMessage — merchant extraction (v15 capture hardening)", () => {
  const cp = (text: string) => parseBankMessage(text)?.counterparty ?? null;

  it("doesn't chop merchants whose names end in a noise word", () => {
    expect(
      cp(
        "Rs.1,299.00 spent on HDFC Bank Card x1234 at AMAZON PAY INDIA on 2026-10-24:10:11:12 Avl Lmt: Rs.98,701.00",
      ),
    ).toBe("AMAZON PAY INDIA");
    expect(
      cp("Rs.300 debited from a/c XX1234 to VPA decathlon@ybl on 24-10-26"),
    ).toBe("decathlon@ybl");
  });

  it("reads the merchant from the Axis UPI/P2M line, not the helpline", () => {
    const txn = parseBankMessage(
      "INR 400.00 debited\nA/c no. XX1234\n24-10-26, 10:12:11\nUPI/P2M/629812345678/BLINKIT\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank",
    );
    expect(txn?.counterparty).toBe("BLINKIT");
    expect(txn?.reference).toBe("629812345678");
    expect(txn?.channel).toBe("upi");
  });

  it("reads ICICI's '; MERCHANT credited' and card 'on MERCHANT' forms", () => {
    expect(
      cp(
        "ICICI Bank Acct XX123 debited for Rs 250.00 on 24-Oct-26; SWIGGY credited. UPI:629812345678. Call 18002662 for dispute.",
      ),
    ).toBe("SWIGGY");
    expect(
      cp(
        "INR 649.00 spent using ICICI Bank Card XX1234 on 24-Oct-26 on NETFLIX. Avl Limit: INR 1,00,000.00. If not you, call 1800 2662",
      ),
    ).toBe("NETFLIX");
  });

  it("treats 'Payment of Rs X to Y is successful' as a debit", () => {
    const txn = parseBankMessage(
      "Payment of Rs 600.00 to swiggy.stores@axisbank is successful",
    );
    expect(txn?.direction).toBe("debit");
    expect(txn?.amount).toBe(600);
    expect(txn?.counterparty).toBe("swiggy.stores@axisbank");
  });

  it("still ignores what isn't a completed payment", () => {
    expect(
      parseBankMessage(
        "Your OTP for transaction of Rs.500 at AMAZON is 123456. Do not share",
      ),
    ).toBeNull();
    expect(
      parseBankMessage(
        "Rs.500 will be debited from your account on 25-10-26 towards SIP",
      ),
    ).toBeNull();
    expect(
      parseBankMessage(
        "Payment of Rs 600.00 to swiggy.stores@axisbank has failed",
      ),
    ).toBeNull();
  });
});

describe("parseBankMessage — OTP handling", () => {
  it("drops a message that carries a code", () => {
    expect(
      parseBankMessage(
        "Your OTP for transaction of Rs.1500 at AMAZON is 482913. Do not share",
      ),
    ).toBeNull();
    expect(
      parseBankMessage(
        "482913 is your one-time password for Rs.2,000 debit at FLIPKART",
      ),
    ).toBeNull();
  });

  it("keeps a real payment whose footer merely mentions OTPs", () => {
    const txn = parseBankMessage(
      "Rs.1500.00 debited from a/c XX1234 on 24-10-26 to VPA zepto@ybl. Never share your OTP or PIN with anyone. Call 18002586161",
    );
    expect(txn?.amount).toBe(1500);
    expect(txn?.counterparty).toBe("zepto@ybl");
  });
});

describe("parseBankMessage — who paid whom (credit vs debit)", () => {
  const credits: [string, string, number, string | null][] = [
    [
      "Google Pay: someone sent money to your bank account",
      "Money received. Mridul  Sharma has sent ₹31,000 to your bank account State Bank of India-1090",
      31000,
      "Mridul Sharma",
    ],
    [
      "a salary NEFT that says 'transferred'",
      "INR 85,000.00 transferred from ACME TECHNOLOGIES PVT LTD to your A/c XX1090 on 01-11-26 towards SALARY NOV. Avl Bal INR 91,200.00",
      85000,
      "ACME TECHNOLOGIES PVT LTD",
    ],
    [
      "an SBI salary credit by NEFT",
      "Dear Customer, your A/C XXXXX401090 has been credited with INR 85,000.00 on 01/11/26 by NEFT-ACME TECHNOLOGIES-SALARY. Avl Bal INR 91,200.00 -SBI",
      85000,
      null,
    ],
    [
      "an HDFC 'Money Received' alert",
      "Money Received - INR 2,500.00 in your HDFC Bank A/c xx1234 on 31-10-26 from VPA ravi@okaxis (UPI 412345678901)",
      2500,
      "ravi@okaxis",
    ],
    [
      "a Kotak 'Received' alert",
      "Received Rs.700.00 in your Kotak Bank AC X1234 from priya@ybl on 31-10-26.UPI Ref:412345678901.",
      700,
      "priya@ybl",
    ],
    [
      "a deposit 'to' an HDFC account with no 'your'",
      "Rs.1,000.00 credited to HDFC Bank A/c XX1234 on 31-10-26 from VPA amit@okicici (UPI Ref No 412345678901)",
      1000,
      "amit@okicici",
    ],
    [
      "a refund to a credit card",
      "Refund of Rs.499.00 from AMAZON has been credited to your SBI Credit Card ending 0543 on 31/10/26.",
      499,
      null,
    ],
    [
      "PhonePe 'received from'",
      "Received ₹1,200 from Rahul Verma in your State Bank of India account.",
      1200,
      "Rahul Verma",
    ],
  ];
  for (const [label, text, amount, from] of credits) {
    it(`reads ${label} as income`, () => {
      const txn = parseBankMessage(text);
      expect(txn?.direction).toBe("credit");
      expect(txn?.amount).toBe(amount);
      if (from) expect(txn?.counterparty).toBe(from);
      expect(txn?.counterparty ?? "").not.toMatch(/^your/i);
    });
  }

  const debits: [string, string, number][] = [
    [
      "a credit-card spend",
      "Rs.244.00 spent on your SBI Credit Card ending 0543 at DOMINOS on 28/10/26.",
      244,
    ],
    [
      "a debit-card spend",
      "Rs.350.00 spent using your Debit Card XX1234 at ZOMATO on 31-10-26.",
      350,
    ],
    [
      "Google Pay 'has been sent to'",
      "₹30 has been sent to MOTHER DAIRY KALKA JI",
      30,
    ],
    [
      "a transfer out that names the other account as credited",
      "Your A/c XX1234 is debited for Rs.5,000.00 on 31-10-26 and credited to A/c XX9876 of RAHUL (IMPS Ref 412345678901).",
      5000,
    ],
    [
      "Kotak 'Sent'",
      "Sent Rs.500.00 from Kotak Bank AC X1234 to shop@ybl on 31-10-26.UPI Ref 412345678901.",
      500,
    ],
  ];
  for (const [label, text, amount] of debits) {
    it(`reads ${label} as spending`, () => {
      const txn = parseBankMessage(text);
      expect(txn?.direction).toBe("debit");
      expect(txn?.amount).toBe(amount);
    });
  }

  it("is sure about a credit card spend now that 'Credit Card' isn't a credit", () => {
    const txn = parseBankMessage(
      "Rs.244.00 spent on your SBI Credit Card ending 0543 at DOMINOS on 28/10/26.",
    );
    expect(txn?.confidence).toBe("high");
    expect(txn?.counterparty).toBe("DOMINOS");
  });

  it("ignores a cashback ad that mentions bills paid", () => {
    expect(
      parseBankMessage(
        "🎉 Bills paid. Cashback unlocked!. It's Hype Hour on BHIM! Pay any bill of ₹100+ and get flat ₹5 cashback. Zero convenience fee. Zero platform fee. What are you waiting for? 😉",
      ),
    ).toBeNull();
  });
});

describe("parseBankMessage — sender named with “by”, and reference numbers", () => {
  const credit = (text: string) => {
    const t = parseBankMessage(text);
    expect(t?.direction).toBe("credit");
    return t!;
  };

  it("takes the sender after “credited … by NAME”", () => {
    const t = credit(
      "Dear Customer, your A/c XX0000 has been credited with Rs.1.00 on 01-11-26 by AAJ FLIP TEST via UPI (Ref No 999000111333). -AAJTEST",
    );
    expect(t.counterparty?.toLowerCase()).toBe("aaj flip test");
    expect(t.reference).toBe("999000111333");
  });

  it("stops the name at a comma or “on”", () => {
    expect(
      credit("Rs 2,500.00 credited to your a/c XX1234 by Rahul Kumar, UPI Ref 412345678901")
        .counterparty?.toLowerCase(),
    ).toBe("rahul kumar");
    expect(
      credit("A/c XX1234 credited by Priya Singh on 01-11-26 with INR 750.00. Bal INR 9,000.00")
        .counterparty?.toLowerCase(),
    ).toBe("priya singh");
  });

  it("never reads an amount, a rail or “transfer” as the name", () => {
    expect(
      credit("Dear SBI User, your A/c X1234-credited by Rs.31000 on 30Oct26 transfer from MRIDUL SHARMA Ref No 530412345678 -SBI")
        .counterparty?.toLowerCase(),
    ).toBe("mridul sharma");
    expect(
      credit("Your A/C XXXXX1234 Credited INR 500.00 on 01/11/26 -Deposit by transfer from ANITA DEVI.")
        .counterparty?.toLowerCase(),
    ).toBe("anita devi");
    const neft = credit("INR 45,000.00 credited to A/c XX1234 on 01-11-26 by NEFT. Bal INR 60,000.00");
    expect(neft.counterparty).toBeNull();
    const cash = credit("Rs.2000 credited to your A/c XX1234 by cash on 01-11-26");
    expect(cash.counterparty).toBeNull();
  });

  it("reads “Ref No”, “UTR No.” and “RRN” references", () => {
    expect(
      parseBankMessage("Rs.1.00 debited from your A/c XX0000 on 01-11-26 to VPA x@upi (UPI Ref No 999000111222).")
        ?.reference,
    ).toBe("999000111222");
    expect(
      credit("INR 45,000.00 credited to A/c XX1234 by NEFT, UTR No. HDFCN52026110112345 from ACME PVT LTD")
        .reference,
    ).toBe("HDFCN52026110112345");
    expect(
      parseBankMessage("Rs 300 spent on card XX9876 at ZOMATO. RRN 512345678901")?.reference,
    ).toBe("512345678901");
  });

  it("never takes a plain word after “UPI” as a reference", () => {
    expect(
      parseBankMessage("Rs.250 debited from A/c XX1234 for UPI payment to SWIGGY")?.reference,
    ).toBeNull();
  });
});

describe("splitGroupedNotification", () => {
  it("splits Google Pay's bundled updates into one message each", () => {
    expect(
      splitGroupedNotification(
        "2 new completed transaction updates. ⋅ Mridul  Sharma has sent ₹1 to your bank account State Bank of India-1090\n⋅ ₹30 has been sent to MOTHER DAIRY KALKA JI",
      ),
    ).toEqual([
      "Mridul  Sharma has sent ₹1 to your bank account State Bank of India-1090",
      "₹30 has been sent to MOTHER DAIRY KALKA JI",
    ]);
  });

  it("leaves an ordinary message whole", () => {
    const text = "Rs.20.00 debited from a/c XX1234. Avl Bal Rs.4980.00";
    expect(splitGroupedNotification(text)).toEqual([text]);
  });
});

describe("parseBankMessage — merchant names from wallet alerts", () => {
  it("takes the PhonePe payee, not the time of day", () => {
    const txn = parseBankMessage(
      "JD-PHONPE-S. You've paid Rs.55 via PhonePe gift card to Diada coffee  on Oct 30, 2026 at 7:02:53 PM. Not you? Call us on 022-68727374. Remaining balance Rs.310.",
    );
    expect(txn?.counterparty).toBe("Diada coffee");
  });

  it("stops the Amazon Pay merchant before 'Updated Balance'", () => {
    const txn = parseBankMessage(
      "Rs 500.00 was paid on Amazon.in. Payment of Rs 500.00 using Amazon Pay Balance is successful at Amazon.in. Updated Balance: Rs 730.19.",
    );
    expect(txn?.counterparty).toBe("Amazon.in");
  });
});
