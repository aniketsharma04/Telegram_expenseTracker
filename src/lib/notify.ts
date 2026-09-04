import { SupabaseClient } from "@supabase/supabase-js";
import { sendMessage } from "./telegram";
import { telegramChatId } from "./identity";

/**
 * Reaching a user (v12).
 *
 * Before accounts existed, `users.id` was the Telegram chat id, so every
 * reminder did `sendMessage(userId, …)`. With email accounts that assumption
 * is actively dangerous: a user id that isn't a chat id either fails or, far
 * worse, addresses somebody else's chat.
 *
 * So nothing sends to a raw id any more. Everything goes through here, which
 * looks up the linked chat and stays silent when there isn't one.
 */

export async function notify(
  supabase: SupabaseClient,
  userId: number,
  text: string,
): Promise<boolean> {
  const chatId = await telegramChatId(supabase, userId);
  if (!chatId) return false; // no Telegram linked — nothing to do, and that's fine
  try {
    await sendMessage(chatId, text);
    return true;
  } catch (err) {
    console.error("notify failed", err);
    return false;
  }
}

/** Several messages to one user, in order. Returns how many got through. */
export async function notifyAll(
  supabase: SupabaseClient,
  userId: number,
  messages: string[],
): Promise<number> {
  if (!messages.length) return 0;
  const chatId = await telegramChatId(supabase, userId);
  if (!chatId) return 0;

  let sent = 0;
  for (const text of messages) {
    try {
      await sendMessage(chatId, text);
      sent++;
    } catch (err) {
      console.error("notify failed", err);
    }
  }
  return sent;
}
