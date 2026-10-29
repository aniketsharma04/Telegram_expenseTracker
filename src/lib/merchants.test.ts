import { describe, it, expect } from "vitest";
import {
  cleanMerchant,
  normaliseMerchant,
  type MerchantRule,
} from "./merchants";

const rules: MerchantRule[] = [
  {
    pattern: "swiggy",
    canonical: "Swiggy",
    category: "Food & dining",
    user_id: null,
  },
  {
    pattern: "amazon",
    canonical: "Amazon",
    category: "Shopping",
    user_id: null,
  },
  {
    pattern: "amazon pay",
    canonical: "Amazon Pay",
    category: "Utilities & bills",
    user_id: null,
  },
];

describe("cleanMerchant", () => {
  it("strips payment-rail prefixes", () => {
    expect(cleanMerchant("UPI/SWIGGY")).toBe("Swiggy");
    expect(cleanMerchant("POS DMART")).toBe("Dmart");
  });

  it("drops the reference number after a separator", () => {
    expect(cleanMerchant("SWIGGY*ORDER8823")).toBe("Swiggy");
    expect(cleanMerchant("ZOMATO/882313/HDFC")).toBe("Zomato");
  });

  it("drops trailing transaction ids", () => {
    expect(cleanMerchant("AMAZON 4471123")).toBe("Amazon");
    expect(cleanMerchant("BIGBASKET-88231")).toBe("Bigbasket");
  });

  it("title-cases shouting statements but leaves mixed case alone", () => {
    expect(cleanMerchant("BLUE TOKAI COFFEE")).toBe("Blue Tokai Coffee");
    expect(cleanMerchant("BookMyShow")).toBe("BookMyShow");
  });

  it("falls back to the raw string rather than returning nothing", () => {
    expect(cleanMerchant("###")).toBe("###");
  });
});

describe("normaliseMerchant", () => {
  it("collapses every spelling onto one canonical name", () => {
    for (const raw of [
      "UPI/SWIGGY*ORDER8823/HDFC",
      "SWIGGY LTD",
      "swiggy bangalore",
    ]) {
      expect(normaliseMerchant(raw, rules)?.merchant).toBe("Swiggy");
    }
  });

  it("carries the category hint from the rule", () => {
    expect(normaliseMerchant("swiggy", rules)?.category).toBe("Food & dining");
  });

  it("prefers the longer pattern when two rules match", () => {
    expect(normaliseMerchant("AMAZON PAY ELECTRICITY", rules)?.merchant).toBe(
      "Amazon Pay",
    );
  });

  it("prefers the user's own rule over a shared default", () => {
    const withOwn = [
      ...rules,
      {
        pattern: "swiggy",
        canonical: "Swiggy Instamart",
        category: "Groceries",
        user_id: 7,
      },
    ];
    expect(normaliseMerchant("swiggy", withOwn)?.merchant).toBe(
      "Swiggy Instamart",
    );
  });

  it("still tidies a merchant no rule knows about", () => {
    const result = normaliseMerchant("UPI/SHARMA GENERAL STORE/992211", rules);
    expect(result?.merchant).toBe("Sharma General Store");
    expect(result?.matched).toBe(false);
    expect(result?.category).toBeNull();
  });

  it("has nothing to say about an empty merchant", () => {
    expect(normaliseMerchant(null, rules)).toBeNull();
    expect(normaliseMerchant("   ", rules)).toBeNull();
  });
});

describe("cleanMerchant — UPI handles (v15)", () => {
  it("names QR-code and number handles honestly instead of showing the id", () => {
    expect(cleanMerchant("paytmqr281005050101@paytm")).toBe("UPI merchant");
    expect(cleanMerchant("BHARATPE.9Y0V2E0A4B21234@fbpe")).toBe("UPI merchant");
    expect(cleanMerchant("q123456789@ybl")).toBe("UPI merchant");
    expect(cleanMerchant("9876543210@ybl")).toBe("UPI transfer");
  });

  it("turns a merchant handle into a readable name", () => {
    expect(cleanMerchant("swiggy.stores@axisbank")).toBe("Swiggy");
    expect(cleanMerchant("chaiwala@ybl")).toBe("Chaiwala");
    expect(cleanMerchant("blue-tokai.rzp@icici")).toBe("Blue Tokai");
  });
});
