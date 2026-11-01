import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NextRequest } from "next/server";

/**
 * /api/cards end to end, through the real route, service, engine, detection
 * and catalogue, on an in-memory database that enforces the v20 rules
 * (last4 format, score bands, one row per user + bank + last4, per-user
 * isolation). Only Postgres itself is faked.
 */

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

const db: { tables: Tables; missing: Set<string> } = {
  tables: {},
  missing: new Set(),
};
let nextId = 1;

class PgError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

function check(table: string, row: Row) {
  if (table === "user_cards") {
    if (row.last4 != null && !/^\d{4}$/.test(String(row.last4)))
      throw new PgError(
        'new row violates check constraint "user_cards_last4_check"',
        "23514",
      );
    if (row.added_by && !["detected", "manual"].includes(String(row.added_by)))
      throw new PgError("added_by check", "23514");
    const clash = db.tables.user_cards.find(
      (r) =>
        r !== row &&
        r.last4 != null &&
        r.user_id === row.user_id &&
        r.bank === row.bank &&
        r.last4 === row.last4,
    );
    if (clash)
      throw new PgError(
        'duplicate key value violates unique constraint "user_cards_bank_last4_key"',
        "23505",
      );
  }
  if (
    table === "card_profiles" &&
    row.score_band != null &&
    !["750+", "700-749", "650-699", "below-650", "unknown"].includes(
      String(row.score_band),
    )
  )
    throw new PgError("score_band check", "23514");
}

function withDefaults(table: string, row: Row): Row {
  if (table === "user_cards")
    return {
      id: `uc-${nextId++}`,
      last4: null,
      product_key: null,
      added_by: "detected",
      hidden: false,
      ...row,
    };
  if (table === "card_profiles")
    return {
      score_band: "unknown",
      monthly_income: null,
      stress_cleared_at: null,
      spend_tips: true, // v21
      ...row,
    };
  return row;
}

/** Just the PostgREST builder surface the Cards service uses. */
function from(table: string) {
  const filters: Array<(r: Row) => boolean> = [];
  let op: {
    kind: "select" | "insert" | "upsert" | "update" | "delete";
    payload?: Row;
    onConflict?: string;
  } = { kind: "select" };
  let order: { col: string; asc: boolean } | null = null;
  let single = false;

  const run = async (): Promise<{ data: unknown; error: PgError | null }> => {
    if (db.missing.has(table))
      return {
        data: null,
        error: new PgError(
          `relation "public.${table}" does not exist`,
          "42P01",
        ),
      };
    const rows = (db.tables[table] ??= []);
    try {
      switch (op.kind) {
        case "select": {
          let out = rows.filter((r) => filters.every((f) => f(r)));
          if (order) {
            const { col, asc } = order;
            out = [...out].sort(
              (a, b) =>
                (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1),
            );
          }
          if (single) return { data: out[0] ?? null, error: null };
          return { data: out.map((r) => ({ ...r })), error: null };
        }
        case "insert": {
          const row = withDefaults(table, op.payload!);
          rows.push(row);
          try {
            check(table, row);
          } catch (e) {
            rows.pop();
            throw e;
          }
          return { data: null, error: null };
        }
        case "upsert": {
          const keys = op.onConflict!.split(",");
          const hit = rows.find((r) =>
            keys.every((k) => r[k] != null && r[k] === op.payload![k]),
          );
          if (hit) {
            const before = { ...hit };
            Object.assign(hit, op.payload);
            try {
              check(table, hit);
            } catch (e) {
              Object.assign(hit, before);
              throw e;
            }
          } else {
            const row = withDefaults(table, op.payload!);
            rows.push(row);
            try {
              check(table, row);
            } catch (e) {
              rows.pop();
              throw e;
            }
          }
          return { data: null, error: null };
        }
        case "update": {
          for (const r of rows.filter((r) => filters.every((f) => f(r)))) {
            Object.assign(r, op.payload);
            check(table, r);
          }
          return { data: null, error: null };
        }
        case "delete": {
          db.tables[table] = rows.filter((r) => !filters.every((f) => f(r)));
          return { data: null, error: null };
        }
      }
    } catch (e) {
      return { data: null, error: e as PgError };
    }
  };

  const b = {
    select: () => b,
    eq: (col: string, v: unknown) => (filters.push((r) => r[col] === v), b),
    gte: (col: string, v: string) => (
      filters.push((r) => String(r[col]) >= v),
      b
    ),
    in: (col: string, list: unknown[]) => (
      filters.push((r) => list.includes(r[col])),
      b
    ),
    is: (col: string, v: null) => (
      filters.push((r) => (r[col] ?? null) === v),
      b
    ),
    order: (col: string, o?: { ascending?: boolean }) => (
      (order = { col, asc: o?.ascending !== false }),
      b
    ),
    maybeSingle: () => ((single = true), b),
    insert: (payload: Row) => ((op = { kind: "insert", payload }), b),
    upsert: (payload: Row, o: { onConflict: string }) => (
      (op = { kind: "upsert", payload, onConflict: o.onConflict }),
      b
    ),
    update: (payload: Row) => ((op = { kind: "update", payload }), b),
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

const { GET, POST } = await import("./route");
const { spendTips } = await import("@/lib/cards/service");

// ── fixtures: two users, real-looking messages ──────────────────────────────

const TODAY = "2026-11-01";
const day = (n: number) =>
  new Date(Date.parse(`${TODAY}T00:00:00Z`) - n * 86_400_000)
    .toISOString()
    .slice(0, 10);

function seed() {
  nextId = 1;
  db.missing.clear();
  const expenses: Row[] = [];
  const messages: Row[] = [];
  let i = 0;
  const spend = (
    user: number,
    amount: number,
    merchant: string,
    category: string,
    ago: number,
    body?: string,
  ) => {
    const id = `e${++i}`;
    expenses.push({
      id,
      user_id: user,
      amount,
      merchant,
      category,
      expense_date: day(ago),
      split_id: null,
    });
    if (body)
      messages.push({
        id: `m${i}`,
        user_id: user,
        body,
        received_at: `${day(ago)}T10:00:00Z`,
        expense_id: id,
        direction: "debit",
        amount,
        channel: "card",
      });
  };
  // User 1: an SBI card in the alerts, mostly Zepto / Swiggy / Amazon.
  for (let w = 0; w < 12; w++) {
    spend(
      1,
      450,
      "Zepto",
      "Groceries",
      5 + w * 7,
      `Rs.450.00 spent on your SBI Credit Card ending 0543 at ZEPTO on ${day(5 + w * 7)}.`,
    );
    spend(
      1,
      380,
      "Swiggy",
      "Food delivery",
      6 + w * 7,
      `Rs.380.00 spent on your SBI Credit Card ending 0543 at SWIGGY on ${day(6 + w * 7)}.`,
    );
    spend(
      1,
      900,
      "Amazon",
      "Shopping",
      7 + w * 7,
      `Rs.900.00 spent on your SBI Credit Card ending 0543 at AMAZON on ${day(7 + w * 7)}.`,
    );
  }
  spend(
    1,
    2000,
    "Petrol",
    "Transport",
    20,
    "Rs.2000.00 spent on your SBI Credit Card ending 0543 at HP PETROL on 12/10/26.",
  );
  // A second card seen once, and a debit card that must never be suggested.
  spend(
    1,
    640,
    "Myntra",
    "Shopping",
    9,
    "INR 640.00 spent on ICICI Bank Credit Card XX7788 at MYNTRA.",
  );
  spend(
    1,
    300,
    "Cafe",
    "Dining out",
    3,
    "Rs.300 spent on your HDFC Bank Debit Card ending 1234 at CAFE.",
  );
  // User 2: someone else entirely.
  spend(
    2,
    5000,
    "Flipkart",
    "Shopping",
    4,
    "Rs.5000.00 spent on your Axis Bank Credit Card ending 9999 at FLIPKART.",
  );

  db.tables = {
    user_cards: [],
    card_profiles: [],
    expenses,
    bank_messages: messages,
    incomes: [
      {
        user_id: 1,
        amount: 85000,
        source: "Salary ACME",
        income_date: day(30),
      },
      {
        user_id: 1,
        amount: 85000,
        source: "Salary ACME",
        income_date: day(60),
      },
    ],
  };
}

function req(user: number | null, body?: unknown, raw?: string) {
  return new NextRequest("http://localhost/api/cards", {
    method: body === undefined && raw === undefined ? "GET" : "POST",
    headers: {
      ...(user ? { authorization: `Bearer user-${user}` } : {}),
      "content-type": "application/json",
    },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
}

async function get(user = 1) {
  const r = await GET(req(user));
  return { status: r.status, body: await r.json() };
}
async function post(body: unknown, user = 1) {
  const r = await POST(req(user, body));
  return { status: r.status, body: await r.json() };
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T06:30:00Z`));
});
afterAll(() => vi.useRealTimers());
beforeEach(seed);

// ── the flows ───────────────────────────────────────────────────────────────

describe("/api/cards: who can see what", () => {
  it("401 without a session", async () => {
    expect((await GET(req(null))).status).toBe(401);
    expect((await POST(req(null, { action: "forget" }))).status).toBe(401);
  });
  it("only the signed-in user's cards, spends and messages", async () => {
    const r = await get(2);
    expect(
      r.body.suggestions.map(
        (s: { bank: string; last4: string }) => `${s.bank}|${s.last4}`,
      ),
    ).toEqual(["Axis|9999"]);
    expect(JSON.stringify(r.body)).not.toContain("0543");
  });
  it("one user can't change another user's card", async () => {
    await post({
      action: "confirm",
      bank: "SBI",
      last4: "0543",
      product_key: "sbi-simplyclick",
    });
    const id = (await get()).body.cards[0].id;
    expect((await post({ action: "remove", id }, 2)).status).toBe(200);
    expect(
      (
        await post(
          { action: "set_product", id, product_key: "sbi-cashback" },
          2,
        )
      ).status,
    ).toBe(200);
    const mine = (await get()).body.cards;
    expect(mine).toHaveLength(1);
    expect(mine[0].product.key).toBe("sbi-simplyclick");
  });
});

describe("/api/cards: before the v20 tables exist", () => {
  it("still loads, with detection only", async () => {
    db.missing.add("user_cards");
    db.missing.add("card_profiles");
    const r = await get();
    expect(r.status).toBe(200);
    expect(r.body.cards).toEqual([]);
    expect(r.body.suggestions.map((s: { last4: string }) => s.last4)).toEqual([
      "0543",
      "7788",
    ]);
  });
});

describe("/api/cards: setting up cards", () => {
  it("finds the credit cards in the alerts, never the debit card", async () => {
    const r = await get();
    expect(r.status).toBe(200);
    const sugg = r.body.suggestions as Array<{
      bank: string;
      last4: string;
      spends: number;
    }>;
    expect(sugg.map((s) => `${s.bank}|${s.last4}`)).toEqual([
      "SBI|0543",
      "ICICI|7788",
    ]);
    expect(sugg[0].spends).toBe(37);
    expect(JSON.stringify(sugg)).not.toContain("1234");
    expect(r.body.catalog.length).toBe(52);
  });

  it("confirm → the card is held, valued, tracked, and no longer suggested", async () => {
    const r = await post({
      action: "confirm",
      bank: "SBI",
      last4: "0543",
      product_key: "sbi-simplyclick",
    });
    expect(r.status).toBe(200);
    const [card] = r.body.cards;
    expect(card).toMatchObject({
      bank: "SBI",
      last4: "0543",
      product: { key: "sbi-simplyclick" },
    });
    expect(card.spendInWindow).toBeGreaterThan(20000);
    expect(card.earned).toBeGreaterThan(0);
    expect(card.health.yearlyPace).toBeGreaterThan(0);
    expect(card.health.feeWaiver).toMatchObject({
      target: expect.any(Number),
      onTrack: expect.any(Boolean),
    });
    expect(r.body.suggestions.map((s: { last4: string }) => s.last4)).toEqual([
      "7788",
    ]);
    expect(r.body.missed.cardSpend).toBeGreaterThan(20000);
  });

  it("confirming twice keeps one row (upsert on user + bank + last4)", async () => {
    await post({
      action: "confirm",
      bank: "SBI",
      last4: "0543",
      product_key: null,
    });
    await post({
      action: "confirm",
      bank: "SBI",
      last4: "0543",
      product_key: "sbi-cashback",
    });
    const r = await get();
    expect(r.body.cards).toHaveLength(1);
    expect(r.body.cards[0].product.key).toBe("sbi-cashback");
    expect(db.tables.user_cards).toHaveLength(1);
  });

  it("\"I'm not sure\" holds the card with no product; numbers say they're rough", async () => {
    const r = await post({
      action: "confirm",
      bank: "SBI",
      last4: "0543",
      product_key: null,
    });
    expect(r.body.cards[0].product).toBeNull();
    expect(r.body.cards[0].health).toBeNull();
    expect(r.body.missed.unknownCardSpend).toBeGreaterThan(20000);
  });

  it('"not mine" hides it and it is never suggested again', async () => {
    const r = await post({ action: "dismiss", bank: "ICICI", last4: "7788" });
    expect(r.body.suggestions.map((s: { last4: string }) => s.last4)).toEqual([
      "0543",
    ]);
    expect(r.body.cards).toEqual([]);
  });

  it("bad input is a 400 with a reason, and nothing is written", async () => {
    for (const bad of [
      { action: "confirm", bank: "SBI", last4: "05x3", product_key: null },
      {
        action: "confirm",
        bank: "SBI",
        last4: "0543",
        product_key: "no-such-card",
      },
      { action: "add", bank: "HSBC", product_key: "" },
      { action: "confirm", bank: "", last4: "0543", product_key: null },
      { action: "profile", score_band: "800+" },
      { action: "profile", monthly_income: -5 },
      { action: "set_product" },
      { action: "launch-rockets" },
      {},
    ]) {
      const r = await post(bad);
      expect(r.status, JSON.stringify(bad)).toBe(400);
      expect(typeof r.body.error).toBe("string");
    }
    expect((await POST(req(1, undefined, "{not json"))).status).toBe(400);
    expect(db.tables.user_cards).toEqual([]);
    expect(db.tables.card_profiles).toEqual([]);
  });
});

describe("/api/cards: the three features on real-looking spending", () => {
  beforeEach(async () => {
    await post({
      action: "confirm",
      bank: "SBI",
      last4: "0543",
      product_key: "sbi-simplyclick",
    });
  });

  it("2. next cards: at most three, each adds at least ₹500 a year, ranked by gain, honest chances", async () => {
    const { next } = (await get()).body as {
      next: Array<{
        netYearly: number;
        product: { key: string; url: string | null };
        eligibility: { chance: string };
      }>;
    };
    expect(next.length).toBeGreaterThan(0);
    expect(next.length).toBeLessThanOrEqual(3);
    for (const n of next) {
      expect(n.netYearly).toBeGreaterThanOrEqual(500);
      expect(["likely", "stretch", "unlikely"]).toContain(n.eligibility.chance);
      expect(n.product.key).not.toBe("sbi-simplyclick");
      if (n.product.url)
        expect(n.product.url).not.toMatch(
          /[?&](utm_|ref=|aff|click_id|gclid)/i,
        );
    }
    expect(JSON.stringify(next).toLowerCase()).not.toContain("pre-approved");
  });

  it("1. missed rewards: holding a better card shows where, with every card side by side", async () => {
    const r = await post({
      action: "add",
      bank: "HSBC",
      product_key: "hsbc-live-plus",
    });
    const m = r.body.missed;
    expect(r.body.cards).toHaveLength(2);
    expect(m.missed).toBeGreaterThan(0);
    expect(m.couldHaveEarned).toBe(m.earned + m.missed);
    const line = m.lines[0];
    expect(line.options).toHaveLength(2);
    expect(line.options[0].cardId).toBe(line.bestCard);
    expect(line.options[0].rate).toBeGreaterThanOrEqual(line.options[1].rate);
    expect(line.spends.length).toBeGreaterThan(0);
    expect(line.spends.length).toBeLessThanOrEqual(8);
    expect(r.body.useFor.length).toBeGreaterThan(0);
    // Petrol is excluded on these cards: never a "missed" line.
    expect(m.lines.map((l: { label: string }) => l.label)).not.toContain(
      "Petrol",
    );
  });

  it("income and score band change approval chances, never the ranking basis", async () => {
    const low = await post({
      action: "profile",
      score_band: "below-650",
      monthly_income: 15000,
    });
    expect(low.body.profile).toMatchObject({
      score_band: "below-650",
      monthly_income: 15000,
      estimatedIncome: 85000,
    });
    const lowChances = low.body.next.map(
      (n: { eligibility: { chance: string } }) => n.eligibility.chance,
    );
    expect(lowChances.every((c: string) => c !== "likely")).toBe(true);
    const high = await post({
      action: "profile",
      score_band: "750+",
      monthly_income: 150000,
    });
    expect(
      high.body.next.some(
        (n: { eligibility: { chance: string } }) =>
          n.eligibility.chance === "likely",
      ),
    ).toBe(true);
  });

  it("3. a late fee hides every new card; 'this is wrong' brings them back", async () => {
    db.tables.bank_messages.push({
      id: "late",
      user_id: 1,
      expense_id: null,
      direction: "debit",
      amount: 1300,
      channel: "card",
      received_at: `${day(2)}T09:00:00Z`,
      body: "Late payment fee of Rs.1300 has been levied on your SBI Credit Card ending 0543.",
    });
    const stressed = (await get()).body;
    expect(stressed.stress.map((x: { kind: string }) => x.kind)).toContain(
      "late_fee",
    );
    expect(stressed.next).toEqual([]);
    expect(stressed.missed.earned).toBeGreaterThan(0); // missed rewards still work

    const cleared = await post({ action: "clear_stress" });
    expect(cleared.body.stress).toEqual([]);
    expect(cleared.body.next.length).toBeGreaterThan(0);
  });

  it("a reminder to avoid a late fee is not stress", async () => {
    db.tables.bank_messages.push({
      id: "rem",
      user_id: 1,
      expense_id: null,
      direction: null,
      amount: null,
      channel: null,
      received_at: `${day(1)}T09:00:00Z`,
      body: "Pay your SBI Card bill by 05 Nov to avoid late payment charges.",
    });
    expect((await get()).body.stress).toEqual([]);
  });

  it("change, hide and remove a card", async () => {
    const id = (await get()).body.cards[0].id;
    let r = await post({
      action: "set_product",
      id,
      product_key: "sbi-cashback",
    });
    expect(r.body.cards[0].product.key).toBe("sbi-cashback");
    r = await post({ action: "hide", id });
    expect(r.body.cards).toEqual([]);
    // Hidden, not re-suggested.
    expect(r.body.suggestions.map((s: { last4: string }) => s.last4)).toEqual([
      "7788",
    ]);
    r = await post({ action: "remove", id });
    expect(db.tables.user_cards).toEqual([]);
    expect(r.body.suggestions.map((s: { last4: string }) => s.last4)).toEqual([
      "0543",
      "7788",
    ]);
  });

  it("forget my cards: cards and profile go, spends and messages stay", async () => {
    await post({
      action: "profile",
      score_band: "750+",
      monthly_income: 90000,
    });
    const before = {
      e: db.tables.expenses.length,
      m: db.tables.bank_messages.length,
    };
    const r = await post({ action: "forget" });
    expect(r.status).toBe(200);
    expect(r.body.cards).toEqual([]);
    expect(r.body.profile).toMatchObject({
      score_band: "unknown",
      monthly_income: null,
    });
    expect(db.tables.user_cards).toEqual([]);
    expect(db.tables.card_profiles).toEqual([]);
    expect(db.tables.expenses.length).toBe(before.e);
    expect(db.tables.bank_messages.length).toBe(before.m);
  });
});

describe("/api/cards: rule-change alerts on cards you hold", () => {
  it("a change that touches where you spend is flagged and listed first", async () => {
    // HDFC Swiggy (legacy): "Swiggy orders under ₹249 earn 1%" from 17 Apr 2026.
    vi.setSystemTime(new Date("2026-05-20T06:30:00Z"));
    try {
      seed();
      const r = await post({
        action: "add",
        bank: "HDFC",
        product_key: "hdfc-swiggy-legacy",
      });
      const alerts = r.body.alerts as Array<{
        change: string;
        affectsYou: boolean;
        upcoming: boolean;
      }>;
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].affectsYou).toBe(true);
      expect(alerts[0].change).toMatch(/swiggy/i);
      expect(r.body.cards[0].health.changes.length).toBeGreaterThan(0);
    } finally {
      vi.setSystemTime(new Date(`${TODAY}T06:30:00Z`));
    }
  });
  it("no alerts once a change is older than 90 days", async () => {
    const r = await post({
      action: "add",
      bank: "HDFC",
      product_key: "hdfc-swiggy-legacy",
    });
    expect(r.body.alerts).toEqual([]);
    expect(r.body.cards[0].health.changes.length).toBeGreaterThan(0);
  });
});

describe("spend alerts: 'next time here, use this card'", () => {
  const client = () => ({ from }) as never;
  async function twoCards() {
    await post({
      action: "confirm",
      bank: "SBI",
      last4: "0543",
      product_key: "sbi-simplyclick",
    });
    await post({ action: "add", bank: "HSBC", product_key: "hsbc-live-plus" });
  }
  it("a Zepto spend on the weaker card gets a tip naming the better one", async () => {
    await twoCards();
    const tips = await spendTips(client(), 1, ["e1"]);
    const tip = tips.get("e1");
    expect(tip).toMatch(/^Next time at Zepto, use HSBC Live\+/);
    expect(tip).toMatch(/% back/);
    expect(tip).toMatch(/About ₹\d+ more on this one\.$/);
  });
  it("nothing with only one named card", async () => {
    await post({
      action: "confirm",
      bank: "SBI",
      last4: "0543",
      product_key: "sbi-simplyclick",
    });
    expect((await spendTips(client(), 1, ["e1"])).size).toBe(0);
  });
  it("nothing on petrol, a debit card, or someone else's spend", async () => {
    await twoCards();
    const petrol = db.tables.expenses.find((e) => e.merchant === "Petrol")!.id;
    const debit = db.tables.expenses.find((e) => e.merchant === "Cafe")!.id;
    const other = db.tables.expenses.find((e) => e.user_id === 2)!.id;
    const tips = await spendTips(client(), 1, [
      petrol as string,
      debit as string,
      other as string,
    ]);
    expect(tips.size).toBe(0);
  });
  it("turned off in the profile: no tips; back on: tips again", async () => {
    await twoCards();
    const off = await post({ action: "profile", spend_tips: false });
    expect(off.body.profile.spend_tips).toBe(false);
    expect((await spendTips(client(), 1, ["e1"])).size).toBe(0);
    await post({ action: "profile", spend_tips: true });
    expect((await spendTips(client(), 1, ["e1"])).size).toBe(1);
    expect((await post({ action: "profile", spend_tips: "no" })).status).toBe(
      400,
    );
  });
  it("before the card tables exist: no tips, no error", async () => {
    db.missing.add("user_cards");
    db.missing.add("card_profiles");
    expect((await spendTips(client(), 1, ["e1"])).size).toBe(0);
  });
});
