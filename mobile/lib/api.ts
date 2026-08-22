/** Same API the web dashboard uses — the app is just another skin over it. */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? "https://telegram-expense-tracker-nu.vercel.app";

export const BOT_URL = "https://t.me/Aniket_financial_expense_bot";

export interface Expense {
  id: string;
  user_id: number | null;
  amount: number;
  category: string;
  merchant: string | null;
  expense_date: string;
  logged_at: string;
  source: string;
}

export interface ApiMember {
  id: number;
  name: string;
}

export interface ApiData {
  user: { id: number; name: string };
  family: {
    id: string;
    name: string;
    role: string;
    invite_code: string;
    members: ApiMember[];
  } | null;
  categories: Array<{ name: string; color: string | null }>;
  expenses: Expense[];
  today: string;
}

export async function fetchData(token: string): Promise<ApiData | "unauthorized"> {
  const res = await fetch(`${API_BASE}/api/data`, {
    headers: { Authorization: `Bearer ${token.trim()}` },
  });
  if (res.status === 401) return "unauthorized";
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as ApiData;
}

export interface LoggedExpense {
  id: string;
  amount: number;
  category: string;
  merchant: string | null;
  expense_date: string;
}

export type AddResult =
  | { status: "logged"; expense: LoggedExpense; nudge: boolean }
  | { status: "need_amount"; question: string | null };

export type AddBody =
  | { text: string }
  | { amount: number; category: string; merchant?: string; expense_date?: string };

/** Log an expense — free text (bot brain) or structured form fields. */
export async function addExpense(
  token: string,
  body: AddBody,
): Promise<AddResult | "unauthorized"> {
  const res = await fetch(`${API_BASE}/api/expense`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) return "unauthorized";
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as AddResult;
}

/** Undo: delete one of your own expenses. */
export async function deleteExpense(token: string, id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/expense?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token.trim()}` },
  });
  if (!res.ok) return false;
  const json = (await res.json()) as { deleted: boolean };
  return json.deleted;
}
