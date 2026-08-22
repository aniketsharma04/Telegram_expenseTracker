import { describe, expect, it } from "vitest";
import { MockBbpsProvider } from "./mock";
import { validateParams } from "./index";

const mock = new MockBbpsProvider();

describe("mock BBPS provider", () => {
  it("searches billers by name and category", async () => {
    const r = await mock.searchBillers("bses");
    expect(r.map((b) => b.name)).toContain("BSES Rajdhani Power Limited");
    const cards = await mock.searchBillers("", "Credit Card");
    expect(cards.length).toBeGreaterThan(3);
    expect(cards.every((b) => b.category === "Credit Card")).toBe(true);
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
      expect(a.bill.customerName).toBeTruthy();
    }
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
