import { describe, it, expect } from "vitest";
import { detectTransferIntent } from "./transfers";
import type { Account } from "./accounts";

const account = (
  over: Partial<Account> & { id: string; name: string },
): Account => ({
  user_id: 1,
  kind: "bank",
  identifier: null,
  opening_balance: 0,
  credit_limit: null,
  statement_day: null,
  due_day: null,
  is_default: false,
  archived: false,
  ...over,
});

const accounts: Account[] = [
  account({ id: "hdfc", name: "HDFC", kind: "bank", is_default: true }),
  account({ id: "cash", name: "Cash", kind: "cash" }),
  account({ id: "paytm", name: "Paytm", kind: "wallet" }),
  account({ id: "card", name: "HDFC Card", kind: "credit_card" }),
];

describe("detectTransferIntent", () => {
  it("says nothing about an ordinary purchase", () => {
    expect(detectTransferIntent("450 lunch at swiggy", accounts)).toBeNull();
    expect(detectTransferIntent("1200 groceries dmart", accounts)).toBeNull();
  });

  it("reads an ATM withdrawal as bank → cash", () => {
    const intent = detectTransferIntent("withdrew 5000 from atm", accounts);
    expect(intent?.kind).toBe("transfer");
    expect(intent?.fromAccountId).toBe("hdfc");
    expect(intent?.toAccountId).toBe("cash");
  });

  it("reads a card bill payment as a card payment, not spending", () => {
    const intent = detectTransferIntent(
      "paid 12000 credit card bill",
      accounts,
    );
    expect(intent?.kind).toBe("card_payment");
    expect(intent?.toAccountId).toBe("card");
    expect(intent?.fromAccountId).toBe("hdfc");
  });

  it("routes a CRED payment to the card too", () => {
    expect(detectTransferIntent("8000 cred payment", accounts)?.kind).toBe(
      "card_payment",
    );
  });

  it("uses both named accounts when the text names two", () => {
    const intent = detectTransferIntent(
      "transferred 2000 from HDFC to Paytm",
      accounts,
    );
    expect(intent?.fromAccountId).toBe("hdfc");
    expect(intent?.toAccountId).toBe("paytm");
  });

  it("fills in the default bank when only the destination is named", () => {
    const intent = detectTransferIntent("moved to Paytm 1500", accounts);
    expect(intent?.fromAccountId).toBe("hdfc");
    expect(intent?.toAccountId).toBe("paytm");
  });

  it("explains itself so the guess is never silent", () => {
    const intent = detectTransferIntent("atm 2000", accounts);
    expect(intent?.reason).toContain("atm");
  });

  it("stays quiet when there are no accounts to move between", () => {
    expect(detectTransferIntent("withdrew 5000 from atm", [])).toBeNull();
    expect(detectTransferIntent("paid credit card bill 9000", [])).toBeNull();
  });

  it("ignores archived accounts when picking a destination", () => {
    const archivedCash = [
      accounts[0],
      account({ id: "cash", name: "Cash", kind: "cash", archived: true }),
    ];
    expect(
      detectTransferIntent("atm withdrawal 3000", archivedCash),
    ).toBeNull();
  });

  it("does not fire on merely similar wording", () => {
    // "transfer" is the trigger word; a transfer *fee* is a real expense, but
    // the conservative rule is to stay quiet rather than guess wrong.
    expect(detectTransferIntent("450 movie tickets", accounts)).toBeNull();
    expect(
      detectTransferIntent("paid 300 to the plumber", accounts),
    ).toBeNull();
  });
});
