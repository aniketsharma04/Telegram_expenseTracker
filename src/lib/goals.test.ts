import { describe, expect, it } from "vitest";
import { cycleCredits, goalOutlook, monthlyFor } from "./goals";

const goa = {
  id: "g1",
  name: "Goa trip",
  target_amount: 30000,
  saved: 10000,
  monthly: 5000,
  target_date: "2027-03-31",
  created_at: "2026-09-01",
};
const phone = {
  id: "g2",
  name: "Phone",
  target_amount: 15000,
  saved: 0,
  monthly: 2500,
  target_date: null,
  created_at: "2026-09-01",
};

describe("monthlyFor", () => {
  it("spreads what's left over the months until the date", () => {
    // 20,000 left, Oct 24 → Mar 31 is 5 budget months (rounded up).
    expect(monthlyFor(30000, 10000, "2027-03-31", "2026-10-24")).toBe(4000);
  });
  it("needs nothing once it's reached", () => {
    expect(monthlyFor(30000, 30000, "2027-03-31", "2026-10-24")).toBe(0);
  });
});

describe("cycleCredits", () => {
  it("credits every goal its monthly amount after a month within budget", () => {
    expect(cycleCredits([goa, phone], 1200, "2026-10-31")).toEqual([
      { goalId: "g1", amount: 5000 },
      { goalId: "g2", amount: 2500 },
    ]);
  });

  it("takes an overspend out of the credits, proportionally", () => {
    // 7,500 planned, 3,000 overspent → 60% of each.
    expect(cycleCredits([goa, phone], -3000, "2026-10-31")).toEqual([
      { goalId: "g1", amount: 3000 },
      { goalId: "g2", amount: 1500 },
    ]);
  });

  it("credits nothing when the overspend ate it all, and never past the target", () => {
    expect(cycleCredits([goa], -9000, "2026-10-31")).toEqual([
      { goalId: "g1", amount: 0 },
    ]);
    expect(cycleCredits([{ ...goa, saved: 28000 }], 0, "2026-10-31")).toEqual([
      { goalId: "g1", amount: 2000 },
    ]);
  });

  it("skips goals created after the month ended", () => {
    expect(
      cycleCredits([{ ...phone, created_at: "2026-11-02" }], 0, "2026-10-31"),
    ).toEqual([]);
  });
});

describe("goalOutlook", () => {
  it("says when it'll be reached and whether that's on time", () => {
    expect(goalOutlook(goa, "2026-10-24")).toMatchObject({
      pct: 33,
      monthsLeft: 4,
      onTrack: true,
    });
    expect(goalOutlook({ ...goa, monthly: 2000 }, "2026-10-24")).toMatchObject({
      monthsLeft: 10,
      onTrack: false,
    });
    expect(goalOutlook(phone, "2026-10-24")).toMatchObject({
      pct: 0,
      monthsLeft: 6,
      onTrack: null,
    });
  });
});
