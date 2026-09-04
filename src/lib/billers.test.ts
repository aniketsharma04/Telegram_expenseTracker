import { describe, it, expect } from "vitest";
import {
  aliasesFor,
  DISCOMS,
  GAS_BILLERS,
  matchBiller,
  WATER_BILLERS,
} from "./billers";
import { looksLikeBill } from "./bill-detect";

describe("national coverage", () => {
  it("reaches every major state, not just the metros", () => {
    const states = new Set(DISCOMS.map((b) => b.state));
    for (const state of [
      "Haryana",
      "Punjab",
      "Rajasthan",
      "Gujarat",
      "Madhya Pradesh",
      "Bihar",
      "West Bengal",
      "Odisha",
      "Assam",
      "Tamil Nadu",
      "Kerala",
      "Telangana",
      "Andhra Pradesh",
      "Karnataka",
      "Uttar Pradesh",
      "Maharashtra",
      "Delhi",
    ]) {
      expect(states).toContain(state);
    }
  });

  it("gives every biller a unique id", () => {
    const all = [...DISCOMS, ...GAS_BILLERS, ...WATER_BILLERS];
    expect(new Set(all.map((b) => b.id)).size).toBe(all.length);
  });

  it("gives every biller at least one alias and a sane identifier range", () => {
    for (const b of [...DISCOMS, ...GAS_BILLERS, ...WATER_BILLERS]) {
      expect(b.aliases.length).toBeGreaterThan(0);
      expect(b.digits[0]).toBeLessThanOrEqual(b.digits[1]);
      expect(b.digits[0]).toBeGreaterThan(0);
    }
  });
});

describe("matchBiller", () => {
  it("recognises Haryana's DISCOMs", () => {
    expect(matchBiller("DHBVN bill for August")?.name).toBe(
      "DHBVN (Dakshin Haryana)",
    );
    expect(matchBiller("Dakshin Haryana Bijli Vitran Nigam")?.name).toBe(
      "DHBVN (Dakshin Haryana)",
    );
    expect(matchBiller("UHBVN electricity bill")?.name).toBe(
      "UHBVN (Uttar Haryana)",
    );
  });

  it("prefers the longest matching alias", () => {
    // "adani total gas" must not be swallowed by "adani electricity".
    expect(matchBiller("Adani Total Gas bill")?.name).toBe("Adani Total Gas");
    expect(matchBiller("Adani Electricity Mumbai")?.name).toBe(
      "Adani Electricity (Mumbai)",
    );
  });

  it("says nothing about an unrelated message", () => {
    expect(matchBiller("your swiggy order is on the way")).toBeNull();
  });
});

describe("bill detection knows these names", () => {
  it("spots a DHBVN bill email that never says 'electricity'", () => {
    expect(
      looksLikeBill({
        subject: "DHBVN Bill Notification",
        from: "no-reply@dhbvn.org.in",
        body: "Your bill for account 1234567890 is Rs. 2,340 due on 18-09-2026.",
      }),
    ).toBe(true);
  });

  it("spots bills from other states' DISCOMs", () => {
    for (const [subject, body] of [
      ["PSPCL Bill", "Your PSPCL bill of Rs 1,890 is due 12-09-2026."],
      ["TANGEDCO", "TANGEDCO bill Rs 940 due on 20-09-2026."],
      ["JVVNL bill", "JVVNL amount payable Rs 1,120 due 15-09-2026."],
    ] as const) {
      expect(
        looksLikeBill({ subject, from: "billing@example.com", body }),
      ).toBe(true);
    }
  });

  it("still ignores ordinary mail", () => {
    expect(
      looksLikeBill({
        subject: "Lunch tomorrow?",
        from: "friend@gmail.com",
        body: "Are you free at 1?",
      }),
    ).toBe(false);
  });
});

describe("aliasesFor", () => {
  it("flattens and de-duplicates", () => {
    const aliases = aliasesFor(DISCOMS);
    expect(aliases).toContain("dhbvn");
    expect(new Set(aliases).size).toBe(aliases.length);
  });
});
