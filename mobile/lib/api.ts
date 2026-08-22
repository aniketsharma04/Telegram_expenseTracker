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
  paid_by?: number | null;
  split_id?: string | null;
}

export interface BudgetProgress {
  id: string;
  category: string | null; // null = overall
  monthly_cap: number;
  spent: number;
  pct: number;
}

export interface IncomeEntry {
  id: string;
  amount: number;
  source: string | null;
  income_date: string;
}

export interface RecurringCharge {
  merchant: string;
  category: string;
  amount: number;
  nextDate: string;
  daysUntil: number;
}

export interface Anomaly {
  category: string;
  mtd: number;
  expected: number;
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
  budgets?: BudgetProgress[];
  incomes?: IncomeEntry[];
  insights?: { recurring: RecurringCharge[]; anomalies: Anomaly[] };
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
  | {
      status: "logged";
      expense: LoggedExpense;
      nudge: boolean;
      alerts?: string[];
      transcript?: string;
      split?: { perHead: number; count: number; total: number };
    }
  | { status: "need_amount"; question: string | null; alerts?: string[] };

export type AddBody =
  | { text: string }
  | {
      amount: number;
      category: string;
      merchant?: string;
      expense_date?: string;
      split?: boolean;
    };

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

/** Edit one of your own expenses in place. */
export async function patchExpense(
  token: string,
  id: string,
  patch: { amount?: number; category?: string; merchant?: string | null; expense_date?: string },
): Promise<{ status: "updated"; expense: LoggedExpense; alerts?: string[] } | "unauthorized" | null> {
  const res = await fetch(`${API_BASE}/api/expense`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, ...patch }),
  });
  if (res.status === 401) return "unauthorized";
  if (!res.ok) return null;
  return (await res.json()) as { status: "updated"; expense: LoggedExpense; alerts?: string[] };
}

/** Voice note or receipt photo → same brains as the bot. */
export async function uploadMedia(
  token: string,
  kind: "voice" | "receipt",
  file: { uri: string; name: string; type: string },
  caption?: string,
): Promise<AddResult | "unauthorized"> {
  const form = new FormData();
  form.append("kind", kind);
  // React Native's FormData takes {uri, name, type} for files.
  form.append("file", file as unknown as Blob);
  if (caption) form.append("caption", caption);
  const res = await fetch(`${API_BASE}/api/expense/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.trim()}` },
    body: form,
  });
  if (res.status === 401) return "unauthorized";
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as AddResult;
}

export async function addIncome(
  token: string,
  body: { amount: number; source?: string; income_date?: string },
): Promise<{ status: "logged"; income: IncomeEntry } | "unauthorized" | null> {
  const res = await fetch(`${API_BASE}/api/income`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) return "unauthorized";
  if (!res.ok) return null;
  return (await res.json()) as { status: "logged"; income: IncomeEntry };
}

export async function deleteIncome(token: string, id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/income?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token.trim()}` },
  });
  if (!res.ok) return false;
  return ((await res.json()) as { deleted: boolean }).deleted;
}

export async function saveBudget(
  token: string,
  category: string | null,
  monthly_cap: number,
): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/budget`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ category, monthly_cap }),
  });
  return res.ok;
}

export async function removeBudget(token: string, category: string | null): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/api/budget?category=${encodeURIComponent(category ?? "overall")}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token.trim()}` } },
  );
  return res.ok;
}
