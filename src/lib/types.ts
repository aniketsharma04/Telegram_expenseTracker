export interface Category {
  id: string;
  name: string;
  keywords: string[];
  color: string | null;
  monthly_budget: number | null;
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
