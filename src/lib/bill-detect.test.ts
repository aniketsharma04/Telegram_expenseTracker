import { describe, expect, it } from "vitest";
import {
  guessKind,
  heuristicExtract,
  looksLikeBill,
  normalizeExtract,
  parseLooseDate,
  senderName,
} from "./bill-detect";
import { extractBody, htmlToText } from "./gmail";

const TODAY = "2026-08-23";

const electricity = {
  subject: "Your BSES electricity bill is ready — Total amount due ₹2,340.50",
  from: '"BSES Rajdhani" <no-reply@bsesdelhi.com>',
  body: [
    "Dear Customer,",
    "Your bill for CA No 150XXXX321 has been generated.",
    "Bill amount: Rs. 2,340.50",
    "Due date: 05/09/2026",
    "Kindly pay before the due date to avoid late payment charges.",
  ].join("\n"),
};

const cardStatement = {
  subject: "HDFC Bank Credit Card Statement",
  from: "HDFC Bank <cardstatement@hdfcbank.net>",
  body: [
    "Statement for card ending 4321",
    "Total Amount Due: INR 18,204.00",
    "Minimum Amount Due: INR 950.00",
    "Payment Due Date: 11 Sep 2026",
  ].join("\n"),
};

const receipt = {
  subject: "Payment received — thank you",
  from: "Airtel <noreply@airtel.in>",
  body: "We have received your payment of Rs. 799. Thank you for your payment.",
};

const promo = {
  subject: "Flat 50% off this weekend!",
  from: "Zomato <promo@zomato.com>",
  body: "Order now and save up to Rs. 300 on your next order.",
};

describe("looksLikeBill", () => {
  it("accepts a utility bill", () => {
    expect(looksLikeBill(electricity)).toBe(true);
  });

  it("accepts a card statement", () => {
    expect(looksLikeBill(cardStatement)).toBe(true);
  });

  it("rejects a payment confirmation", () => {
    expect(looksLikeBill(receipt)).toBe(false);
  });

  it("rejects marketing mail with no bill wording", () => {
    expect(looksLikeBill(promo)).toBe(false);
  });

  it("rejects a bill-shaped message with no rupee figure", () => {
    expect(
      looksLikeBill({
        ...electricity,
        subject: "Bill due",
        body: "Your bill is due soon.",
      }),
    ).toBe(false);
  });
});

describe("guessKind", () => {
  it.each([
    ["BSES electricity bill", "electricity"],
    ["Total amount due on your credit card", "credit_card"],
    ["Airtel postpaid bill", "mobile"],
    ["ACT Fibernet broadband invoice", "internet"],
    ["Indane LPG refill", "gas"],
    ["Delhi Jal Board water tax", "water"],
    ["LIC renewal premium notice", "insurance"],
    ["Something unrelated", "other"],
  ])("%s → %s", (text, kind) => {
    expect(guessKind(text)).toBe(kind);
  });
});

describe("senderName", () => {
  it("prefers the display name", () => {
    expect(senderName('"BSES Rajdhani" <no-reply@bsesdelhi.com>')).toBe(
      "BSES Rajdhani",
    );
  });

  it("falls back to the domain label", () => {
    expect(senderName("billing@tatapower.com")).toBe("Tatapower");
  });
});

describe("parseLooseDate", () => {
  it.each([
    ["2026-09-05", "2026-09-05"],
    ["05/09/2026", "2026-09-05"],
    ["5-9-26", "2026-09-05"],
    ["11 Sep 2026", "2026-09-11"],
    ["Sep 11, 2026", "2026-09-11"],
    ["11 September", "2026-09-11"],
  ])("%s → %s", (raw, iso) => {
    expect(parseLooseDate(raw, TODAY)).toBe(iso);
  });

  it("rejects nonsense", () => {
    expect(parseLooseDate("soon", TODAY)).toBeNull();
    expect(parseLooseDate("45/13/2026", TODAY)).toBeNull();
  });
});

describe("heuristicExtract", () => {
  it("pulls amount, due date and biller from a utility bill", () => {
    const draft = heuristicExtract(electricity, TODAY);
    expect(draft).toMatchObject({
      biller_name: "BSES Rajdhani",
      kind: "electricity",
      amount: 2340.5,
      due_date: "2026-09-05",
      confidence: "low",
    });
  });

  it("prefers the amount next to due wording over the largest figure", () => {
    const draft = heuristicExtract(cardStatement, TODAY);
    expect(draft?.amount).toBe(18204);
    expect(draft?.account_hint).toBe("••4321");
  });

  it("returns null when there is no amount at all", () => {
    expect(
      heuristicExtract(
        { subject: "Bill", from: "a@b.com", body: "no figures here" },
        TODAY,
      ),
    ).toBeNull();
  });
});

describe("normalizeExtract", () => {
  it("drops a message the model says isn't a bill", () => {
    expect(normalizeExtract({ is_bill: false }, electricity, TODAY)).toBeNull();
  });

  it("drops a bill with no amount", () => {
    expect(
      normalizeExtract({ is_bill: true, amount: null }, electricity, TODAY),
    ).toBeNull();
  });

  it("falls back to the sender and a guessed kind", () => {
    const draft = normalizeExtract(
      { is_bill: true, amount: 500, kind: "nonsense", confidence: "high" },
      electricity,
      TODAY,
    );
    expect(draft).toMatchObject({
      biller_name: "BSES Rajdhani",
      kind: "electricity",
      amount: 500,
      confidence: "high",
    });
  });

  it("normalises a loose date the model echoed back", () => {
    const draft = normalizeExtract(
      { is_bill: true, amount: 100, due_date: "05/09/2026" },
      electricity,
      TODAY,
    );
    expect(draft?.due_date).toBe("2026-09-05");
  });
});

describe("gmail body decoding", () => {
  const b64 = (s: string) => Buffer.from(s).toString("base64url");

  it("prefers the text/plain part", () => {
    const body = extractBody({
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: b64("plain wins") } },
        { mimeType: "text/html", body: { data: b64("<p>html loses</p>") } },
      ],
    });
    expect(body).toBe("plain wins");
  });

  it("falls back to stripped HTML", () => {
    const body = extractBody({
      mimeType: "text/html",
      body: { data: b64("<div>Amount due<br><b>Rs. 500</b></div>") },
    });
    expect(body).toContain("Amount due");
    expect(body).toContain("Rs. 500");
    expect(body).not.toContain("<");
  });

  it("skips attachments", () => {
    const body = extractBody({
      parts: [
        {
          mimeType: "text/plain",
          filename: "bill.pdf",
          body: { data: b64("attachment") },
        },
        { mimeType: "text/plain", body: { data: b64("real body") } },
      ],
    });
    expect(body).toBe("real body");
  });

  it("decodes rupee entities and drops scripts", () => {
    expect(htmlToText("<script>x()</script><p>Due &#8377;1,200</p>")).toBe(
      "Due ₹1,200",
    );
  });
});
