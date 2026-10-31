import { describe, it, expect } from "vitest";
import { parseBankMessage } from "./bank-message";

/**
 * Direction corpus: one line per real-world template, across the banks, UPI
 * apps and wallets Indian users actually get alerts from. Money in must
 * never be logged as spending, and the other way round — a wrong direction
 * corrupts every total at once, so this file is the contract.
 */

type Row = [label: string, text: string, amount: number];

const CREDITS: Row[] = [
  // Salary, every rail
  [
    "SBI NEFT salary",
    "Dear Customer, your A/C XXXXX401090 has been credited with INR 85,000.00 on 01/11/26 by NEFT-ACME TECHNOLOGIES-SALARY. Avl Bal INR 91,200.00 -SBI",
    85000,
  ],
  [
    "HDFC salary",
    "Update! INR 85,000.00 deposited in HDFC Bank A/c XX1234 on 01-NOV-26 for NEFT Cr-CITI0000001-ACME TECHNOLOGIES PVT LTD-SALARY NOV 2026.Avl bal INR 91,200.00. Cheque deposits in A/C are subject to clearing",
    85000,
  ],
  [
    "ICICI salary",
    "Dear Customer, Acct XX123 is credited with Rs 85,000.00 on 01-Nov-26 from ACME TECHNOLOGIES. UPI:412345678901-ICICI Bank.",
    85000,
  ],
  [
    "Axis salary",
    "INR 85000.00 credited to A/c no. XX1234 on 01-11-26 at 10:15:02 IST. Info- NEFT/CITIN26001/ACME TECH/SALARY. Avl Bal- INR 91200.00 - Axis Bank",
    85000,
  ],
  [
    "Kotak salary",
    "Rs.85000.00 is credited to your Kotak Bank a/c XX1234 on 01/11/2026 by NEFT from ACME TECHNOLOGIES PVT LTD. Avl bal Rs.91200.00",
    85000,
  ],
  [
    "IMPS salary",
    "Your a/c XX1234 is credited by Rs.85,000.00 on 01-11-26 through IMPS from ACME TECH (Ref 412345678901).",
    85000,
  ],
  [
    "RTGS salary",
    "A/c XX1234 Credited for Rs:85,000.00 on 01-11-2026 by RTGS-ACME TECHNOLOGIES. Avl Bal Rs:91,200.00 -Union Bank of India",
    85000,
  ],
  [
    "PNB salary",
    "Your A/c XXXXXXXX1234 is credited for Rs.85000.00 on 01-11-26 through NEFT. Avl Bal Rs.91200.00 -PNB",
    85000,
  ],
  [
    "BoB salary",
    "Rs.85000.00 Credited to A/c ...1234 thru NEFT from ACME TECH on 01-11-26. Total Bal:Rs.91200.00CR. -Bank of Baroda",
    85000,
  ],
  [
    "Canara salary",
    "An amount of INR 85,000.00 has been CREDITED to your account XXX1234 on 01/11/2026 towards SALARY. Total Avail.bal INR 91,200.00 - Canara Bank",
    85000,
  ],
  [
    "'transferred to your A/c' salary",
    "INR 85,000.00 transferred from ACME TECHNOLOGIES PVT LTD to your A/c XX1090 on 01-11-26 towards SALARY NOV. Avl Bal INR 91,200.00",
    85000,
  ],
  [
    "IDFC salary",
    "Your IDFC FIRST Bank A/C XX1234 has been credited with INR 85,000.00 on 01-Nov-2026. New balance: INR 91,200.00",
    85000,
  ],
  // UPI received
  [
    "Google Pay received",
    "Money received. Mridul  Sharma has sent ₹31,000 to your bank account State Bank of India-1090",
    31000,
  ],
  ["Google Pay 'sent you'", "Ravi Kumar sent you ₹500", 500],
  [
    "PhonePe received",
    "Received ₹1,200 from Rahul Verma in your State Bank of India account.",
    1200,
  ],
  [
    "Paytm received",
    "Rs.250 received from Amit Singh in your Paytm Payments Bank a/c. UPI Ref: 412345678901",
    250,
  ],
  [
    "BHIM received",
    "You have received Rs. 300.00 from priya@okhdfcbank in your account XX1234.",
    300,
  ],
  [
    "SBI UPI credit",
    "Dear SBI UPI User, ur A/cX1090 credited by Rs500 on 31Oct26 by (Ref no 412345678901)",
    500,
  ],
  [
    "HDFC Money Received",
    "Money Received - INR 2,500.00 in your HDFC Bank A/c xx1234 on 31-10-26 from VPA ravi@okaxis (UPI 412345678901)",
    2500,
  ],
  [
    "Kotak Received",
    "Received Rs.700.00 in your Kotak Bank AC X1234 from priya@ybl on 31-10-26.UPI Ref:412345678901.",
    700,
  ],
  [
    "HDFC 'credited to … A/c'",
    "Rs.1,000.00 credited to HDFC Bank A/c XX1234 on 31-10-26 from VPA amit@okicici (UPI Ref No 412345678901)",
    1000,
  ],
  [
    "Axis UPI credit",
    "INR 400.00 credited to A/c no. XX1234 on 31-10-26 at 18:22:10 IST. Info- UPI/P2A/412345678901/RAVI KUMAR. Avl Bal- INR 5400.00 - Axis Bank",
    400,
  ],
  [
    "ICICI UPI credit",
    "ICICI Bank Acct XX123 credited:Rs. 650.00 on 31-Oct-26 by NAVEEN. UPI:412345678901.",
    650,
  ],
  // Refunds, interest, cashback, reversals
  [
    "refund to credit card",
    "Refund of Rs.499.00 from AMAZON has been credited to your SBI Credit Card ending 0543 on 31/10/26.",
    499,
  ],
  [
    "refund to account",
    "Your refund of Rs 1,299.00 for order 403-1234567 has been credited to your account XX1234.",
    1299,
  ],
  [
    "interest credit",
    "Interest of Rs.312.00 credited to your a/c XX1234 on 31-10-26. Avl Bal Rs.12,312.00",
    312,
  ],
  [
    "cashback credited",
    "Cashback of ₹25 has been credited to your Amazon Pay balance.",
    25,
  ],
  [
    "failed payment money back",
    "Rs.500.00 has been credited back to your a/c XX1234 for the failed UPI transaction 412345678901.",
    500,
  ],
  [
    "dividend",
    "Dividend of Rs.180.00 credited to your bank a/c XX1234 by INFOSYS LTD.",
    180,
  ],
  [
    "cash deposit",
    "Cash deposit of Rs.10,000.00 in your A/c XX1234 on 31-10-26. Avl Bal Rs.15,000.00",
    10000,
  ],
  [
    "wallet top-up received",
    "₹1,000 added to your Paytm Wallet from your friend Rohan.",
    1000,
  ],
];

const DEBITS: Row[] = [
  [
    "HDFC UPI debit",
    "Rs.20.00 debited from a/c XX1234 on 02-09-26 to VPA chaiwala@ybl. Avl Bal Rs.4980.00",
    20,
  ],
  [
    "HDFC 'Sent'",
    "Sent Rs.250.00 From HDFC Bank A/C x1234 To Zomato On 31/10/26 Ref 412345678901 Not You? Call 18002586161",
    250,
  ],
  [
    "SBI UPI debit",
    "Dear UPI user A/C X1234 debited by 250.0 on date 02Sep26 trf to BLUE TOKAI Refno 123456789012. If not u? call 1800111109. -SBI",
    250,
  ],
  [
    "ICICI UPI debit",
    "ICICI Bank Acct XX123 debited for Rs 250.00 on 24-Oct-26; SWIGGY credited. UPI:412345678901. Call 18002662 for dispute.",
    250,
  ],
  [
    "Axis UPI debit",
    "INR 120.00 debited A/c no. XX1234 31-10-26 18:22:10 UPI/P2M/412345678901/BLINKIT Not you? SMS BLOCKUPI Cust ID to 919951860002 Axis Bank",
    120,
  ],
  [
    "Kotak Sent",
    "Sent Rs.500.00 from Kotak Bank AC X1234 to shop@ybl on 31-10-26.UPI Ref 412345678901.",
    500,
  ],
  [
    "IMPS transfer out",
    "Your A/c XX1234 is debited for Rs.5,000.00 on 31-10-26 and credited to A/c XX9876 of RAHUL (IMPS Ref 412345678901).",
    5000,
  ],
  [
    "NEFT out",
    "INR 15,000.00 debited from A/c XX1234 on 31-10-26 towards NEFT to LANDLORD SHARMA. Avl Bal INR 20,000.00",
    15000,
  ],
  ["Google Pay paid", "₹30 has been sent to MOTHER DAIRY KALKA JI", 30],
  ["Google Pay 'You paid'", "You paid ₹150 to Raju Tea Stall", 150],
  [
    "PhonePe paid",
    "JD-PHONPE-S. You've paid Rs.55 via PhonePe gift card to Diada coffee  on Oct 30, 2026 at 7:02:53 PM. Not you? Call us on 022-68727374. Remaining balance Rs.310.",
    55,
  ],
  [
    "Paytm paid",
    "Paid Rs.99 to Netflix from Paytm Payments Bank a/c XX1234. UPI Ref: 412345678901",
    99,
  ],
  [
    "Amazon Pay",
    "Rs 500.00 was paid on Amazon.in. Payment of Rs 500.00 using Amazon Pay Balance is successful at Amazon.in. Updated Balance: Rs 730.19.",
    500,
  ],
  [
    "credit card spend",
    "Rs.244.00 spent on your SBI Credit Card ending 0543 at DOMINOS on 28/10/26.",
    244,
  ],
  [
    "HDFC credit card",
    "Spent Rs.1,299.00 On HDFC Bank Credit Card XX5678 At AMAZON On 2026-10-31:12:10:00. Not You? Call 18002586161",
    1299,
  ],
  [
    "ICICI credit card",
    "INR 899.00 spent using ICICI Bank Card XX1234 on 24-Oct-26 on NETFLIX. Avl Limit: INR 1,20,000.00.",
    899,
  ],
  [
    "debit card spend",
    "Rs.350.00 spent using your Debit Card XX1234 at ZOMATO on 31-10-26.",
    350,
  ],
  [
    "POS purchase",
    "Purchase of Rs.2,450.00 at RELIANCE SMART on your debit card XX1234 on 31-10-26.",
    2450,
  ],
  [
    "ATM",
    "Rs.5000 withdrawn from a/c XX1234 at ATM CONNAUGHT PLACE on 02-09-26. Avl Bal Rs.4000.00",
    5000,
  ],
  [
    "AutoPay",
    "AutoPay successful!. ₹13428 has been auto-debited towards JIO PLATFORMS LIMITED.",
    13428,
  ],
  [
    "NACH EMI",
    "Your A/c XX1234 has been debited with Rs.12,500.00 towards NACH-HDFC LTD EMI on 05-11-26. Avl Bal Rs.8,000.00",
    12500,
  ],
  [
    "SIP",
    "Rs.5,000.00 debited from your A/c XX1234 for SIP in AXIS BLUECHIP FUND on 05-11-26.",
    5000,
  ],
  [
    "mandate executed",
    "Mandate executed: Rs.199.00 debited from A/c XX1234 for SPOTIFY on 31-10-26.",
    199,
  ],
  [
    "bill payment",
    "Payment of Rs 600.00 to BSES RAJDHANI is successful. Ref 412345678901.",
    600,
  ],
  ["wallet payment", "Rs.45 paid from your MobiKwik wallet to UBER.", 45],
  [
    "CRED card bill",
    "₹12,000 paid to your HDFC Bank credit card via CRED. Ref 412345678901",
    12000,
  ],
];

describe("direction corpus — money in", () => {
  for (const [label, text, amount] of CREDITS)
    it(`${label} → income ₹${amount}`, () => {
      const txn = parseBankMessage(text);
      expect(txn, "should be a transaction").not.toBeNull();
      expect(txn?.direction).toBe("credit");
      expect(txn?.amount).toBe(amount);
    });
});

describe("direction corpus — money out", () => {
  for (const [label, text, amount] of DEBITS)
    it(`${label} → spending ₹${amount}`, () => {
      const txn = parseBankMessage(text);
      expect(txn, "should be a transaction").not.toBeNull();
      expect(txn?.direction).toBe("debit");
      expect(txn?.amount).toBe(amount);
    });
});

/** Look like money, move none. Each one logged would invent a transaction. */
const NOTHING: [string, string][] = [
  [
    "failed, refund promised later",
    "Your UPI payment of Rs.500.00 to swiggy@icici failed. Amount debited, if any, will be refunded to your a/c within 3 working days.",
  ],
  [
    "declined card",
    "Txn of Rs.2,000.00 on your HDFC Bank Credit Card XX5678 at AMAZON was declined due to insufficient limit.",
  ],
  [
    "collect request",
    "Rahul has requested Rs.500 from you on Google Pay. Pay now.",
  ],
  [
    "cashback ad",
    "🎉 Bills paid. Cashback unlocked!. It's Hype Hour on BHIM! Pay any bill of ₹100+ and get flat ₹5 cashback. Zero convenience fee. Zero platform fee. What are you waiting for? 😉",
  ],
  [
    "due reminder",
    "Your SBI Card bill of Rs.12,345 is due on 15-11-26. Pay now to avoid late fee.",
  ],
  [
    "OTP",
    "482913 is your OTP for a transaction of Rs.2,000 at FLIPKART. Do not share.",
  ],
  [
    "IPO ask",
    "JD-PHONPE-S. You've received an IPO request from BLS POLYMERS LIMITED for Rs.15000. Click to accept.",
  ],
  [
    "future autopay",
    "Rs.199 will be debited from your a/c XX1234 on 05-11-26 for SPOTIFY AutoPay.",
  ],
  [
    "referral offer",
    "Get Rs.200 credited to your account when you send money to 3 friends!",
  ],
  [
    "cashback offer",
    "Earn up to ₹150 cashback on your next payment. Pay now on PhonePe!",
  ],
];

describe("direction corpus — real alerts that carry an offer footer", () => {
  it("still logs a debit that ends with a cashback pitch", () => {
    const txn = parseBankMessage(
      "Rs.250.00 debited from a/c XX1234 on 31-10-26 to VPA zomato@icici. UPI Ref 412345678901. Get ₹50 cashback on your next payment with HDFC UPI!",
    );
    expect(txn?.direction).toBe("debit");
    expect(txn?.amount).toBe(250);
  });
});

describe("direction corpus — nothing moved", () => {
  for (const [label, text] of NOTHING)
    it(`ignores ${label}`, () => expect(parseBankMessage(text)).toBeNull());
});
