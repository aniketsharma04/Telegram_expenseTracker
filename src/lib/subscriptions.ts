import { SupabaseClient } from "@supabase/supabase-js";
import {
  addDays,
  daysBetween,
  detectRecurring,
  type ExpenseLike,
} from "./insights";

/**
 * Subscriptions (v19): repeat charges the user decides to keep or cancel.
 *
 * Found two ways in the expense history:
 *   1. a known subscription service, charged in the last ~40 days;
 *   2. any charge that repeats monthly in a discretionary category (rent,
 *      EMIs, bills and investments repeat too, but nobody "cancels" those).
 *
 * The user answers keep / cancel. After a cancel, a renewal date that passes
 * with no charge marks it cancelled — that's when it counts as money saved.
 *
 * The pure functions here are unit-tested; the DB functions at the bottom
 * apply their results.
 */

export type SubStatus = "new" | "keep" | "cancel" | "cancelled";

export interface Subscription {
  id: string;
  user_id: number;
  merchant_key: string;
  merchant: string;
  category: string | null;
  amount: number;
  last_charged: string | null;
  next_date: string | null;
  status: SubStatus;
  decided_at: string | null;
  cancelled_at: string | null;
  notified: string | null;
}

export interface FoundSubscription {
  merchant_key: string;
  merchant: string;
  category: string;
  amount: number;
  last_charged: string;
  next_date: string;
}

interface KnownService {
  name: string;
  match: RegExp;
  /** Where the user cancels it; null when it's done inside the app only. */
  cancelUrl: string | null;
  /** App stores also sell one-off purchases: count them only when they repeat. */
  repeatsOnly?: boolean;
}

/** Common Indian subscriptions. Order matters: the first match wins. */
export const KNOWN_SERVICES: KnownService[] = [
  {
    name: "Netflix",
    match: /netflix/i,
    cancelUrl: "https://www.netflix.com/cancelplan",
  },
  {
    name: "Spotify",
    match: /spotify/i,
    cancelUrl: "https://www.spotify.com/account/subscription/",
  },
  {
    name: "YouTube Premium",
    match: /youtube|yt\s*premium/i,
    cancelUrl: "https://www.youtube.com/paid_memberships",
  },
  { name: "Times Prime", match: /times\s*prime/i, cancelUrl: null },
  {
    name: "Amazon Prime",
    match: /prime\s*video|amazon\s*prime/i,
    cancelUrl: "https://www.amazon.in/gp/primecentral",
  },
  {
    name: "JioHotstar",
    match: /hotstar|jio\s*cinema|jiohotstar/i,
    cancelUrl: "https://www.hotstar.com/in/mysubscriptions",
  },
  { name: "Sony LIV", match: /sony\s*liv|sonyliv/i, cancelUrl: null },
  { name: "ZEE5", match: /zee\s*5/i, cancelUrl: null },
  {
    name: "Apple",
    match: /apple\.com|itunes|icloud|apple\s*(music|one|tv)/i,
    cancelUrl: "https://apps.apple.com/account/subscriptions",
    repeatsOnly: true,
  },
  {
    name: "Google One",
    match: /google\s*one/i,
    cancelUrl: "https://one.google.com/settings",
  },
  {
    name: "Google Play",
    match: /google\s*play|play\s*store/i,
    cancelUrl: "https://play.google.com/store/account/subscriptions",
    repeatsOnly: true,
  },
  {
    name: "Microsoft 365",
    match: /microsoft|office\s*365|xbox/i,
    cancelUrl: "https://account.microsoft.com/services",
    repeatsOnly: true,
  },
  {
    name: "LinkedIn Premium",
    match: /linkedin/i,
    cancelUrl: "https://www.linkedin.com/premium/manage/",
  },
  {
    name: "Adobe",
    match: /adobe/i,
    cancelUrl: "https://account.adobe.com/plans",
  },
  { name: "Canva", match: /canva/i, cancelUrl: null },
  { name: "ChatGPT", match: /chatgpt|openai/i, cancelUrl: null },
  { name: "Audible", match: /audible/i, cancelUrl: null },
  { name: "Kindle Unlimited", match: /kindle/i, cancelUrl: null },
  { name: "JioSaavn", match: /saavn/i, cancelUrl: null },
  { name: "Gaana", match: /gaana/i, cancelUrl: null },
  { name: "Swiggy One", match: /swiggy\s*one/i, cancelUrl: null },
  { name: "Zomato Gold", match: /zomato\s*gold/i, cancelUrl: null },
  { name: "Cult.fit", match: /cult\.?\s*fit|cultfit/i, cancelUrl: null },
  {
    name: "Discovery+",
    match: /discovery\s*\+|discovery\s*plus/i,
    cancelUrl: null,
  },
];

/** Repeat charges here are choices; elsewhere they're obligations. */
const DISCRETIONARY = new Set([
  "Entertainment",
  "Education",
  "Health",
  "Personal care",
  "Shopping",
  "Food delivery",
]);

/** A known service charged within this many days counts even if seen once. */
const KNOWN_RECENT_DAYS = 40;
/** After a cancel, this many days past the expected renewal with no charge = cancelled. */
export const CANCEL_GRACE_DAYS = 7;
/** Ask again about a planned cancel this many days before it renews. */
export const RENEWAL_WARN_DAYS = 2;

export function knownService(merchant: string | null): KnownService | null {
  if (!merchant) return null;
  return KNOWN_SERVICES.find((s) => s.match.test(merchant)) ?? null;
}

export function merchantKey(merchant: string): string {
  const known = knownService(merchant);
  return (known?.name ?? merchant).trim().toLowerCase().replace(/\s+/g, " ");
}

export function cancelUrlFor(merchant: string): string | null {
  return knownService(merchant)?.cancelUrl ?? null;
}

/** Subscriptions in a user's expense history (most expensive first). */
export function findSubscriptions(
  expenses: ExpenseLike[],
  today: string,
): FoundSubscription[] {
  const out = new Map<string, FoundSubscription>();

  for (const r of detectRecurring(expenses, today)) {
    const known = knownService(r.merchant);
    if (!known && !DISCRETIONARY.has(r.category)) continue;
    const key = merchantKey(r.merchant);
    const last = latestCharge(expenses, key);
    out.set(key, {
      merchant_key: key,
      merchant: known?.name ?? r.merchant,
      category: r.category,
      amount: r.amount,
      last_charged: last?.expense_date ?? addDays(r.nextDate, -30),
      next_date: r.nextDate,
    });
  }

  // Known services seen once recently: likely a new monthly plan.
  for (const e of expenses) {
    const known = knownService(e.merchant);
    if (!known || known.repeatsOnly || Number(e.amount) <= 0) continue;
    const age = daysBetween(e.expense_date, today);
    if (age < 0 || age > KNOWN_RECENT_DAYS) continue;
    const key = merchantKey(e.merchant!);
    if (out.has(key)) continue;
    const last = latestCharge(expenses, key)!;
    out.set(key, {
      merchant_key: key,
      merchant: known.name,
      category: last.category,
      amount: Math.round(Number(last.amount)),
      last_charged: last.expense_date,
      next_date: addDays(last.expense_date, 30),
    });
  }

  return [...out.values()].sort((a, b) => b.amount - a.amount);
}

function latestCharge(
  expenses: ExpenseLike[],
  key: string,
): ExpenseLike | null {
  let best: ExpenseLike | null = null;
  for (const e of expenses) {
    if (!e.merchant || merchantKey(e.merchant) !== key) continue;
    if (!best || e.expense_date > best.expense_date) best = e;
  }
  return best;
}

export type SubEvent =
  | { type: "found"; sub: FoundSubscription }
  | { type: "renews_soon"; sub: Subscription }
  | { type: "cancelled"; sub: Subscription }
  | { type: "charged_again"; sub: Subscription; amount: number };

export interface SubPlan {
  inserts: FoundSubscription[];
  updates: Array<{ id: string; patch: Partial<Subscription> }>;
  events: SubEvent[];
}

/**
 * Compare what's stored with what the history shows today. Pure: returns the
 * rows to write and the moments worth telling the user about, each once.
 */
export function planSubscriptions(
  stored: Subscription[],
  found: FoundSubscription[],
  today: string,
): SubPlan {
  const plan: SubPlan = { inserts: [], updates: [], events: [] };
  const byKey = new Map(stored.map((s) => [s.merchant_key, s]));

  for (const f of found) {
    const s = byKey.get(f.merchant_key);
    if (!s) {
      plan.inserts.push(f);
      plan.events.push({ type: "found", sub: f });
      continue;
    }
    const newCharge = !s.last_charged || f.last_charged > s.last_charged;
    const patch: Partial<Subscription> = {};
    if (newCharge) {
      patch.last_charged = f.last_charged;
      patch.next_date = f.next_date;
      patch.amount = f.amount;
    }
    // Charged again after they said cancel (or after it looked cancelled).
    if (newCharge && (s.status === "cancel" || s.status === "cancelled")) {
      patch.status = "cancel";
      patch.cancelled_at = null;
      const mark = `charged:${f.last_charged}`;
      if (s.notified !== mark) {
        patch.notified = mark;
        plan.events.push({ type: "charged_again", sub: s, amount: f.amount });
      }
    }
    if (Object.keys(patch).length) plan.updates.push({ id: s.id, patch });
  }

  for (const s of stored) {
    if (s.status !== "cancel" || !s.next_date) continue;
    if (plan.updates.some((u) => u.id === s.id && u.patch.last_charged))
      continue; // just charged; handled above
    const until = daysBetween(today, s.next_date);
    if (until === RENEWAL_WARN_DAYS && s.notified !== `warn:${s.next_date}`) {
      plan.updates.push({
        id: s.id,
        patch: { notified: `warn:${s.next_date}` },
      });
      plan.events.push({ type: "renews_soon", sub: s });
    }
    if (until <= -CANCEL_GRACE_DAYS) {
      plan.updates.push({
        id: s.id,
        patch: {
          status: "cancelled",
          cancelled_at: `${today}T00:00:00Z`,
          notified: `cancelled:${s.next_date}`,
        },
      });
      plan.events.push({ type: "cancelled", sub: s });
    }
  }
  return plan;
}

/** Monthly total of what's still being paid (everything except cancelled). */
export function monthlyTotal(subs: Subscription[]): number {
  return subs
    .filter((s) => s.status !== "cancelled")
    .reduce((sum, s) => sum + Number(s.amount), 0);
}

/** Yearly money saved by cancellations that stuck. */
export function yearlySaved(subs: Subscription[]): number {
  return subs
    .filter((s) => s.status === "cancelled")
    .reduce((sum, s) => sum + Number(s.amount) * 12, 0);
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Telegram commands allow [a-z0-9_]; a uuid prefix is short and stable. */
export const shortId = (id: string) => id.replace(/-/g, "").slice(0, 6);

/** Telegram HTML for one event; null for events that need no message. */
export function eventMessage(e: SubEvent, id?: string): string | null {
  const tag = id ? shortId(id) : null;
  switch (e.type) {
    case "found":
      return (
        `🔁 Looks like a subscription: <b>${esc(e.sub.merchant)}</b>, about ${inr(e.sub.amount)} a month (${inr(e.sub.amount * 12)} a year).\n` +
        (tag
          ? `Keep it? <code>/keep_${tag}</code> · Planning to cancel? <code>/cancel_${tag}</code>`
          : "Decide in the app: keep it or cancel it.")
      );
    case "renews_soon": {
      const url = cancelUrlFor(e.sub.merchant);
      return (
        `⏰ <b>${esc(e.sub.merchant)}</b> renews in ${RENEWAL_WARN_DAYS} days (${inr(e.sub.amount)}). You planned to cancel it.` +
        (url
          ? `\nCancel here: ${url}`
          : "\nCancel it from its app's account settings.") +
        (tag ? `\nChanged your mind? <code>/keep_${tag}</code>` : "")
      );
    }
    case "cancelled":
      return `🎉 No <b>${esc(e.sub.merchant)}</b> charge this month, so it's cancelled. That's ${inr(e.sub.amount)} a month, ${inr(Number(e.sub.amount) * 12)} a year, back with you.`;
    case "charged_again":
      return (
        `⚠️ <b>${esc(e.sub.merchant)}</b> charged ${inr(e.amount)} again, even though you planned to cancel it.` +
        (cancelUrlFor(e.sub.merchant)
          ? `\nCancel here: ${cancelUrlFor(e.sub.merchant)}`
          : "")
      );
  }
}

/** The /subs reply: everything still being paid, with a command per row. */
export function subsListMessage(subs: Subscription[]): string {
  const live = subs.filter((s) => s.status !== "cancelled");
  const saved = yearlySaved(subs);
  if (!live.length)
    return saved
      ? `No subscriptions left to review. Cancellations are saving you ${inr(saved)} a year. 🎉`
      : "I haven't spotted any subscriptions yet. They show up after a service charges you (Netflix, Spotify, Prime…) or a charge repeats monthly.";
  const lines = live.map((s) => {
    const tag = shortId(s.id);
    const when = s.next_date
      ? `, next ${s.next_date.slice(8)}/${s.next_date.slice(5, 7)}`
      : "";
    const action =
      s.status === "new"
        ? `<code>/keep_${tag}</code> · <code>/cancel_${tag}</code>`
        : s.status === "keep"
          ? `keeping · <code>/cancel_${tag}</code>`
          : `cancelling · <code>/keep_${tag}</code>`;
    return `• <b>${esc(s.merchant)}</b> ${inr(s.amount)}/mo${when}\n   ${action}`;
  });
  return [
    `🔁 <b>Subscriptions</b>: ${inr(monthlyTotal(subs))} a month, ${inr(monthlyTotal(subs) * 12)} a year`,
    "",
    ...lines,
    ...(saved ? ["", `Cancelled so far: saving ${inr(saved)} a year.`] : []),
  ].join("\n");
}

// ── Database ────────────────────────────────────────────────────────────────

const COLUMNS =
  "id, user_id, merchant_key, merchant, category, amount, last_charged, next_date, status, decided_at, cancelled_at, notified";

export async function listSubscriptions(
  supabase: SupabaseClient,
  userId: number,
): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("amount", { ascending: false });
  if (error) return []; // v19 migration not applied yet
  return (data ?? []) as Subscription[];
}

/**
 * Bring the table in line with the expense history and return what to tell
 * the user, each event paired with its row id.
 */
export async function syncSubscriptions(
  supabase: SupabaseClient,
  userId: number,
  expenses: ExpenseLike[],
  today: string,
): Promise<Array<{ event: SubEvent; id: string }>> {
  const stored = await listSubscriptions(supabase, userId);
  const plan = planSubscriptions(
    stored,
    findSubscriptions(expenses, today),
    today,
  );
  const out: Array<{ event: SubEvent; id: string }> = [];

  const idByKey = new Map(stored.map((s) => [s.merchant_key, s.id]));
  if (plan.inserts.length) {
    const { data, error } = await supabase
      .from("subscriptions")
      .upsert(
        plan.inserts.map((f) => ({ ...f, user_id: userId, notified: "found" })),
        { onConflict: "user_id,merchant_key", ignoreDuplicates: true },
      )
      .select("id, merchant_key");
    if (error) throw error;
    for (const r of data ?? [])
      idByKey.set(r.merchant_key as string, r.id as string);
  }
  for (const u of plan.updates) {
    const { error } = await supabase
      .from("subscriptions")
      .update(u.patch)
      .eq("id", u.id)
      .eq("user_id", userId);
    if (error) throw error;
  }
  for (const event of plan.events) {
    const id =
      "id" in event.sub ? event.sub.id : idByKey.get(event.sub.merchant_key);
    if (id) out.push({ event, id });
  }
  return out;
}

/** keep | cancel, by full id or the 6-character command tag. */
export async function decideSubscription(
  supabase: SupabaseClient,
  userId: number,
  idOrTag: string,
  decision: "keep" | "cancel",
): Promise<Subscription | null> {
  const subs = await listSubscriptions(supabase, userId);
  const sub = subs.find((s) => s.id === idOrTag || shortId(s.id) === idOrTag);
  if (!sub) return null;
  const patch = {
    status: decision,
    decided_at: new Date().toISOString(),
    cancelled_at: null,
  };
  const { error } = await supabase
    .from("subscriptions")
    .update(patch)
    .eq("id", sub.id)
    .eq("user_id", userId);
  if (error) throw error;
  return { ...sub, ...patch };
}

/** What the app shows: saved rows, plus ones found today that aren't saved yet. */
export interface SubscriptionView {
  /** null until the user first decides (or the daily scan saves it). */
  id: string | null;
  merchant_key: string;
  merchant: string;
  category: string | null;
  amount: number;
  last_charged: string | null;
  next_date: string | null;
  status: SubStatus;
  cancel_url: string | null;
}

export function subscriptionView(
  stored: Subscription[],
  found: FoundSubscription[],
): SubscriptionView[] {
  const keys = new Set(stored.map((s) => s.merchant_key));
  const rows: SubscriptionView[] = [
    ...stored.map((s) => ({
      id: s.id,
      merchant_key: s.merchant_key,
      merchant: s.merchant,
      category: s.category,
      amount: Number(s.amount),
      last_charged: s.last_charged,
      next_date: s.next_date,
      status: s.status,
      cancel_url: cancelUrlFor(s.merchant),
    })),
    ...found
      .filter((f) => !keys.has(f.merchant_key))
      .map((f) => ({
        id: null,
        ...f,
        status: "new" as const,
        cancel_url: cancelUrlFor(f.merchant),
      })),
  ];
  // Undecided first, then what's still paid, then cancelled; bigger first.
  const rank: Record<SubStatus, number> = {
    new: 0,
    cancel: 1,
    keep: 2,
    cancelled: 3,
  };
  return rows.sort(
    (a, b) => rank[a.status] - rank[b.status] || b.amount - a.amount,
  );
}

/** Save a found-but-unsaved subscription with the user's first decision. */
export async function decideFoundSubscription(
  supabase: SupabaseClient,
  userId: number,
  found: FoundSubscription,
  decision: "keep" | "cancel",
): Promise<Subscription> {
  const { data, error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        ...found,
        user_id: userId,
        status: decision,
        decided_at: new Date().toISOString(),
        notified: "found",
      },
      { onConflict: "user_id,merchant_key" },
    )
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as Subscription;
}
