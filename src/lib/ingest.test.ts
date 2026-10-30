import { describe, expect, it } from "vitest";
import { isSameTransaction } from "./ingest";

/**
 * The cross-channel dedupe: one purchase can arrive as a bank SMS *and* an
 * app notification *and* an email. Two separate purchases of the same amount
 * must not be mistaken for one.
 */
describe("isSameTransaction", () => {
  const logged = {
    status: "logged",
    direction: "debit",
    reference: null as string | null,
    source: "notification",
  };

  it("treats the same amount from another channel as the same purchase", () => {
    expect(
      isSameTransaction(
        logged,
        { direction: "debit", reference: null },
        "email",
      ),
    ).toBe(true);
  });

  it("keeps two same-amount payments from the same channel apart", () => {
    // Two ₹30 coffees in a day, both seen as phone notifications.
    expect(
      isSameTransaction(
        logged,
        { direction: "debit", reference: null },
        "notification",
      ),
    ).toBe(false);
  });

  it("decides by reference number when both sides carry one", () => {
    const withRef = { ...logged, reference: "612345678901" };
    expect(
      isSameTransaction(
        withRef,
        { direction: "debit", reference: "612345678901" },
        "notification",
      ),
    ).toBe(true);
    expect(
      isSameTransaction(
        withRef,
        { direction: "debit", reference: "699999999999" },
        "email",
      ),
    ).toBe(false);
  });

  it("never matches the other direction or an entry that wasn't logged", () => {
    expect(
      isSameTransaction(
        logged,
        { direction: "credit", reference: null },
        "email",
      ),
    ).toBe(false);
    expect(
      isSameTransaction(
        { ...logged, status: "ignored" },
        { direction: "debit", reference: null },
        "email",
      ),
    ).toBe(false);
  });
});
