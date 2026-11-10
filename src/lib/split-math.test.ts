import { describe, expect, it } from "vitest";
import {
  allocate,
  balancesWithMe,
  checkSplit,
  guessRepayments,
  ME,
  membersFor,
  nameScore,
  nets,
  pairwise,
  simplify,
  upiLink,
  type SplitLike,
} from "./split-math";

const sum = (m: Map<string, number>) =>
  [...m.values()].reduce((a, b) => a + b, 0);

describe("allocate", () => {
  it("splits ₹1,000 three ways to the paisa, payer first", () => {
    const m = allocate(100000, "equal", [
      { key: ME },
      { key: "a" },
      { key: "b" },
    ]);
    expect([...m.values()]).toEqual([33334, 33333, 33333]);
    expect(sum(m)).toBe(100000);
  });

  it("does shares and percentages", () => {
    expect([
      ...allocate(90000, "shares", [
        { key: ME, value: 2 },
        { key: "a", value: 1 },
      ]).values(),
    ]).toEqual([60000, 30000]);
    expect([
      ...allocate(10001, "percent", [
        { key: ME, value: 50 },
        { key: "a", value: 50 },
      ]).values(),
    ]).toEqual([5001, 5000]);
    expect(() =>
      allocate(100, "percent", [
        { key: ME, value: 60 },
        { key: "a", value: 30 },
      ]),
    ).toThrow(/100/);
  });

  it("checks exact amounts add up", () => {
    expect(() =>
      allocate(1000, "exact", [
        { key: ME, value: 600 },
        { key: "a", value: 300 },
      ]),
    ).toThrow(/900/);
    expect(
      allocate(1000, "exact", [
        { key: ME, value: 600 },
        { key: "a", value: 400 },
      ]).get("a"),
    ).toBe(400);
  });

  it("never hands a leftover paisa to a zero weight", () => {
    const m = allocate(101, "shares", [
      { key: ME, value: 0 },
      { key: "a", value: 1 },
      { key: "b", value: 1 },
    ]);
    expect(m.get(ME)).toBe(0);
    expect(sum(m)).toBe(101);
  });

  it("rejects nonsense", () => {
    expect(() => allocate(0, "equal", [{ key: ME }])).toThrow();
    expect(() => allocate(100, "equal", [])).toThrow();
    expect(() => allocate(100, "equal", [{ key: ME }, { key: ME }])).toThrow(
      /duplicate/,
    );
  });

  it("always adds up (randomised)", () => {
    let seed = 7;
    const r = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let i = 0; i < 2000; i++) {
      const n = 1 + Math.floor(r() * 9);
      const total = 1 + Math.floor(r() * 5_000_000);
      const shares = Array.from({ length: n }, (_, k) => ({
        key: `k${k}`,
        value: 1 + Math.floor(r() * 5),
      }));
      for (const method of ["equal", "shares"] as const) {
        const m = allocate(total, method, shares);
        expect(sum(m)).toBe(total);
        // Equal shares never differ by more than a paisa.
        if (method === "equal")
          expect(
            Math.max(...m.values()) - Math.min(...m.values()),
          ).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("balances", () => {
  // ₹3,000 dinner for four, you paid.
  const dinner: SplitLike = {
    kind: "expense",
    total: 300000,
    members: membersFor(
      300000,
      ME,
      allocate(300000, "equal", [
        { key: ME },
        { key: "rahul" },
        { key: "amit" },
        { key: "neha" },
      ]),
    ),
  };

  it("you paid: everyone owes you their share", () => {
    expect(checkSplit(dinner)).toBeNull();
    expect(Object.fromEntries(balancesWithMe([dinner]))).toEqual({
      rahul: 75000,
      amit: 75000,
      neha: 75000,
    });
  });

  it("a payment cancels the debt", () => {
    const back: SplitLike = {
      kind: "payment",
      total: 75000,
      members: [
        { key: "rahul", paid: 75000, owed: 0 },
        { key: ME, paid: 0, owed: 75000 },
      ],
    };
    expect(balancesWithMe([dinner, back]).has("rahul")).toBe(false);
    const half: SplitLike = {
      ...back,
      total: 50000,
      members: [
        { key: "rahul", paid: 50000, owed: 0 },
        { key: ME, paid: 0, owed: 50000 },
      ],
    };
    expect(balancesWithMe([dinner, half]).get("rahul")).toBe(25000);
  });

  it("overpaying flips the balance instead of going missing", () => {
    const over: SplitLike = {
      kind: "payment",
      total: 80000,
      members: [
        { key: "rahul", paid: 80000, owed: 0 },
        { key: ME, paid: 0, owed: 80000 },
      ],
    };
    expect(balancesWithMe([dinner, over]).get("rahul")).toBe(-5000); // you owe Rahul ₹50 back
  });

  it("a friend paid: you owe them your share", () => {
    const cab: SplitLike = {
      kind: "expense",
      total: 60000,
      members: membersFor(
        60000,
        "amit",
        allocate(60000, "equal", [{ key: "amit" }, { key: ME }]),
      ),
    };
    expect(balancesWithMe([dinner, cab]).get("amit")).toBe(75000 - 30000);
  });

  it("multiple payers spread debts in proportion", () => {
    // ₹1,000 total: you paid 600, Rahul paid 400; split equally among you, Rahul, Neha.
    const s: SplitLike = {
      kind: "expense",
      total: 100000,
      members: [
        { key: ME, paid: 60000, owed: 33334 },
        { key: "rahul", paid: 40000, owed: 33333 },
        { key: "neha", paid: 0, owed: 33333 },
      ],
    };
    expect(checkSplit(s)).toBeNull();
    const p = pairwise(s);
    expect(p.reduce((a, [, , v]) => a + v, 0)).toBe(33333);
    // Neha's ₹333.33 goes to you and Rahul in proportion to what you're owed (266.66 : 66.67).
    const toMe = p.find(([f, t]) => f === "neha" && t === ME)![2];
    expect(toMe).toBe(26666);
    expect(balancesWithMe([s]).get("neha")).toBe(26666);
  });

  it("catches inconsistent splits", () => {
    expect(
      checkSplit({
        kind: "expense",
        total: 100,
        members: [
          { key: ME, paid: 100, owed: 50 },
          { key: "a", paid: 0, owed: 40 },
        ],
      }),
    ).toMatch(/shares/);
    expect(
      checkSplit({
        kind: "expense",
        total: 100,
        members: [
          { key: "a", paid: 100, owed: 50 },
          { key: "b", paid: 0, owed: 50 },
        ],
      }),
    ).toMatch(/you/);
  });
});

describe("simplify", () => {
  it("beats greedy on the known counterexample", () => {
    // Nets −3, −2, −2, +3, +4: three transfers suffice; greedy needs four.
    const n = new Map([
      ["a", -300],
      ["b", -200],
      ["c", -200],
      ["d", 300],
      ["e", 400],
    ]);
    const t = simplify(n);
    expect(t).toHaveLength(3);
    const after = new Map(n);
    for (const [from, to, amt] of t) {
      after.set(from, after.get(from)! + amt);
      after.set(to, after.get(to)! - amt);
    }
    expect([...after.values()].every((v) => v === 0)).toBe(true);
  });

  it("settles everyone (randomised)", () => {
    let seed = 3;
    const r = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let i = 0; i < 300; i++) {
      const n = 2 + Math.floor(r() * 14);
      const vals = Array.from(
        { length: n - 1 },
        () => Math.floor(r() * 20000) - 10000,
      );
      vals.push(-vals.reduce((a, b) => a + b, 0));
      const m = new Map(vals.map((v, k) => [`p${k}`, v]));
      const t = simplify(m);
      const nonzero = vals.filter((v) => v !== 0).length;
      expect(t.length).toBeLessThanOrEqual(Math.max(0, nonzero - 1));
      for (const [from, to, amt] of t) {
        expect(amt).toBeGreaterThan(0);
        m.set(from, m.get(from)! + amt);
        m.set(to, m.get(to)! - amt);
      }
      expect([...m.values()].every((v) => v === 0)).toBe(true);
    }
  });

  it("matches the nets of the splits it came from", () => {
    const s: SplitLike = {
      kind: "expense",
      total: 900,
      members: [
        { key: ME, paid: 900, owed: 300 },
        { key: "a", paid: 0, owed: 300 },
        { key: "b", paid: 0, owed: 300 },
      ],
    };
    expect(simplify(nets([s]))).toHaveLength(2);
  });
});

describe("upi link", () => {
  it("builds an intent link with the amount in rupees", () => {
    expect(
      upiLink({
        upiId: "rahul@okicici",
        name: "Rahul S",
        amount: 75050,
        note: "Dinner & drinks",
      }),
    ).toBe(
      "upi://pay?pa=rahul%40okicici&pn=Rahul%20S&am=750.50&cu=INR&tn=Dinner%20%26%20drinks",
    );
  });
  it("refuses something that isn't a UPI ID", () => {
    expect(() => upiLink({ upiId: "9876543210", amount: 100 })).toThrow();
  });
});

describe("repayment guesses", () => {
  const people = [
    { key: "rahul", name: "Rahul Sharma" },
    { key: "amit", name: "Amit", bankNames: ["SUNITA VERMA"] },
    { key: "neha", name: "Neha" },
  ];
  const owed = new Map([
    ["rahul", 75000],
    ["amit", 30000],
    ["neha", 75000],
  ]);

  it("scores names", () => {
    expect(nameScore("RAHUL K SHARMA", people[0])).toBe(0.9);
    expect(nameScore("RAHUL KUMAR", people[0])).toBe(0.5);
    expect(nameScore("SUNITA VERMA", people[1])).toBe(1); // learned
    expect(nameScore("SWIGGY", people[0])).toBe(0);
  });

  it("matches a named repayment, and a learned name", () => {
    const g = guessRepayments(
      [
        {
          id: "i1",
          amount: 750,
          source: "RAHUL K SHARMA",
          income_date: "2026-11-10",
        },
        {
          id: "i2",
          amount: 300,
          source: "SUNITA VERMA",
          income_date: "2026-11-10",
        },
      ],
      owed,
      people,
    );
    expect(g.map((x) => [x.incomeId, x.personKey]).sort()).toEqual([
      ["i1", "rahul"],
      ["i2", "amit"],
    ]);
  });

  it("guesses on amount alone only when one person owes exactly that", () => {
    // ₹750 from an unknown name: Rahul and Neha both owe ₹750 — don't guess.
    expect(
      guessRepayments(
        [{ id: "x", amount: 750, source: "S K GUPTA", income_date: "d" }],
        owed,
        people,
      ),
    ).toEqual([]);
    // ₹300 from an unknown name: only Amit owes that.
    expect(
      guessRepayments(
        [{ id: "y", amount: 300, source: "S K GUPTA", income_date: "d" }],
        owed,
        people,
      )[0]?.personKey,
    ).toBe("amit");
  });

  it("ignores credits bigger than the debt, or from people who owe nothing", () => {
    expect(
      guessRepayments(
        [{ id: "s", amount: 50000, source: "RAHUL SHARMA", income_date: "d" }],
        owed,
        people,
      ),
    ).toEqual([]);
    expect(
      guessRepayments(
        [{ id: "z", amount: 100, source: "Priya", income_date: "d" }],
        owed,
        people,
      ),
    ).toEqual([]);
  });
});
