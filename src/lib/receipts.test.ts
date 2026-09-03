import { describe, it, expect } from "vitest";
import {
  itemsTotal,
  normaliseItem,
  reconciles,
  type ReceiptItem,
} from "./receipts";

const item = (name: string, amount: number, line = 1): ReceiptItem => ({
  line_no: line,
  name,
  quantity: null,
  unit_price: null,
  amount,
});

describe("normaliseItem", () => {
  it("reads a plain printed line", () => {
    const line = normaliseItem(
      { name: "Paneer Tikka", quantity: 1, unit_price: 380, amount: 380 },
      1,
    );
    expect(line).toEqual({
      line_no: 1,
      name: "Paneer Tikka",
      quantity: 1,
      unit_price: 380,
      amount: 380,
    });
  });

  it("works out the line total from quantity × unit price", () => {
    const line = normaliseItem(
      { name: "Roti", quantity: 4, unit_price: 45, amount: null },
      2,
    );
    expect(line?.amount).toBe(180);
  });

  it("keeps fractional quantities for weighed goods", () => {
    const line = normaliseItem(
      { name: "Tomatoes", quantity: 0.75, unit_price: 40, amount: 30 },
      1,
    );
    expect(line?.quantity).toBe(0.75);
    expect(line?.amount).toBe(30);
  });

  it("collapses messy whitespace in the name", () => {
    expect(
      normaliseItem({ name: "  Butter   Naan ", amount: 90 }, 1)?.name,
    ).toBe("Butter Naan");
  });

  it("drops a line with no name", () => {
    expect(normaliseItem({ name: "", amount: 100 }, 1)).toBeNull();
    expect(normaliseItem({ amount: 100 }, 1)).toBeNull();
  });

  it("drops a line with no usable money value", () => {
    expect(normaliseItem({ name: "Mystery", amount: null }, 1)).toBeNull();
    expect(normaliseItem({ name: "Mystery", quantity: 2 }, 1)).toBeNull();
  });

  it("keeps a zero-priced line — complimentary items are real lines", () => {
    expect(normaliseItem({ name: "Water", amount: 0 }, 1)?.amount).toBe(0);
  });

  it("drops a negative line rather than inventing a refund", () => {
    expect(normaliseItem({ name: "Adjustment", amount: -50 }, 1)).toBeNull();
  });
});

describe("itemsTotal", () => {
  it("adds the lines up", () => {
    expect(itemsTotal([item("A", 380), item("B", 180, 2)])).toBe(560);
  });

  it("does not accumulate float noise", () => {
    expect(itemsTotal([item("A", 0.1), item("B", 0.2, 2)])).toBe(0.3);
  });

  it("is zero for an empty bill", () => {
    expect(itemsTotal([])).toBe(0);
  });
});

describe("reconciles", () => {
  const header = {
    subtotal: null,
    tax: null,
    discount: null,
    tip: null,
    total: null as number | null,
  };

  it("accepts lines that already include everything", () => {
    const items = [item("Paneer Tikka", 380), item("Roti", 180, 2)];
    expect(reconciles(items, { ...header, total: 560 })).toBe(true);
  });

  it("accepts pre-tax lines once tax is added", () => {
    const items = [item("Biryani", 320), item("Dessert", 180, 2)];
    expect(reconciles(items, { ...header, tax: 25, total: 525 })).toBe(true);
  });

  it("handles tax, tip and a discount together", () => {
    const items = [item("Pizza", 600), item("Coke", 120, 2)];
    expect(
      reconciles(items, {
        ...header,
        tax: 36,
        tip: 50,
        discount: 100,
        total: 706,
      }),
    ).toBe(true);
  });

  it("tolerates a rupee of rounding", () => {
    expect(reconciles([item("Thali", 249.5)], { ...header, total: 250 })).toBe(
      true,
    );
  });

  it("falls back to the printed subtotal when a line was missed", () => {
    const items = [item("Starter", 300)]; // the model only caught one of two
    expect(
      reconciles(items, { ...header, subtotal: 700, tax: 35, total: 735 }),
    ).toBe(true);
  });

  it("says no when the lines simply don't explain the total", () => {
    const items = [item("Starter", 300)];
    expect(reconciles(items, { ...header, total: 1200 })).toBe(false);
  });

  it("says no with no lines at all", () => {
    expect(reconciles([], { ...header, total: 500 })).toBe(false);
  });

  it("says no when the bill has no total to check against", () => {
    expect(reconciles([item("Starter", 300)], header)).toBe(false);
  });
});
