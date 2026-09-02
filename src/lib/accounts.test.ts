import { describe, it, expect } from "vitest";
import {
  accountBalance,
  balanceSheet,
  isLiability,
  type Account,
  type LedgerRows,
} from "./accounts";

const account = (over: Partial<Account> & { id: string }): Account => ({
  user_id: 1,
  name: "Account",
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

const empty: LedgerRows = { expenses: [], incomes: [], transfers: [] };

describe("accountBalance", () => {
  it("starts at the opening balance", () => {
    const a = account({ id: "a", opening_balance: 5000 });
    expect(accountBalance(a, empty)).toBe(5000);
  });

  it("adds income and subtracts expenses on the same account", () => {
    const a = account({ id: "a", opening_balance: 1000 });
    const rows: LedgerRows = {
      expenses: [{ account_id: "a", amount: 250 }],
      incomes: [{ account_id: "a", amount: 4000 }],
      transfers: [],
    };
    expect(accountBalance(a, rows)).toBe(4750);
  });

  it("ignores rows belonging to other accounts", () => {
    const a = account({ id: "a", opening_balance: 100 });
    const rows: LedgerRows = {
      expenses: [{ account_id: "b", amount: 90 }],
      incomes: [{ account_id: null, amount: 500 }],
      transfers: [],
    };
    expect(accountBalance(a, rows)).toBe(100);
  });

  it("moves money out of the source and into the destination", () => {
    const bank = account({ id: "bank", opening_balance: 10000 });
    const wallet = account({ id: "wallet", kind: "wallet" });
    const rows: LedgerRows = {
      expenses: [],
      incomes: [],
      transfers: [
        { from_account_id: "bank", to_account_id: "wallet", amount: 2000 },
      ],
    };
    expect(accountBalance(bank, rows)).toBe(8000);
    expect(accountBalance(wallet, rows)).toBe(2000);
  });

  it("nets to zero across a transfer — the point of the whole feature", () => {
    const bank = account({ id: "bank", opening_balance: 10000 });
    const cash = account({ id: "cash", kind: "cash" });
    const rows: LedgerRows = {
      expenses: [],
      incomes: [],
      transfers: [
        { from_account_id: "bank", to_account_id: "cash", amount: 3000 },
      ],
    };
    const total = accountBalance(bank, rows) + accountBalance(cash, rows);
    expect(total).toBe(10000);
  });

  it("rounds to paise rather than carrying float noise", () => {
    const a = account({ id: "a", opening_balance: 0 });
    const rows: LedgerRows = {
      expenses: [
        { account_id: "a", amount: 0.1 },
        { account_id: "a", amount: 0.2 },
      ],
      incomes: [],
      transfers: [],
    };
    expect(accountBalance(a, rows)).toBe(-0.3);
  });
});

describe("credit cards", () => {
  it("treats only cards as liabilities", () => {
    expect(isLiability("credit_card")).toBe(true);
    expect(isLiability("bank")).toBe(false);
    expect(isLiability("cash")).toBe(false);
    expect(isLiability("wallet")).toBe(false);
  });

  it("reports spending on a card as outstanding, not as a negative asset", () => {
    const card = account({
      id: "card",
      kind: "credit_card",
      credit_limit: 100000,
    });
    const rows: LedgerRows = {
      expenses: [{ account_id: "card", amount: 12000 }],
      incomes: [],
      transfers: [],
    };
    const sheet = balanceSheet([card], rows);
    expect(sheet.accounts[0].balance).toBe(-12000);
    expect(sheet.accounts[0].outstanding).toBe(12000);
    expect(sheet.accounts[0].available).toBe(88000);
    expect(sheet.assets).toBe(0);
    expect(sheet.liabilities).toBe(12000);
    expect(sheet.net).toBe(-12000);
  });

  it("clears the card when the bill is paid, without double-counting spend", () => {
    const bank = account({ id: "bank", opening_balance: 50000 });
    const card = account({ id: "card", kind: "credit_card" });
    const rows: LedgerRows = {
      expenses: [{ account_id: "card", amount: 12000 }],
      incomes: [],
      transfers: [
        { from_account_id: "bank", to_account_id: "card", amount: 12000 },
      ],
    };
    const sheet = balanceSheet([bank, card], rows);
    expect(sheet.accounts[1].outstanding).toBe(0);
    expect(sheet.assets).toBe(38000);
    expect(sheet.liabilities).toBe(0);
    // Spent 12k once: net worth drops by 12k, not 24k.
    expect(sheet.net).toBe(38000);
  });
});

describe("balanceSheet", () => {
  it("sums assets and liabilities into a net position", () => {
    const accounts = [
      account({ id: "bank", opening_balance: 80000 }),
      account({ id: "cash", kind: "cash", opening_balance: 2500 }),
      account({ id: "card", kind: "credit_card" }),
    ];
    const rows: LedgerRows = {
      expenses: [{ account_id: "card", amount: 9000 }],
      incomes: [],
      transfers: [],
    };
    const sheet = balanceSheet(accounts, rows);
    expect(sheet.assets).toBe(82500);
    expect(sheet.liabilities).toBe(9000);
    expect(sheet.net).toBe(73500);
  });

  it("leaves archived accounts out of the totals but keeps their balance", () => {
    const accounts = [
      account({ id: "live", opening_balance: 1000 }),
      account({ id: "old", opening_balance: 400, archived: true }),
    ];
    const sheet = balanceSheet(accounts, empty);
    expect(sheet.assets).toBe(1000);
    expect(sheet.accounts.find((a) => a.id === "old")?.balance).toBe(400);
  });

  it("counts unassigned rows so the reconciliation backlog is visible", () => {
    const rows: LedgerRows = {
      expenses: [
        { account_id: null, amount: 300 },
        { account_id: "bank", amount: 100 },
      ],
      incomes: [{ account_id: null, amount: 5000 }],
      transfers: [],
    };
    const sheet = balanceSheet([account({ id: "bank" })], rows);
    expect(sheet.unassigned.expenses).toBe(300);
    expect(sheet.unassigned.incomes).toBe(5000);
  });

  it("has no accounts to report before the user sets any up", () => {
    const sheet = balanceSheet([], empty);
    expect(sheet.accounts).toEqual([]);
    expect(sheet.net).toBe(0);
  });
});
