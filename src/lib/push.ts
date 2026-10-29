/**
 * Push delivery (v15) through the Expo push service, which hands Android
 * messages to Firebase Cloud Messaging and iOS ones to APNs. One code path for
 * both platforms, and no Firebase key on the server: the FCM credentials live
 * in the EAS project.
 *
 * Pure transport — who gets what is notify.ts's job.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** The service rejects bigger requests. */
const BATCH = 100;

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Android notification channel; created by the app on launch. */
  channelId?: string;
  sound?: "default";
  priority?: "default" | "normal" | "high";
}

export interface PushResult {
  sent: number;
  failed: number;
  /** Tokens the service says are gone — stop sending to them. */
  deadTokens: string[];
}

export const isExpoToken = (t: string) =>
  /^Expo(nent)?PushToken\[[^\]]+\]$/.test(t);

interface Ticket {
  status: "ok" | "error";
  details?: { error?: string };
}

export async function sendExpoPush(
  messages: PushMessage[],
): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, deadTokens: [] };
  const valid = messages.filter((m) => isExpoToken(m.to));
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  // Only needed once "enhanced push security" is switched on in EAS.
  if (process.env.EXPO_ACCESS_TOKEN)
    headers.authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  for (let i = 0; i < valid.length; i += BATCH) {
    const batch = valid.slice(i, i + BATCH);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(batch),
      });
      if (!res.ok) throw new Error(`push service HTTP ${res.status}`);
      const tickets = ((await res.json()) as { data?: Ticket[] }).data ?? [];
      batch.forEach((m, j) => {
        const ticket = tickets[j];
        if (ticket?.status === "ok") {
          result.sent++;
          return;
        }
        result.failed++;
        if (ticket?.details?.error === "DeviceNotRegistered")
          result.deadTokens.push(m.to);
      });
    } catch (err) {
      console.error("push batch failed", err);
      result.failed += batch.length;
    }
  }
  return result;
}

/** Telegram-flavoured HTML → the plain text a phone notification shows. */
export function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();
}
