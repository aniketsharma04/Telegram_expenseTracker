import { describe, expect, it } from "vitest";
import { redactForAI } from "./redact";

describe("redactForAI", () => {
  it("masks a typical electricity bill email but keeps what extraction needs", () => {
    const bill = [
      "Dear Rahul Sharma,",
      "Your electricity bill for Consumer No. 102938475610 is ready.",
      "Amount due: Rs. 2,345.00  Due date: 15-11-2026  Bill date: 31/10/2026",
      "Registered mobile 9876543210, email rahul.sharma@gmail.com",
      "Pay now: https://pay.tatapower.com/bill?cid=102938475610&token=abc123",
    ].join("\n");
    const out = redactForAI(bill);
    expect(out).toContain("Dear customer,");
    expect(out).not.toMatch(/Rahul|Sharma/);
    expect(out).toContain("Consumer No. XXXX5610");
    expect(out).toContain("Rs. 2,345.00");
    expect(out).toContain("15-11-2026");
    expect(out).toContain("31/10/2026");
    expect(out).toContain("[phone]");
    expect(out).toContain("[email]@gmail.com");
    expect(out).toContain("https://pay.tatapower.com");
    expect(out).not.toContain("token=");
  });

  it("keeps the last four of cards and accounts", () => {
    expect(redactForAI("Card 4111 1111 1111 1234 statement")).toBe(
      "Card XXXX1234 statement",
    );
    expect(redactForAI("Card 4111-1111-1111-1234")).toBe("Card XXXX1234");
    expect(redactForAI("A/c 50100234567890 debited")).toBe(
      "A/c XXXX7890 debited",
    );
    // Already masked by the bank: left as is.
    expect(redactForAI("A/c XX1234 debited")).toBe("A/c XX1234 debited");
  });

  it("removes government ids and bank codes", () => {
    const out = redactForAI(
      "PAN ABCDE1234F, Aadhaar 1234 5678 9012, IFSC HDFC0001234",
    );
    expect(out).toBe("PAN [pan], Aadhaar [aadhaar], IFSC [ifsc]");
  });

  it("masks phone formats and UPI ids", () => {
    expect(redactForAI("call +91 98765 43210")).toBe("call [phone]");
    expect(redactForAI("call 098765-43210")).toBe("call [phone]");
    expect(redactForAI("paid to rahul.s@okaxis")).toBe("paid to [upi-id]");
    expect(redactForAI("paid to 9876543210@ybl")).toBe("paid to [upi-id]");
  });

  it("never masks amounts or dates", () => {
    expect(redactForAI("Rs.12345678 credited")).toBe("Rs.12345678 credited");
    expect(redactForAI("₹ 9876543210 limit")).toBe("₹ 9876543210 limit");
    expect(redactForAI("INR 1,23,456.75 due on 2026-11-15")).toBe(
      "INR 1,23,456.75 due on 2026-11-15",
    );
    expect(redactForAI("450 swiggy dinner yesterday")).toBe(
      "450 swiggy dinner yesterday",
    );
  });

  it("leaves a plain typed expense untouched", () => {
    const typed = "paid 1200 for groceries at DMart";
    expect(redactForAI(typed)).toBe(typed);
  });
});

describe("redactForAI punctuation", () => {
  it("masks numbers that end a sentence or a list item", () => {
    expect(redactForAI("Policy 123456789012.")).toBe("Policy XXXX9012.");
    expect(redactForAI("A/c 50100234567890, debited")).toBe(
      "A/c XXXX7890, debited",
    );
  });

  it("masks a UPI id at the end of a sentence", () => {
    expect(redactForAI("Sent to rahul.s@okaxis. Thanks")).toBe(
      "Sent to [upi-id]. Thanks",
    );
    expect(redactForAI("mail me at a.b@gmail.com.")).toBe(
      "mail me at [email]@gmail.com.",
    );
  });

  it("doesn't mask part of a decimal amount", () => {
    expect(redactForAI("total 12345678.50")).toBe("total 12345678.50");
  });
});
