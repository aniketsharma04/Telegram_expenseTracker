// GENERATED COPY of src/lib/split-math.ts — the app can't import server code.
// Edit the server file, then copy it here; split-math-parity.test.ts checks they match.

/**
 * Split maths (v24) — pure, no DB. All money in paise (integers).
 *
 * Model (after Splitwise): each split lists every member's `paid` and `owed`.
 * Σpaid = Σowed = total. A member's net in a split is paid − owed; a balance
 * is the sum of nets. A settle-up is a split of kind "payment": the payer
 * "paid" X and the receiver "owed" X, which cancels the earlier debt.
 *
 * The owner ("you") is the member with key ME. Friends are keyed by id.
 */

export const ME = "me";
export type Key = string;

export type SplitMethod = "equal" | "exact" | "shares" | "percent";

export interface Member {
  key: Key;
  paid: number;
  owed: number;
}

export interface SplitLike {
  id?: string;
  kind: "expense" | "payment";
  total: number;
  members: Member[];
}

export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const fromPaise = (paise: number) => paise / 100;

// ── Sharing out ─────────────────────────────────────────────────────────────

export interface ShareInput {
  key: Key;
  /** shares / percent: the weight. exact: the amount in paise. equal: ignored. */
  value?: number;
}

/**
 * Who owes what. Paise left over after rounding go one each, largest
 * remainder first, ties in the order given (put the payer first), so the
 * shares always add up to the total exactly.
 */
export function allocate(
  total: number,
  method: SplitMethod,
  shares: ShareInput[],
): Map<Key, number> {
  if (!Number.isInteger(total) || total <= 0)
    throw new Error("total must be positive paise");
  if (!shares.length) throw new Error("no one to split with");
  if (new Set(shares.map((s) => s.key)).size !== shares.length)
    throw new Error("duplicate member");

  if (method === "exact") {
    const out = new Map<Key, number>();
    let sum = 0;
    for (const s of shares) {
      const v = s.value ?? 0;
      if (!Number.isInteger(v) || v < 0)
        throw new Error("exact amounts must be whole paise ≥ 0");
      out.set(s.key, v);
      sum += v;
    }
    if (sum !== total)
      throw new Error(`exact amounts add up to ${sum}, not ${total}`);
    return out;
  }

  const weights = shares.map((s) => (method === "equal" ? 1 : (s.value ?? 0)));
  if (weights.some((w) => !(w >= 0) || !Number.isFinite(w)))
    throw new Error("bad weight");
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW <= 0) throw new Error("weights add up to zero");
  if (method === "percent" && Math.abs(sumW - 100) > 1e-6)
    throw new Error(`percentages add up to ${sumW}, not 100`);

  const raw = weights.map((w) => (total * w) / sumW);
  const floors = raw.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, rem: r - floors[i] }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    if (weights[i] === 0) continue;
    floors[i]++;
    left--;
  }
  return new Map(shares.map((s, i) => [s.key, floors[i]]));
}

/** Members for one payer: they paid the total; everyone owes their share. */
export function membersFor(
  total: number,
  payer: Key,
  owed: Map<Key, number>,
): Member[] {
  const keys = new Set([payer, ...owed.keys()]);
  return [...keys].map((key) => ({
    key,
    paid: key === payer ? total : 0,
    owed: owed.get(key) ?? 0,
  }));
}

/** Checks a split is internally consistent. Returns an error or null. */
export function checkSplit(s: SplitLike): string | null {
  if (!Number.isInteger(s.total) || s.total <= 0)
    return "total must be positive";
  if (s.members.length < 2) return "a split needs at least two people";
  if (!s.members.some((m) => m.key === ME))
    return "you must be part of the split";
  if (new Set(s.members.map((m) => m.key)).size !== s.members.length)
    return "duplicate member";
  let paid = 0;
  let owed = 0;
  for (const m of s.members) {
    if (
      !Number.isInteger(m.paid) ||
      !Number.isInteger(m.owed) ||
      m.paid < 0 ||
      m.owed < 0
    )
      return "amounts must be whole paise ≥ 0";
    paid += m.paid;
    owed += m.owed;
  }
  if (paid !== s.total) return "paid amounts don't add up to the total";
  if (owed !== s.total) return "shares don't add up to the total";
  return null;
}

// ── Balances ────────────────────────────────────────────────────────────────

/** Net per member across splits: + is owed money, − owes money. */
export function nets(splits: SplitLike[]): Map<Key, number> {
  const out = new Map<Key, number>();
  for (const s of splits)
    for (const m of s.members)
      out.set(m.key, (out.get(m.key) ?? 0) + m.paid - m.owed);
  return out;
}

/**
 * Within one split, who owes whom: each debtor's debt is spread over the
 * creditors in proportion to what they're owed. Returns debts as
 * [from, to, paise], adding up exactly.
 */
export function pairwise(s: SplitLike): [Key, Key, number][] {
  const n = nets([s]);
  const creditors = [...n].filter(([, v]) => v > 0);
  const debtors = [...n].filter(([, v]) => v < 0);
  const credit = creditors.reduce((a, [, v]) => a + v, 0);
  const out: [Key, Key, number][] = [];
  for (const [d, dv] of debtors) {
    const debt = -dv;
    const parts = allocate(
      debt,
      "shares",
      creditors.map(([c, cv]) => ({ key: c, value: cv / credit })),
    );
    for (const [c, amt] of parts) if (amt > 0) out.push([d, c, amt]);
  }
  return out;
}

/**
 * Your balance with each person: + they owe you, − you owe them. Debts
 * between two friends (in a group split) don't appear here.
 */
export function balancesWithMe(splits: SplitLike[]): Map<Key, number> {
  const out = new Map<Key, number>();
  const add = (k: Key, v: number) => out.set(k, (out.get(k) ?? 0) + v);
  for (const s of splits)
    for (const [from, to, amt] of pairwise(s)) {
      if (to === ME) add(from, amt);
      else if (from === ME) add(to, -amt);
    }
  for (const [k, v] of out) if (v === 0) out.delete(k);
  return out;
}

// ── Simplifying a group ─────────────────────────────────────────────────────

/**
 * Fewest transfers that settle the given nets (Σ = 0). Exact for up to 12
 * people with a balance — the most zero-sum subgroups, each settled in
 * (size − 1) transfers — and greedy above that.
 */
export function simplify(netMap: Map<Key, number>): [Key, Key, number][] {
  const people = [...netMap].filter(([, v]) => v !== 0);
  if (people.reduce((a, [, v]) => a + v, 0) !== 0)
    throw new Error("nets must add up to zero");
  if (people.length <= 12) {
    const n = people.length;
    const full = (1 << n) - 1;
    const sum = new Array<number>(1 << n).fill(0);
    for (let m = 1; m <= full; m++) {
      const low = m & -m;
      sum[m] = sum[m ^ low] + people[31 - Math.clz32(low)][1];
    }
    // best[m] = most zero-sum groups that m (a zero-sum set) splits into.
    const best = new Array<number>(1 << n).fill(-1);
    const pick = new Array<number>(1 << n).fill(0);
    best[0] = 0;
    for (let m = 1; m <= full; m++) {
      if (sum[m] !== 0) continue;
      const lowest = m & -m;
      // Groups containing the lowest member, to avoid counting orders.
      for (let sub = m; sub; sub = (sub - 1) & m) {
        if (!(sub & lowest) || sum[sub] !== 0 || best[m ^ sub] < 0) continue;
        if (best[m ^ sub] + 1 > best[m]) {
          best[m] = best[m ^ sub] + 1;
          pick[m] = sub;
        }
      }
    }
    const out: [Key, Key, number][] = [];
    for (let m = full; m; m ^= pick[m])
      out.push(...greedy(people.filter((_, i) => pick[m] & (1 << i))));
    return out;
  }
  return greedy(people);
}

function greedy(people: [Key, number][]): [Key, Key, number][] {
  const cred = people
    .filter(([, v]) => v > 0)
    .map(([k, v]) => [k, v] as [Key, number]);
  const debt = people
    .filter(([, v]) => v < 0)
    .map(([k, v]) => [k, -v] as [Key, number]);
  const out: [Key, Key, number][] = [];
  while (cred.length && debt.length) {
    cred.sort((a, b) => b[1] - a[1]);
    debt.sort((a, b) => b[1] - a[1]);
    const amt = Math.min(cred[0][1], debt[0][1]);
    out.push([debt[0][0], cred[0][0], amt]);
    cred[0][1] -= amt;
    debt[0][1] -= amt;
    if (!cred[0][1]) cred.shift();
    if (!debt[0][1]) debt.shift();
  }
  return out;
}

// ── Paying back ─────────────────────────────────────────────────────────────

export const UPI_ID = /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.-]{1,64}$/;

/**
 * A UPI Intent link: the friend taps it and pays in their own UPI app. Aaj
 * never touches the money. (P2P collect requests ended on 1 Oct 2025.)
 */
export function upiLink(p: {
  upiId: string;
  name?: string | null;
  amount: number; // paise
  note?: string | null;
}): string {
  if (!UPI_ID.test(p.upiId)) throw new Error("not a UPI ID");
  const q = [
    `pa=${encodeURIComponent(p.upiId)}`,
    p.name ? `pn=${encodeURIComponent(p.name.slice(0, 40))}` : null,
    `am=${(p.amount / 100).toFixed(2)}`,
    "cu=INR",
    p.note ? `tn=${encodeURIComponent(p.note.slice(0, 50))}` : null,
  ].filter(Boolean);
  return `upi://pay?${q.join("&")}`;
}

// ── Recognising repayments ──────────────────────────────────────────────────

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

/**
 * How sure we are that the bank's payer name is this person, 0–1.
 * A name the user already confirmed for them is certain.
 */
export function nameScore(
  bankName: string | null | undefined,
  person: { name: string; bankNames?: string[] },
): number {
  if (!bankName) return 0;
  const b = bankName.trim().toLowerCase();
  if ((person.bankNames ?? []).some((n) => n.trim().toLowerCase() === b))
    return 1;
  const bw = new Set(words(bankName));
  const pw = words(person.name);
  if (!pw.length || !bw.size) return 0;
  const hits = pw.filter((w) => bw.has(w)).length;
  if (hits === pw.length) return pw.length > 1 ? 0.9 : 0.7;
  if (hits > 0) return 0.5;
  // Initials: "R K SHARMA" for "Rahul Sharma".
  const initials = [...bw].filter((w) => w.length === 1);
  return initials.length && pw.some((w) => bw.has(w)) ? 0.5 : 0;
}

export interface IncomeLike {
  id: string;
  amount: number; // rupees, as stored
  source: string | null;
  income_date: string;
}

export interface RepaymentGuess {
  incomeId: string;
  personKey: Key;
  amount: number; // paise
  score: number;
}

/**
 * Credits that look like someone paying you back: the person owes you at
 * least this much (₹1 slack), and the payer name or an exact amount points
 * at them. Never acted on without the user saying yes.
 */
export function guessRepayments(
  incomes: IncomeLike[],
  owedToMe: Map<Key, number>,
  people: { key: Key; name: string; bankNames?: string[] }[],
): RepaymentGuess[] {
  const out: RepaymentGuess[] = [];
  for (const inc of incomes) {
    const amount = toPaise(Number(inc.amount));
    // An exact amount alone is a fair guess only when one person owes it
    // (a parent's account paying for them won't carry their name).
    const exactOwers = people.filter(
      (p) => Math.abs((owedToMe.get(p.key) ?? 0) - amount) <= 100,
    ).length;
    let best: RepaymentGuess | null = null;
    for (const p of people) {
      const owes = owedToMe.get(p.key) ?? 0;
      if (owes <= 0 || amount > owes + 100) continue;
      const name = nameScore(inc.source, p);
      const exact = Math.abs(owes - amount) <= 100;
      const score =
        name >= 0.5
          ? name + (exact ? 0.1 : 0)
          : exact && exactOwers === 1
            ? 0.5
            : 0;
      if (score >= 0.5 && (!best || score > best.score))
        best = {
          incomeId: inc.id,
          personKey: p.key,
          amount,
          score: Math.min(1, score),
        };
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => b.score - a.score);
}
