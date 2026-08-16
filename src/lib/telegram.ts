const API_BASE = "https://api.telegram.org";

/** Minimal shape of the Telegram update we care about in v1 (text messages). */
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
    from?: { id: number; first_name?: string };
  };
}

export async function sendMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) {
    console.error("telegram sendMessage failed", res.status, await res.text());
  }
}
