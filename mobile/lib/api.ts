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
