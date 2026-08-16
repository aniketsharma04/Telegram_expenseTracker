import { describe, expect, it } from "vitest";
import { extractAmount, localDate, parseExpense, CategoryRule } from "./parser";

const CATEGORIES: CategoryRule[] = [
  { name: "Food delivery", keywords: ["zomato", "swiggy", "kfc"] },
  { name: "Groceries", keywords: ["zepto", "blinkit", "grocery", "groceries"] },
  {
    name: "Transport",
    keywords: ["metro", "metro card", "uber", "ola", "petrol"],
  },
  { name: "Utilities & bills", keywords: ["recharge", "rent", "bill"] },
];

// Fixed reference time: 2026-08-16 12:00 IST (06:30 UTC)
const NOW = new Date("2026-08-16T06:30:00Z");

describe("extractAmount", () => {
  it("plain number", () => {
    expect(extractAmount("300 zomato")).toEqual({
      amount: 300,
      rest: "zomato",
    });
  });

  it("rupee symbol and rs prefix", () => {
    expect(extractAmount("₹450 swiggy").amount).toBe(450);
    expect(extractAmount("rs 450 swiggy").amount).toBe(450);
    expect(extractAmount("Rs.450 swiggy").amount).toBe(450);
  });

  it("comma-grouped and decimal amounts", () => {
    expect(extractAmount("1,250 rent").amount).toBe(1250);
    expect(extractAmount("99.50 chai").amount).toBe(99.5);
  });

  it("k suffix multiplies by 1000", () => {
    expect(extractAmount("1.5k trip").amount).toBe(1500);
  });

  it("does not treat 'kfc' as a k suffix", () => {
    expect(extractAmount("300 kfc").amount).toBe(300);
  });

  it("no number → null", () => {
    expect(extractAmount("lunch with friends").amount).toBeNull();
  });
});

describe("parseExpense", () => {
  it("clean message: amount + known merchant", () => {
    const r = parseExpense("300 zomato", CATEGORIES, NOW);
    expect(r.ok).toBe(true);
    expect(r.amount).toBe(300);
    expect(r.category).toBe("Food delivery");
    expect(r.merchant).toBe("Zomato");
    expect(r.expenseDate).toBe("2026-08-16");
  });

  it("multi-word keyword wins over shorter match", () => {
    const r = parseExpense("400 metro card", CATEGORIES, NOW);
    expect(r.category).toBe("Transport");
    expect(r.merchant).toBe("Metro Card");
  });

  it("amount after the merchant", () => {
    const r = parseExpense("uber 250", CATEGORIES, NOW);
    expect(r.amount).toBe(250);
    expect(r.category).toBe("Transport");
  });

  it("free-form phrasing with filler words", () => {
    const r = parseExpense("spent 1.2k on groceries", CATEGORIES, NOW);
    expect(r.amount).toBe(1200);
    expect(r.category).toBe("Groceries");
    expect(r.merchant).toBe("Groceries");
  });

  it("'yesterday' shifts the expense date and drops from merchant", () => {
    const r = parseExpense("500 petrol yesterday", CATEGORIES, NOW);
    expect(r.expenseDate).toBe("2026-08-15");
    expect(r.merchant).toBe("Petrol");
  });

  it("unknown merchant → uncategorized but still logged", () => {
    const r = parseExpense("800 birthday gift", CATEGORIES, NOW);
    expect(r.ok).toBe(true);
    expect(r.category).toBeNull();
    expect(r.merchant).toBe("Birthday Gift");
  });

  it("no amount → parse failure", () => {
    const r = parseExpense("bought some snacks", CATEGORIES, NOW);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("no_amount");
  });

  it("keyword matching is not fooled by substrings", () => {
    // "carpool" must not match "ola"; "billboard" must not match "bill"
    const r = parseExpense("200 billboard ad", CATEGORIES, NOW);
    expect(r.category).toBeNull();
  });
});

describe("localDate", () => {
  it("formats in IST", () => {
    // 2026-08-15 20:00 UTC is already 2026-08-16 in IST
    expect(localDate(0, new Date("2026-08-15T20:00:00Z"))).toBe("2026-08-16");
  });
});
