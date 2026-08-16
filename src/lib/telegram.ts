const API_BASE = "https://api.telegram.org";

/** Minimal shape of the Telegram updates we handle (text + voice in v2). */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  text?: string;
  caption?: string; // text the user attaches to a photo
  voice?: {
    file_id: string;
    duration: number;
    mime_type?: string;
    file_size?: number;
  };
  photo?: Array<{ file_id: string; width?: number; height?: number }>;
  chat: { id: number };
  from?: { id: number; first_name?: string };
}

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return token;
}

export async function sendMessage(chatId: number, text: string): Promise<void> {
  const res = await fetch(`${API_BASE}/bot${botToken()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) {
    console.error("telegram sendMessage failed", res.status, await res.text());
  }
}

/** Resolve a file_id to bytes (used for voice notes; photos in v3). */
export async function downloadTelegramFile(
  fileId: string,
): Promise<ArrayBuffer | null> {
  const token = botToken();
  const infoRes = await fetch(`${API_BASE}/bot${token}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!infoRes.ok) {
    console.error(
      "telegram getFile failed",
      infoRes.status,
      await infoRes.text(),
    );
    return null;
  }
  const info = (await infoRes.json()) as {
    ok: boolean;
    result?: { file_path?: string };
  };
  const filePath = info.result?.file_path;
  if (!filePath) return null;

  const fileRes = await fetch(`${API_BASE}/file/bot${token}/${filePath}`);
  if (!fileRes.ok) {
    console.error("telegram file download failed", fileRes.status);
    return null;
  }
  return fileRes.arrayBuffer();
}
