import { describe, expect, it } from "vitest";
import {
  compareRegimes,
  newRegimeTax,
  nextAdvanceTax,
  oldRegimeTax,
} from "./tax";

// Reference points from published FY 2025-26 / 2026-27 worked examples.
describe("new regime", () => {
  it("is zero up to ₹12L taxable (₹12.75L salary)", () => {
    expect(newRegimeTax(12_00_000, false).total).toBe(0);
    expect(newRegimeTax(12_75_000, true).total).toBe(0);
  });

  it("applies marginal relief just above ₹12L", () => {
    // ₹12.10L taxable: slab ₹61,500, relief caps it at ₹10,000, +4% cess.
    const r = newRegimeTax(12_10_000, false);
    expect(r.slabTax).toBe(61_500);
    expect(r.total).toBe(10_400);
    // ₹12.5L: ₹67,500 slab, capped at ₹50,000, + cess.
    expect(newRegimeTax(12_50_000, false).total).toBe(52_000);
    // ₹12.75L: relief no longer helps — full ₹71,250 + cess.
    expect(newRegimeTax(12_75_000, false).total).toBe(74_100);
  });

  it("matches the slab table at higher incomes", () => {
    // ₹24L taxable: 20k+40k+60k+80k+1L = ₹3,00,000, + cess.
    expect(newRegimeTax(24_00_000, false).total).toBe(3_12_000);
    // ₹30L: + 6L × 30% = ₹4,80,000, + cess.
    expect(newRegimeTax(30_00_000, false).total).toBe(4_99_200);
  });
});

describe("old regime", () => {
  it("rebates fully up to ₹5L taxable, with no marginal relief after", () => {
    expect(oldRegimeTax({ gross: 5_50_000, salaried: true }).total).toBe(0);
    // ₹5,10,000 taxable: 12,500 + 2,000 = ₹14,500, + cess — a cliff, by law.
    expect(oldRegimeTax({ gross: 5_10_000, salaried: false }).total).toBe(
      15_080,
    );
  });

  it("caps each deduction at its limit", () => {
    const r = oldRegimeTax({
      gross: 20_00_000,
      salaried: true,
      sec80C: 5_00_000, // capped to 1.5L
      sec80D: 25_000,
      nps: 1_00_000, // capped to 50k
      homeLoanInterest: 3_00_000, // capped to 2L
      hraExempt: 1_20_000,
    });
    expect(r.deductions).toBe(
      50_000 + 1_50_000 + 25_000 + 50_000 + 2_00_000 + 1_20_000,
    );
    expect(r.taxable).toBe(20_00_000 - 5_95_000);
    // 14,05,000: 12,500 + 1,00,000 + 4,05,000×30% = 2,34,000, + cess.
    expect(r.total).toBe(2_43_360);
  });

  it("ignores negative or missing deductions", () => {
    expect(
      oldRegimeTax({ gross: 8_00_000, salaried: false, sec80C: -5 }).taxable,
    ).toBe(8_00_000);
  });
});

describe("comparison", () => {
  it("prefers new for a typical salary with few deductions", () => {
    const c = compareRegimes({
      gross: 15_00_000,
      salaried: true,
      sec80C: 1_50_000,
    });
    expect(c.better).toBe("new");
    expect(c.saving).toBe(c.oldRegime.total - c.newRegime.total);
    expect(c.saving).toBeGreaterThan(0);
  });

  it("can prefer old with heavy deductions", () => {
    const c = compareRegimes({
      gross: 25_00_000,
      salaried: true,
      sec80C: 1_50_000,
      sec80D: 75_000,
      nps: 50_000,
      homeLoanInterest: 2_00_000,
      hraExempt: 4_00_000,
    });
    expect(c.better).toBe("old");
  });

  it("flags surcharge above ₹50L instead of pretending", () => {
    expect(
      compareRegimes({ gross: 60_00_000, salaried: true }).surchargeApplies,
    ).toBe(true);
    expect(
      compareRegimes({ gross: 50_00_000, salaried: true }).surchargeApplies,
    ).toBe(false);
  });

  it("is 'same' when both are zero", () => {
    expect(compareRegimes({ gross: 3_00_000, salaried: true }).better).toBe(
      "same",
    );
  });
});

describe("advance tax dates", () => {
  it("finds the next instalment", () => {
    expect(nextAdvanceTax("2026-11-10")).toEqual({
      date: "2026-12-15",
      share: 0.75,
    });
    expect(nextAdvanceTax("2026-12-15")).toEqual({
      date: "2026-12-15",
      share: 0.75,
    });
    expect(nextAdvanceTax("2026-12-16")).toEqual({
      date: "2027-03-15",
      share: 1,
    });
    expect(nextAdvanceTax("2027-03-16")).toEqual({
      date: "2027-06-15",
      share: 0.15,
    });
  });
});
