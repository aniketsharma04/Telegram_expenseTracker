import { describe, expect, it } from "vitest";
import {
  eventMessage,
  findSubscriptions,
  knownService,
  merchantKey,
  monthlyTotal,
  planSubscriptions,
  shortId,
  subsListMessage,
  yearlySaved,
  type Subscription,
} from "./subscriptions";

const e = (
  expense_date: string,
  merchant: string,
  amount: number,
  category = "Entertainment",
) => ({
  expense_date,
  merchant,
  amount,
  category,
});

const stored = (over: Partial<Subscription>): Subscription => ({
  id: "6f1c2a90-0000-4000-8000-000000000001",
  user_id: 1,
  merchant_key: "netflix",
  merchant: "Netflix",
  category: "Entertainment",
  amount: 649,
  last_charged: "2026-10-05",
  next_date: "2026-11-04",
  status: "new",
  decided_at: null,
  cancelled_at: null,
  notified: "found",
  ...over,
});

describe("findSubscriptions", () => {
  it("finds a monthly repeat and a known service seen once", () => {
    const subs = findSubscriptions(
      [
        e("2026-08-05", "Netflix", 649),
        e("2026-09-05", "Netflix", 649),
        e("2026-10-05", "Netflix", 649),
        e("2026-10-12", "Spotify", 119),
      ],
      "2026-10-31",
    );
    expect(subs.map((s) => [s.merchant, s.amount, s.next_date])).toEqual([
      ["Netflix", 649, "2026-11-05"],
      ["Spotify", 119, "2026-11-11"],
    ]);
  });

  it("ignores rent, EMIs and bills that repeat, and old one-off charges", () => {
    const subs = findSubscriptions(
      [
        e("2026-09-01", "Landlord", 15000, "Utilities & bills"),
        e("2026-10-01", "Landlord", 15000, "Utilities & bills"),
        e("2026-09-03", "Bajaj Finance", 2400, "Loans & EMI"),
        e("2026-10-03", "Bajaj Finance", 2400, "Loans & EMI"),
        e("2026-06-01", "Spotify", 119),
      ],
      "2026-10-31",
    );
    expect(subs).toEqual([]);
  });

  it("counts a repeating gym charge but not a single Google Play purchase", () => {
    const subs = findSubscriptions(
      [
        e("2026-09-02", "Cult.fit", 1499, "Health"),
        e("2026-10-02", "Cult.fit", 1499, "Health"),
        e("2026-10-20", "Google Play", 299, "Entertainment"),
      ],
      "2026-10-31",
    );
    expect(subs.map((s) => s.merchant)).toEqual(["Cult.fit"]);
  });

  it("groups spellings of one service under one key", () => {
    expect(merchantKey("NETFLIX.COM")).toBe("netflix");
    expect(merchantKey("Disney+ Hotstar")).toBe("jiohotstar");
    expect(knownService("Times Prime")?.name).toBe("Times Prime");
    expect(knownService("Amazon Prime Video")?.name).toBe("Amazon Prime");
    expect(knownService("Amazon")).toBeNull();
  });
});

describe("planSubscriptions", () => {
  const found = {
    merchant_key: "netflix",
    merchant: "Netflix",
    category: "Entertainment",
    amount: 649,
    last_charged: "2026-10-05",
    next_date: "2026-11-04",
  };

  it("inserts a new one and says so once", () => {
    const plan = planSubscriptions([], [found], "2026-10-31");
    expect(plan.inserts).toHaveLength(1);
    expect(plan.events.map((x) => x.type)).toEqual(["found"]);
    // Next day, it's stored: nothing new to say.
    const again = planSubscriptions([stored({})], [found], "2026-11-01");
    expect(again.events).toEqual([]);
    expect(again.updates).toEqual([]);
  });

  it("warns two days before a planned cancel renews, once", () => {
    const sub = stored({ status: "cancel" });
    const plan = planSubscriptions([sub], [found], "2026-11-02");
    expect(plan.events.map((x) => x.type)).toEqual(["renews_soon"]);
    const warned = stored({ status: "cancel", notified: "warn:2026-11-04" });
    expect(planSubscriptions([warned], [found], "2026-11-02").events).toEqual(
      [],
    );
  });

  it("marks it cancelled when the renewal passes with no charge", () => {
    const sub = stored({ status: "cancel" });
    const plan = planSubscriptions([sub], [], "2026-11-11");
    expect(plan.events.map((x) => x.type)).toEqual(["cancelled"]);
    expect(plan.updates[0].patch.status).toBe("cancelled");
    expect(planSubscriptions([sub], [], "2026-11-10").events).toEqual([]);
  });

  it("flags a charge after cancelling and reopens it", () => {
    const sub = stored({
      status: "cancelled",
      cancelled_at: "2026-11-11T00:00:00Z",
    });
    const plan = planSubscriptions(
      [sub],
      [{ ...found, last_charged: "2026-12-05", next_date: "2027-01-04" }],
      "2026-12-06",
    );
    expect(plan.events.map((x) => x.type)).toEqual(["charged_again"]);
    expect(plan.updates[0].patch).toMatchObject({
      status: "cancel",
      last_charged: "2026-12-05",
    });
  });

  it("follows a kept subscription's new charge quietly", () => {
    const plan = planSubscriptions(
      [stored({ status: "keep" })],
      [
        {
          ...found,
          last_charged: "2026-11-05",
          next_date: "2026-12-05",
          amount: 699,
        },
      ],
      "2026-11-06",
    );
    expect(plan.events).toEqual([]);
    expect(plan.updates[0].patch).toEqual({
      last_charged: "2026-11-05",
      next_date: "2026-12-05",
      amount: 699,
    });
  });
});

describe("totals and messages", () => {
  const subs = [
    stored({}),
    stored({
      id: "a2",
      merchant: "Spotify",
      merchant_key: "spotify",
      amount: 119,
      status: "keep",
    }),
    stored({
      id: "a3",
      merchant: "ZEE5",
      merchant_key: "zee5",
      amount: 99,
      status: "cancelled",
    }),
  ];

  it("adds up what's still paid and what's saved", () => {
    expect(monthlyTotal(subs)).toBe(768);
    expect(yearlySaved(subs)).toBe(1188);
  });

  it("lists subscriptions with tappable commands", () => {
    const msg = subsListMessage(subs);
    expect(msg).toContain("₹768 a month");
    expect(msg).toContain(`/keep_${shortId(subs[0].id)}`);
    expect(msg).toContain("saving ₹1,188 a year");
    expect(msg).not.toContain("ZEE5 ₹99/mo");
  });

  it("gives a cancel link when one is known", () => {
    const text = eventMessage(
      { type: "renews_soon", sub: stored({ status: "cancel" }) },
      "6f1c2a90-x",
    );
    expect(text).toContain("https://www.netflix.com/cancelplan");
    expect(
      eventMessage({
        type: "found",
        sub: {
          merchant_key: "a",
          merchant: "A<b>",
          category: "Entertainment",
          amount: 99,
          last_charged: "2026-10-01",
          next_date: "2026-10-31",
        },
      }),
    ).toContain("A&lt;b&gt;");
  });
});

describe("subscriptionView", () => {
  it("merges saved and newly found rows, undecided first", async () => {
    const { subscriptionView } = await import("./subscriptions");
    const view = subscriptionView(
      [stored({ status: "keep" })],
      [
        {
          merchant_key: "netflix",
          merchant: "Netflix",
          category: "Entertainment",
          amount: 649,
          last_charged: "2026-10-05",
          next_date: "2026-11-05",
        },
        {
          merchant_key: "spotify",
          merchant: "Spotify",
          category: "Entertainment",
          amount: 119,
          last_charged: "2026-10-12",
          next_date: "2026-11-11",
        },
      ],
    );
    expect(view.map((v) => [v.merchant, v.status, v.id === null])).toEqual([
      ["Spotify", "new", true],
      ["Netflix", "keep", false],
    ]);
    expect(view[0].cancel_url).toContain("spotify.com");
  });
});
