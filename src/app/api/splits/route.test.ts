import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Splits end to end: the real /api/splits, /api/splits/settle, /api/people
 * and /api/expense routes, the real splits library and maths, on an in-memory
 * database that enforces the v24 rules. Only Postgres itself is faked.
 */

type Row = Record<string, unknown>;
const db: {
  t: Record<string, Row[]>;
  missing: Set<string>;
  failInsert: string | null;
} = {
  t: {},
  missing: new Set(),
  failInsert: null,
};
let seq = 1;

class PgError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

function check(table: string, row: Row, rows: Row[]) {
  if (table === "split_members") {
    if (Number(row.paid) < 0 || Number(row.owed) < 0)
      throw new PgError("paid/owed check", "23514");
    if (
      rows.some(
        (r) =>
          r !== row &&
          r.split_id === row.split_id &&
          (r.person_id ?? null) === (row.person_id ?? null),
      )
    )
      throw new PgError("duplicate split member", "23505");
  }
  if (table === "splits" && !(Number(row.total) > 0))
    throw new PgError("total check", "23514");
  if (table === "people" && !String(row.name ?? "").trim())
    throw new PgError("name check", "23514");
  if (table === "expenses" && !(Number(row.amount) > 0))
    throw new PgError("amount check", "23514");
}

function defaults(table: string, row: Row): Row {
  const id = `${table.slice(0, 3)}-${seq++}`;
  if (table === "people")
    return {
      id,
      upi_id: null,
      phone: null,
      bank_names: [],
      linked_user_id: null,
      archived: false,
      ...row,
    };
  if (table === "splits")
    return {
      id,
      group_id: null,
      created_at: new Date(Date.UTC(2026, 10, 1, 0, 0, seq)).toISOString(),
      ...row,
    };
  if (table === "split_members") return { weight: null, ...row };
  if (table === "expenses")
    return { id, split_id: null, paid_by: null, account_id: null, ...row };
  if (table === "incomes")
    return {
      id,
      split_id: null,
      repayment_checked: false,
      account_id: null,
      ...row,
    };
  return { id, ...row };
}

function from(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let op: {
    kind: "select" | "insert" | "update" | "delete";
    payload?: Row | Row[];
  } = { kind: "select" };
  let cols = "";
  let returning = false;
  let single = false;
  const orders: { col: string; asc: boolean }[] = [];

  const run = async (): Promise<{ data: unknown; error: PgError | null }> => {
    if (db.missing.has(table))
      return {
        data: null,
        error: new PgError(`relation "${table}" does not exist`, "42P01"),
      };
    const rows = (db.t[table] ??= []);
    const project = (r: Row) => {
      const out = { ...r };
      if (table === "splits" && cols.includes("split_members"))
        out.split_members = (db.t.split_members ?? [])
          .filter((m) => m.split_id === r.id)
          .map((m) => ({ ...m }));
      return out;
    };
    try {
      switch (op.kind) {
        case "select": {
          let out = rows.filter((r) => filters.every((f) => f(r)));
          for (const { col, asc } of [...orders].reverse())
            out = [...out].sort(
              (a, b) =>
                (String(a[col]) < String(b[col])
                  ? -1
                  : String(a[col]) > String(b[col])
                    ? 1
                    : 0) * (asc ? 1 : -1),
            );
          const data = out.map(project);
          return { data: single ? (data[0] ?? null) : data, error: null };
        }
        case "insert": {
          if (db.failInsert === table)
            throw new PgError("simulated failure", "XX000");
          const list = (
            Array.isArray(op.payload) ? op.payload : [op.payload!]
          ).map((p) => defaults(table, p));
          for (const r of list) {
            rows.push(r);
            check(table, r, rows);
          }
          const data = list.map(project);
          return {
            data: returning ? (single ? data[0] : data) : null,
            error: null,
          };
        }
        case "update": {
          const hit = rows.filter((r) => filters.every((f) => f(r)));
          for (const r of hit) {
            Object.assign(r, op.payload);
            check(table, r, rows);
          }
          const data = hit.map(project);
          return {
            data: returning ? (single ? (data[0] ?? null) : data) : null,
            error: null,
          };
        }
        case "delete": {
          const gone = rows.filter((r) => filters.every((f) => f(r)));
          db.t[table] = rows.filter((r) => !gone.includes(r));
          if (table === "splits")
            db.t.split_members = (db.t.split_members ?? []).filter(
              (m) => !gone.some((g) => g.id === m.split_id),
            );
          return {
            data: returning ? gone.map((r) => ({ id: r.id })) : null,
            error: null,
          };
        }
      }
    } catch (e) {
      // A failed statement leaves nothing behind (Postgres rolls back the statement).
      if (op.kind === "insert")
        db.t[table] = rows.filter(
          (r) =>
            !(Array.isArray(op.payload) ? op.payload : [op.payload]).some((p) =>
              Object.entries(p as Row).every(([k, v]) => r[k] === v),
            ),
        );
      return { data: null, error: e as PgError };
    }
  };

  const b = {
    select: (c?: string) => {
      if (op.kind === "select") cols = c ?? "";
      else returning = true;
      cols = c ?? cols;
      return b;
    },
    eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), b),
    gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), b),
    in: (c: string, list: unknown[]) => (
      filters.push((r) => list.includes(r[c])),
      b
    ),
    is: (c: string, v: null) => (filters.push((r) => (r[c] ?? null) === v), b),
    not: (c: string, o: string, v: null) => (
      o === "is" ? filters.push((r) => (r[c] ?? null) !== v) : 0,
      b
    ),
    or: (expr: string) => {
      const parts = expr.split(",").map((p) => p.split(".eq."));
      filters.push((r) => parts.some(([c, v]) => String(r[c]) === v));
      return b;
    },
    order: (c: string, o?: { ascending?: boolean }) => (
      orders.push({ col: c, asc: o?.ascending !== false }),
      b
    ),
    limit: () => b,
    single: () => ((single = true), b),
    maybeSingle: () => ((single = true), b),
    insert: (p: Row | Row[]) => ((op = { kind: "insert", payload: p }), b),
    update: (p: Row) => ((op = { kind: "update", payload: p }), b),
    delete: () => ((op = { kind: "delete" }), b),
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
      run().then(ok, bad),
  };
  return b;
}

vi.mock("@/lib/supabase-server", () => ({
  createServiceClient: () => ({ from }),
}));
vi.mock("@/lib/api-auth", () => ({
  authedUser: (req: NextRequest) => {
    const m = req.headers.get("authorization")?.match(/^Bearer user-(\d+)$/);
    return m ? Number(m[1]) : null;
  },
}));

const splits = await import("./route");
const settle = await import("./settle/route");
const peopleRoute = await import("../people/route");
const expenseRoute = await import("../expense/route");
const { splitTwin } = await import("@/lib/ingest");
const { getIncomes } = await import("@/lib/income");
const { scopeExpenses } = await import("@/lib/daily-budget");

const ME_ID = 1;
const OTHER = 2;
const call = async (
  handler: (r: NextRequest) => Promise<Response>,
  method: string,
  path: string,
  body?: unknown,
  user = ME_ID,
) => {
  const res = await handler(
    new NextRequest(`http://x${path}`, {
      method,
      headers: {
        authorization: `Bearer user-${user}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return {
    status: res.status,
    body: (await res.json()) as Record<string, any>,
  };
};
const addPerson = async (name: string, extra: Row = {}, user = ME_ID) =>
  (
    await call(
      peopleRoute.POST,
      "POST",
      "/api/people",
      { name, ...extra },
      user,
    )
  ).body.person.id as string;
const summary = async () => (await call(splits.GET, "GET", "/api/splits")).body;
const expenses = (user = ME_ID) =>
  (db.t.expenses ?? []).filter((e) => e.user_id === user);
const balanceOf = async (id: string) =>
  (await summary()).people.find((p: any) => p.id === id)?.balance ?? 0;

beforeEach(() => {
  seq = 1;
  db.missing.clear();
  db.failInsert = null;
  db.t = {
    users: [
      { id: ME_ID, upi_id: null },
      { id: OTHER, upi_id: null },
    ],
    expenses: [
      {
        id: "dinner",
        user_id: ME_ID,
        amount: 3000,
        category: "Food",
        merchant: "Toit",
        expense_date: "2026-11-08",
        account_id: "acc-hdfc",
        source: "auto_notification",
        split_id: null,
        paid_by: null,
      },
      {
        id: "lunch",
        user_id: ME_ID,
        amount: 400,
        category: "Food",
        merchant: "Cafe",
        expense_date: "2026-11-08",
        account_id: "acc-hdfc",
        source: "auto_sms",
        split_id: null,
        paid_by: null,
      },
    ],
    incomes: [],
    people: [],
    splits: [],
    split_members: [],
  };
});

describe("splitting a captured payment", () => {
  it("shrinks your row to your share and books the rest as Lent on the same account", async () => {
    const [r, a, n] = [
      await addPerson("Rahul Sharma"),
      await addPerson("Amit"),
      await addPerson("Neha"),
    ];
    const res = await call(splits.POST, "POST", "/api/splits", {
      expenseId: "dinner",
      paidBy: "me",
      method: "equal",
      shares: [{ person: "me" }, { person: r }, { person: a }, { person: n }],
    });
    expect(res.status).toBe(200);
    const mine = expenses().find((e) => e.id === "dinner")!;
    const lent = expenses().find((e) => e.category === "Lent")!;
    expect(mine.amount).toBe(750);
    expect(lent).toMatchObject({
      amount: 2250,
      account_id: "acc-hdfc",
      expense_date: "2026-11-08",
    });
    // The account still sees ₹3,000 out.
    expect(Number(mine.amount) + Number(lent.amount)).toBe(3000);

    const s = await summary();
    expect(s.owedToMe).toBe(225000);
    expect(s.iOwe).toBe(0);
    for (const id of [r, a, n]) expect(await balanceOf(id)).toBe(75000);

    // The daily budget counts only your share.
    const scoped = scopeExpenses(expenses() as any, []);
    expect(
      scoped
        .filter((e) => e.expense_date === "2026-11-08")
        .reduce((t, e) => t + e.dailyAmount, 0),
    ).toBe(750 + 400);
  });

  it("refuses to split the same payment twice, or a split row", async () => {
    const r = await addPerson("Rahul");
    const body = {
      expenseId: "dinner",
      paidBy: "me",
      method: "equal",
      shares: [{ person: "me" }, { person: r }],
    };
    expect((await call(splits.POST, "POST", "/api/splits", body)).status).toBe(
      200,
    );
    const again = await call(splits.POST, "POST", "/api/splits", body);
    expect(again.status).toBe(400);
    const lentId = expenses().find((e) => e.category === "Lent")!.id;
    expect(
      (
        await call(splits.POST, "POST", "/api/splits", {
          ...body,
          expenseId: lentId,
        })
      ).status,
    ).toBe(400);
  });

  it("paying for others entirely turns the whole row into Lent, and undoing restores it", async () => {
    const r = await addPerson("Rahul");
    const res = await call(splits.POST, "POST", "/api/splits", {
      expenseId: "lunch",
      paidBy: "me",
      method: "equal",
      shares: [{ person: r }],
    });
    expect(res.status).toBe(200);
    expect(expenses().find((e) => e.id === "lunch")).toMatchObject({
      category: "Lent",
      amount: 400,
    });
    expect(await balanceOf(r)).toBe(40000);
    await call(splits.DELETE, "DELETE", `/api/splits?id=${res.body.split.id}`);
    expect(expenses().find((e) => e.id === "lunch")).toMatchObject({
      category: "Food",
      amount: 400,
      split_id: null,
    });
  });

  it("deleting the split merges the money back exactly", async () => {
    const r = await addPerson("Rahul");
    const res = await call(splits.POST, "POST", "/api/splits", {
      expenseId: "dinner",
      paidBy: "me",
      method: "shares",
      shares: [
        { person: "me", value: 2 },
        { person: r, value: 1 },
      ],
    });
    expect(expenses().find((e) => e.id === "dinner")!.amount).toBe(2000);
    await call(splits.DELETE, "DELETE", `/api/splits?id=${res.body.split.id}`);
    expect(expenses().find((e) => e.id === "dinner")).toMatchObject({
      amount: 3000,
      split_id: null,
    });
    expect(expenses().some((e) => e.category === "Lent")).toBe(false);
    expect(db.t.splits).toHaveLength(0);
    expect(db.t.split_members).toHaveLength(0);
  });

  it("deleting the expense removes the split and both rows", async () => {
    const r = await addPerson("Rahul");
    await call(splits.POST, "POST", "/api/splits", {
      expenseId: "dinner",
      paidBy: "me",
      method: "equal",
      shares: [{ person: "me" }, { person: r }],
    });
    const lentId = expenses().find((e) => e.category === "Lent")!.id;
    const del = await call(
      expenseRoute.DELETE,
      "DELETE",
      `/api/expense?id=${lentId}`,
    );
    expect(del.status).toBe(200);
    expect(expenses().map((e) => e.id)).toEqual(["lunch"]);
    expect(db.t.splits).toHaveLength(0);
    expect(await balanceOf(r)).toBe(0);
  });

  it("won't let a split row's amount be edited on its own", async () => {
    const r = await addPerson("Rahul");
    await call(splits.POST, "POST", "/api/splits", {
      expenseId: "dinner",
      paidBy: "me",
      method: "equal",
      shares: [{ person: "me" }, { person: r }],
    });
    const res = await call(expenseRoute.PATCH, "PATCH", "/api/expense", {
      id: "dinner",
      amount: 999,
    });
    expect(res.status).toBe(409);
    expect(expenses().find((e) => e.id === "dinner")!.amount).toBe(1500);
  });

  it("puts everything back when a later step fails", async () => {
    const r = await addPerson("Rahul");
    db.failInsert = "split_members";
    const res = await call(splits.POST, "POST", "/api/splits", {
      expenseId: "dinner",
      paidBy: "me",
      method: "equal",
      shares: [{ person: "me" }, { person: r }],
    });
    expect(res.status).toBe(500);
    expect(expenses().find((e) => e.id === "dinner")).toMatchObject({
      amount: 3000,
      split_id: null,
    });
    expect(expenses().some((e) => e.category === "Lent")).toBe(false);
    expect(db.t.splits).toHaveLength(0);
  });
});

describe("a friend paid", () => {
  it("logs only your share, with no account, and you owe them", async () => {
    const a = await addPerson("Amit");
    const res = await call(splits.POST, "POST", "/api/splits", {
      amount: 600,
      category: "Transport",
      merchant: "Uber",
      date: "2026-11-09",
      paidBy: a,
      method: "equal",
      shares: [{ person: a }, { person: "me" }],
    });
    expect(res.status).toBe(200);
    const share = expenses().find((e) => e.merchant === "Uber")!;
    expect(share).toMatchObject({
      amount: 300,
      account_id: null,
      source: "split_owed",
      category: "Transport",
    });
    expect(await balanceOf(a)).toBe(-30000);
    expect((await summary()).iOwe).toBe(30000);
  });

  it("refuses a captured payment marked as paid by a friend", async () => {
    const a = await addPerson("Amit");
    const res = await call(splits.POST, "POST", "/api/splits", {
      expenseId: "dinner",
      paidBy: a,
      method: "equal",
      shares: [{ person: a }, { person: "me" }],
    });
    expect(res.status).toBe(400);
  });
});

describe("typed-in splits and the bank alert that follows", () => {
  it("recognises the bank debit for the whole bill as the same money", async () => {
    const n = await addPerson("Neha");
    await call(splits.POST, "POST", "/api/splits", {
      amount: 1200,
      category: "Food",
      date: "2026-11-09",
      paidBy: "me",
      method: "equal",
      shares: [{ person: "me" }, { person: n }],
    });
    const sb = (await import("@/lib/supabase-server")).createServiceClient();
    expect(await splitTwin(sb, ME_ID, 1200, "2026-11-09")).toBe(true);
    expect(await splitTwin(sb, ME_ID, 600, "2026-11-10")).toBe(false);
    expect(await splitTwin(sb, ME_ID, 1300, "2026-11-09")).toBe(false);
  });

  it("also fixes old family splits (one row per member)", async () => {
    db.t.expenses.push(
      {
        id: "f1",
        user_id: ME_ID,
        amount: 500,
        category: "Food",
        expense_date: "2026-11-07",
        source: "app",
        split_id: "old",
        paid_by: ME_ID,
      },
      {
        id: "f2",
        user_id: OTHER,
        amount: 500,
        category: "Food",
        expense_date: "2026-11-07",
        source: "app",
        split_id: "old",
        paid_by: ME_ID,
      },
    );
    const sb = (await import("@/lib/supabase-server")).createServiceClient();
    expect(await splitTwin(sb, ME_ID, 1000, "2026-11-07")).toBe(true);
    // The other member didn't pay, so the ₹1,000 isn't their twin.
    expect(await splitTwin(sb, OTHER, 1000, "2026-11-07")).toBe(false);
  });

  it("doesn't treat a captured split as a twin of a second identical payment", async () => {
    const r = await addPerson("Rahul");
    await call(splits.POST, "POST", "/api/splits", {
      expenseId: "dinner",
      paidBy: "me",
      method: "equal",
      shares: [{ person: "me" }, { person: r }],
    });
    const sb = (await import("@/lib/supabase-server")).createServiceClient();
    expect(await splitTwin(sb, ME_ID, 3000, "2026-11-08")).toBe(false);
  });
});

describe("settling up", () => {
  const dinnerFor4 = async () => {
    const ids = [
      await addPerson("Rahul Sharma"),
      await addPerson("Amit"),
      await addPerson("Neha"),
    ];
    await call(splits.POST, "POST", "/api/splits", {
      expenseId: "dinner",
      paidBy: "me",
      method: "equal",
      shares: [{ person: "me" }, ...ids.map((person) => ({ person }))],
    });
    return ids;
  };

  it("spots a repayment credit, records it, learns the bank name, and keeps it out of earnings", async () => {
    const [r] = await dinnerFor4();
    db.t.incomes.push({
      id: "c1",
      user_id: ME_ID,
      amount: 750,
      source: "RAHUL K SHARMA",
      income_date: "2026-11-09",
      account_id: "acc-hdfc",
      split_id: null,
      repayment_checked: false,
    });
    const s = await summary();
    expect(s.repayments).toEqual([
      expect.objectContaining({ incomeId: "c1", personId: r, amount: 75000 }),
    ]);

    const res = await call(settle.POST, "POST", "/api/splits/settle", {
      personId: r,
      direction: "they_paid",
      incomeId: "c1",
    });
    expect(res.status).toBe(200);
    expect(await balanceOf(r)).toBe(0);
    expect((await summary()).repayments).toEqual([]);
    expect(db.t.people.find((p) => p.id === r)!.bank_names).toEqual([
      "RAHUL K SHARMA",
    ]);
    const sb = (await import("@/lib/supabase-server")).createServiceClient();
    expect(await getIncomes(sb, ME_ID, "2026-11-01")).toEqual([]);
    // The credit is still a real row, so the account balance keeps it.
    expect(db.t.incomes).toHaveLength(1);

    // Undoing the payment makes it income again.
    await call(
      splits.DELETE,
      "DELETE",
      `/api/splits?id=${res.body.payment.id}`,
    );
    expect(await balanceOf(r)).toBe(75000);
    expect(
      (await getIncomes(sb, ME_ID, "2026-11-01")).map((i) => i.id),
    ).toEqual(["c1"]);
  });

  it("stops asking once you say it isn't a repayment", async () => {
    const [, , n] = await dinnerFor4();
    db.t.incomes.push({
      id: "c2",
      user_id: ME_ID,
      amount: 750,
      source: "NEHA GUPTA",
      income_date: "2026-11-09",
      split_id: null,
      repayment_checked: false,
    });
    expect((await summary()).repayments.map((x: any) => x.personId)).toEqual([
      n,
    ]);
    await call(settle.POST, "POST", "/api/splits/settle", {
      dismissIncomeId: "c2",
    });
    expect((await summary()).repayments).toEqual([]);
  });

  it("records cash and partial payments, and an overpayment flips the balance", async () => {
    const [r] = await dinnerFor4();
    await call(settle.POST, "POST", "/api/splits/settle", {
      personId: r,
      direction: "they_paid",
      amount: 500,
    });
    expect(await balanceOf(r)).toBe(25000);
    await call(settle.POST, "POST", "/api/splits/settle", {
      personId: r,
      direction: "they_paid",
      amount: 300,
    });
    expect(await balanceOf(r)).toBe(-5000); // you owe Rahul ₹50 back
  });

  it("paying a friend back from your account isn't spending", async () => {
    const a = await addPerson("Amit");
    await call(splits.POST, "POST", "/api/splits", {
      amount: 600,
      category: "Transport",
      date: "2026-11-09",
      paidBy: a,
      method: "equal",
      shares: [{ person: a }, { person: "me" }],
    });
    db.t.expenses.push({
      id: "upi-amit",
      user_id: ME_ID,
      amount: 300,
      category: "Transfers",
      merchant: "AMIT",
      expense_date: "2026-11-10",
      account_id: "acc-hdfc",
      source: "auto_sms",
    });
    const res = await call(settle.POST, "POST", "/api/splits/settle", {
      personId: a,
      direction: "i_paid",
      expenseId: "upi-amit",
    });
    expect(res.status).toBe(200);
    expect(expenses().find((e) => e.id === "upi-amit")!.category).toBe(
      "Settle up",
    );
    expect(await balanceOf(a)).toBe(0);
    expect(
      scopeExpenses(expenses() as any, []).find((e) => e.id === "upi-amit")!
        .dailyAmount,
    ).toBe(0);
    await call(
      splits.DELETE,
      "DELETE",
      `/api/splits?id=${res.body.payment.id}`,
    );
    expect(expenses().find((e) => e.id === "upi-amit")!.category).toBe(
      "Transfers",
    );
  });
});

describe("people and your UPI ID", () => {
  it("won't remove someone who still owes you", async () => {
    const r = await addPerson("Rahul");
    await call(splits.POST, "POST", "/api/splits", {
      expenseId: "lunch",
      paidBy: "me",
      method: "equal",
      shares: [{ person: "me" }, { person: r }],
    });
    expect(
      (await call(peopleRoute.DELETE, "DELETE", `/api/people?id=${r}`)).status,
    ).toBe(400);
    await call(settle.POST, "POST", "/api/splits/settle", {
      personId: r,
      direction: "they_paid",
      amount: 200,
    });
    expect(
      (await call(peopleRoute.DELETE, "DELETE", `/api/people?id=${r}`)).status,
    ).toBe(200);
  });

  it("reuses a name instead of adding a second Rahul, and checks UPI IDs", async () => {
    expect(await addPerson("Rahul")).toBe(await addPerson("rahul"));
    expect(
      (
        await call(peopleRoute.POST, "POST", "/api/people", {
          name: "Amit",
          upi_id: "not-a-vpa",
        })
      ).status,
    ).toBe(400);
    expect(
      (await call(splits.PATCH, "PATCH", "/api/splits", { upi_id: "me@oksbi" }))
        .status,
    ).toBe(200);
    expect((await summary()).myUpiId).toBe("me@oksbi");
    expect(
      (
        await call(splits.PATCH, "PATCH", "/api/splits", {
          upi_id: "9876543210",
        })
      ).status,
    ).toBe(400);
  });

  it("keeps each user's people and expenses to themselves", async () => {
    const theirs = await addPerson("Priya", {}, OTHER);
    const res = await call(splits.POST, "POST", "/api/splits", {
      expenseId: "dinner",
      paidBy: "me",
      method: "equal",
      shares: [{ person: "me" }, { person: theirs }],
    });
    expect(res.status).toBe(400);
    const notMine = await call(
      splits.POST,
      "POST",
      "/api/splits",
      {
        expenseId: "dinner",
        paidBy: "me",
        method: "equal",
        shares: [{ person: "me" }, { person: theirs }],
      },
      OTHER,
    );
    expect(notMine.status).toBe(400); // user 2 can't split user 1's expense
    expect(expenses().find((e) => e.id === "dinner")!.amount).toBe(3000);
  });
});

describe("bad input and old databases", () => {
  it("explains exact amounts that don't add up", async () => {
    const r = await addPerson("Rahul");
    const res = await call(splits.POST, "POST", "/api/splits", {
      expenseId: "dinner",
      paidBy: "me",
      method: "exact",
      shares: [
        { person: "me", value: 1000 },
        { person: r, value: 1500 },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/add up/);
    expect(expenses().find((e) => e.id === "dinner")!.amount).toBe(3000);
  });

  it("needs someone else in the split", async () => {
    const res = await call(splits.POST, "POST", "/api/splits", {
      expenseId: "dinner",
      paidBy: "me",
      method: "equal",
      shares: [{ person: "me" }],
    });
    expect(res.status).toBe(400);
  });

  it("says a database update is needed before v24 is applied", async () => {
    db.missing.add("people");
    expect((await call(splits.GET, "GET", "/api/splits")).status).toBe(503);
  });

  it("rejects requests without a session", async () => {
    const res = await splits.GET(new NextRequest("http://x/api/splits"));
    expect(res.status).toBe(401);
  });
});

describe("paying from the Pay button (v25)", () => {
  const { linkUpiSettlement } = await_import();
  const owe = async (name: string, amount: number) => {
    const id = await addPerson(name);
    await call(splits.POST, "POST", "/api/splits", {
      amount: amount * 2,
      category: "Transport",
      date: "2026-11-09",
      paidBy: id,
      method: "equal",
      shares: [{ person: id }, { person: "me" }],
    });
    return id;
  };
  const debit = (
    id: string,
    amount: number,
    merchant: string,
    date = "2026-11-10",
  ) => {
    const row = {
      id,
      user_id: ME_ID,
      amount,
      category: "Transfers",
      merchant,
      expense_date: date,
      account_id: "acc-hdfc",
      source: "auto_sms",
      split_id: null,
      paid_by: null,
    };
    db.t.expenses.push(row);
    return row;
  };
  const sb = async () =>
    (await import("@/lib/supabase-server")).createServiceClient();

  it("links the bank alert that arrives after the payment, so it isn't spending", async () => {
    const a = await owe("Amit Verma", 300);
    const pay = await call(settle.POST, "POST", "/api/splits/settle", {
      personId: a,
      direction: "i_paid",
      amount: 300,
      date: "2026-11-10",
      via: "upi",
    });
    expect(pay.status).toBe(200);
    expect(await balanceOf(a)).toBe(0);
    const row = debit("alert-1", 300, "AMIT VERMA");
    expect(await (await linkUpiSettlement)(await sb(), ME_ID, row)).toBe(true);
    expect(expenses().find((e) => e.id === "alert-1")!.category).toBe(
      "Settle up",
    );
    expect(
      db.t.splits.find((x) => x.id === pay.body.payment.id)!.expense_id,
    ).toBe("alert-1");
    expect(
      scopeExpenses(expenses() as any, []).find((e) => e.id === "alert-1")!
        .dailyAmount,
    ).toBe(0);
    // Undoing the payment gives the debit its category back.
    const undo = await call(
      splits.DELETE,
      "DELETE",
      `/api/splits?id=${pay.body.payment.id}`,
    );
    expect(undo.status).toBe(200);
    expect(expenses().find((e) => e.id === "alert-1")!.category).toBe(
      "Transfers",
    );
  });

  it("links an alert that arrived before you confirmed the payment", async () => {
    const a = await owe("Amit Verma", 300);
    debit("alert-2", 300, "AMIT VERMA");
    const pay = await call(settle.POST, "POST", "/api/splits/settle", {
      personId: a,
      direction: "i_paid",
      amount: 300,
      date: "2026-11-10",
      via: "upi",
    });
    expect(pay.status).toBe(200);
    expect(expenses().find((e) => e.id === "alert-2")!.category).toBe(
      "Settle up",
    );
  });

  it("never links a cash settle-up to an unrelated debit", async () => {
    const a = await owe("Amit", 300);
    await call(settle.POST, "POST", "/api/splits/settle", {
      personId: a,
      direction: "i_paid",
      amount: 300,
      date: "2026-11-10",
      via: "cash",
    });
    const row = debit("coffee", 300, "STARBUCKS");
    expect(await (await linkUpiSettlement)(await sb(), ME_ID, row)).toBe(false);
    expect(expenses().find((e) => e.id === "coffee")!.category).toBe(
      "Transfers",
    );
  });

  it("ignores debits of a different amount or days later", async () => {
    const a = await owe("Amit", 300);
    await call(settle.POST, "POST", "/api/splits/settle", {
      personId: a,
      direction: "i_paid",
      amount: 300,
      date: "2026-11-10",
      via: "upi",
    });
    expect(
      await (
        await linkUpiSettlement
      )(await sb(), ME_ID, debit("x1", 299, "AMIT")),
    ).toBe(false);
    expect(
      await (
        await linkUpiSettlement
      )(await sb(), ME_ID, debit("x2", 300, "AMIT", "2026-11-14")),
    ).toBe(false);
  });

  it("with two same-amount payments pending, lets the payee name decide — or waits", async () => {
    const a = await owe("Amit Verma", 300);
    const n = await owe("Neha Gupta", 300);
    await call(settle.POST, "POST", "/api/splits/settle", {
      personId: a,
      direction: "i_paid",
      amount: 300,
      date: "2026-11-10",
      via: "upi",
    });
    await call(settle.POST, "POST", "/api/splits/settle", {
      personId: n,
      direction: "i_paid",
      amount: 300,
      date: "2026-11-10",
      via: "upi",
    });
    expect(
      await (
        await linkUpiSettlement
      )(await sb(), ME_ID, debit("y1", 300, "NEHA GUPTA")),
    ).toBe(true);
    const linkedTo = db.t.splits.find((x) => x.expense_id === "y1")!;
    expect(
      db.t.split_members.find((m) => m.split_id === linkedTo.id && m.person_id)!
        .person_id,
    ).toBe(n);
    expect(
      await (
        await linkUpiSettlement
      )(await sb(), ME_ID, debit("y2", 300, "UNKNOWN PAYEE")),
    ).toBe(true); // only Amit's is left
    const two = await owe("Raj", 500);
    const three = await owe("Ravi", 500);
    await call(settle.POST, "POST", "/api/splits/settle", {
      personId: two,
      direction: "i_paid",
      amount: 500,
      date: "2026-11-10",
      via: "upi",
    });
    await call(settle.POST, "POST", "/api/splits/settle", {
      personId: three,
      direction: "i_paid",
      amount: 500,
      date: "2026-11-10",
      via: "upi",
    });
    expect(
      await (
        await linkUpiSettlement
      )(await sb(), ME_ID, debit("y3", 500, "SOMEONE")),
    ).toBe(false);
  });
});

function await_import() {
  return {
    linkUpiSettlement: import("@/lib/splits").then((m) => m.linkUpiSettlement),
  };
}
