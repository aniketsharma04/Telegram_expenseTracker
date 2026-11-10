import { API_BASE } from "./api";

/** Splits with friends (v24). Money from the server is in paise. */

export interface Person {
  id: string;
  name: string;
  upi_id: string | null;
  phone: string | null;
  bank_names: string[];
  balance: number; // paise: + they owe you, − you owe them
}

export interface SplitRecord {
  id: string;
  kind: "expense" | "payment";
  total: number; // paise
  description: string | null;
  category: string | null;
  split_date: string;
  method: string;
  expense_id: string | null;
  lent_id: string | null;
  income_id: string | null;
  members: { person_id: string | null; paid: number; owed: number }[];
}

export interface RepaymentPrompt {
  incomeId: string;
  personId: string;
  personName: string;
  bankName: string | null;
  amount: number; // paise
  date: string;
}

export interface SplitsSummary {
  myUpiId: string | null;
  people: Person[];
  owedToMe: number;
  iOwe: number;
  recent: SplitRecord[];
  repayments: RepaymentPrompt[];
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<Result<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok)
      return {
        ok: false,
        error:
          json.error ??
          (res.status === 401
            ? "Session expired. Sign in again."
            : "Couldn't save. Try again."),
      };
    return { ok: true, data: json };
  } catch {
    return {
      ok: false,
      error: "Couldn't reach the server. Check your connection.",
    };
  }
}

export const fetchSplits = (token: string) =>
  call<SplitsSummary>(token, "GET", "/api/splits");

export const fetchSplitForExpense = (token: string, expenseId: string) =>
  call<{ split: SplitRecord | null }>(
    token,
    "GET",
    `/api/splits?expense=${encodeURIComponent(expenseId)}`,
  );

export interface NewSplitBody {
  expenseId?: string;
  amount?: number; // rupees
  category?: string;
  merchant?: string | null;
  date?: string;
  description?: string | null;
  paidBy: string; // "me" or a person id
  method: "equal" | "exact" | "shares";
  shares: { person: string; value?: number }[]; // exact: rupees
}

export const createSplit = (token: string, body: NewSplitBody) =>
  call<{ split: SplitRecord }>(token, "POST", "/api/splits", body);

export const deleteSplit = (token: string, id: string) =>
  call<{ deleted: true }>(
    token,
    "DELETE",
    `/api/splits?id=${encodeURIComponent(id)}`,
  );

export const setMyUpiId = (token: string, upiId: string | null) =>
  call<{ ok: true }>(token, "PATCH", "/api/splits", { upi_id: upiId });

export const recordPayment = (
  token: string,
  body: {
    personId: string;
    direction: "they_paid" | "i_paid";
    amount?: number; // rupees
    incomeId?: string;
    expenseId?: string;
    /** v25: "upi" from the Pay button (its bank alert gets linked); "cash" otherwise. */
    via?: "upi" | "cash";
  },
) => call<{ payment: SplitRecord }>(token, "POST", "/api/splits/settle", body);

export const dismissRepayment = (token: string, incomeId: string) =>
  call<{ ok: true }>(token, "POST", "/api/splits/settle", {
    dismissIncomeId: incomeId,
  });

export const addPerson = (
  token: string,
  body: { name: string; upi_id?: string; phone?: string },
) => call<{ person: Person }>(token, "POST", "/api/people", body);

export const updatePerson = (
  token: string,
  id: string,
  body: { name?: string; upi_id?: string | null; phone?: string | null },
) => call<{ person: Person }>(token, "PATCH", "/api/people", { id, ...body });

export const removePerson = (token: string, id: string) =>
  call<{ removed: true }>(
    token,
    "DELETE",
    `/api/people?id=${encodeURIComponent(id)}`,
  );

/**
 * A link a friend can open in any chat: an https page on our server that
 * shows the amount and UPI ID and opens their UPI app (WhatsApp doesn't make
 * upi:// links tappable). Everything is in the link; nothing is stored.
 */
export function payPageLink(p: {
  upiId: string;
  name?: string | null;
  amount: number; // paise
  note?: string | null;
}): string {
  const q = new URLSearchParams({
    pa: p.upiId,
    am: (p.amount / 100).toFixed(2),
  });
  if (p.name) q.set("pn", p.name.slice(0, 40));
  if (p.note) q.set("tn", p.note.slice(0, 50));
  return `${API_BASE}/pay?${q.toString()}`;
}

export const rupees = (paise: number) => paise / 100;
