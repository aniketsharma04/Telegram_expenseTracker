export interface Category {
  id: string;
  name: string;
  keywords: string[];
  color: string | null;
  monthly_budget: number | null;
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

export interface Expense {
  id: string;
  user_id: number | null;
  amount: number;
  category: string;
  merchant: string | null;
  raw_message: string | null;
  source: "telegram_text" | "telegram_voice" | "telegram_photo";
  parsed_by: "rules" | "llm";
  expense_date: string; // YYYY-MM-DD
  logged_at: string; // ISO timestamp
}
