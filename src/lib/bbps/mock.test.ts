import { describe, expect, it } from "vitest";
import { MOCK_BILLERS, MockBbpsProvider } from "./mock";
import { validateParams } from "./index";

const mock = new MockBbpsProvider({ demoBills: true });

describe("mock BBPS provider", () => {
  it("searches billers by name and category", async () => {
    const r = await mock.searchBillers("bses");
    expect(r.map((b) => b.name)).toContain("BSES Rajdhani Power");
    const cards = await mock.searchBillers("", "Credit Card");
    expect(cards.length).toBeGreaterThan(3);
    expect(cards.every((b) => b.category === "Credit Card")).toBe(true);
  });

  it("covers state DISCOMs beyond the metros", async () => {
    // Haryana, Punjab and Tamil Nadu are as reachable as Delhi is.
    for (const [query, expected] of [
      ["dhbvn", "DHBVN (Dakshin Haryana)"],
      ["uhbvn", "UHBVN (Uttar Haryana)"],
      ["pspcl", "PSPCL (Punjab)"],
      ["tangedco", "TANGEDCO (Tamil Nadu)"],
    ] as const) {
      const found = await mock.searchBillers(query);
      expect(found.map((b) => b.name)).toContain(expected);
    }
    // The list itself is national; searchBillers caps a page at 25.
    const power = MOCK_BILLERS.filter((b) => b.category === "Electricity");
    expect(power.length).toBeGreaterThan(30);
    expect(new Set(power.map((b) => b.id)).size).toBe(power.length);
  });

  it("fetches a deterministic bill for the same identifiers", async () => {
    const a = await mock.fetchBill("BSES00000DEL01", {
      "CA Number": "123456789",
    });
    const b = await mock.fetchBill("BSES00000DEL01", {
      "CA Number": "123456789",
    });
    expect(a.ok && b.ok && a.bill.amount === b.bill.amount).toBe(true);
    if (a.ok) {
      expect(a.bill.amount).toBeGreaterThan(0);
      expect(a.bill.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Never invent a person: the account holder must come from the biller.
      expect(a.bill.customerName).toBeNull();
    }
  });

  it("reports no bill available unless demo bills are on", async () => {
    const live = new MockBbpsProvider({ demoBills: false });
    const r = await live.fetchBill("IGLC00000DEL01", {
      "BP Number": "1234567890",
    });
    expect(!r.ok && r.code === "unavailable").toBe(true);
  });

  it("simulates no-dues and not-found accounts", async () => {
    expect(
      (await mock.fetchBill("BSES00000DEL01", { "CA Number": "123456700" })).ok,
    ).toBe(false);
    const nf = await mock.fetchBill("BSES00000DEL01", {
      "CA Number": "123456799",
    });
    expect(!nf.ok && nf.code === "not_found").toBe(true);
  });

  it("validates identifiers against the biller schema", async () => {
    const biller = (await mock.getBiller("HDFC00000NATCC"))!;
    expect(validateParams(biller, { "Card Number": "1234" })).toMatch(
      /too short|doesn't look right/,
    );
    expect(
      validateParams(biller, {
        "Card Number": "4111111111111111",
        "Registered Mobile": "9876543210",
      }),
    ).toBeNull();
  });
});
