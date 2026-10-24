import { SupabaseClient } from "@supabase/supabase-js";
import { sendMessage } from "./telegram";
import { telegramChatId } from "./identity";
import { htmlToPlain, sendExpoPush } from "./push";

/**
 * Reaching a user (v15).
 *
 * Every notice is stored in the user's inbox first, then pushed to each of
 * their devices — so a blocked or missed push loses nothing; the app shows it
 * next time it opens. Telegram still gets a copy while the bot exists, for
 * people who linked it.
 *
 * Nothing addresses a raw id: Telegram goes through the linked chat lookup
 * (users.id stopped being a chat id with email accounts in v12).
 */

/** Doubles as the Android notification channel id — the app creates these. */
export type NoticeKind = "daily" | "spend" | "alerts" | "digest";

export interface Notice {
  kind: NoticeKind;
  title: string;
  /** Plain text — what the phone shows. */
  body: string;
  /** Telegram-formatted version, when there is a richer one. */
  html?: string;
  /** Delivered to the app with the push (≤ ~3 KB). */
  data?: Record<string, unknown>;
}

export interface NotifyOptions {
  /** false when the Telegram chat already shows this (e.g. inside a bot reply). */
  telegram?: boolean;
}

const TITLES: Record<NoticeKind, string> = {
  daily: "Daily budget",
  spend: "New spend",
  alerts: "Heads up",
  digest: "Your month",
};

/**
 * A plain Telegram-HTML string from an older call site: the first short line
 * becomes the title, the rest the body.
 */
export function noticeFromHtml(html: string, kind: NoticeKind = "alerts"): Notice {
  const plain = htmlToPlain(html);
  const [first, ...rest] = plain.split("\n");
  const body = rest.join("\n").trim();
  return first.length <= 70 && body
    ? { kind, title: first, body, html }
    : { kind, title: TITLES[kind], body: plain, html };
}

export async function notify(
  supabase: SupabaseClient,
  userId: number,
  input: Notice | string,
  options: NotifyOptions = {},
): Promise<boolean> {
  const notice = typeof input === "string" ? noticeFromHtml(input) : input;
  const [inboxId, telegram] = await Promise.all([
    storeInInbox(supabase, userId, notice),
    options.telegram === false
      ? false
      : notifyTelegram(
          supabase,
          userId,
          notice.html ?? escapeHtml(`${notice.title}\n${notice.body}`),
        ),
  ]);
  // The push carries the inbox id, so a tap can open that exact notice.
  const pushed = await pushToDevices(supabase, userId, notice, inboxId);
  return Boolean(inboxId) || pushed > 0 || telegram;
}

/** Several notices to one user, in order. Returns how many reached at least one channel. */
export async function notifyAll(
  supabase: SupabaseClient,
  userId: number,
  notices: Array<Notice | string>,
  options: NotifyOptions = {},
): Promise<number> {
  let delivered = 0;
  for (const n of notices) if (await notify(supabase, userId, n, options)) delivered++;
  return delivered;
}

/**
 * Telegram only — for the bot's own chat replies, which belong in the chat
 * and nowhere else.
 */
export async function notifyTelegram(
  supabase: SupabaseClient,
  userId: number,
  html: string,
): Promise<boolean> {
  const chatId = await telegramChatId(supabase, userId);
  if (!chatId) return false; // no Telegram linked — nothing to do, and that's fine
  try {
    await sendMessage(chatId, html);
    return true;
  } catch (err) {
    console.error("telegram notify failed", err);
    return false;
  }
}

async function storeInInbox(
  supabase: SupabaseClient,
  userId: number,
  n: Notice,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        kind: n.kind,
        title: n.title.slice(0, 120),
        body: n.body.slice(0, 2000),
        data: n.data ?? {},
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  } catch (err) {
    console.error("inbox insert failed (v15 migration applied?)", err);
    return null;
  }
}

async function pushToDevices(
  supabase: SupabaseClient,
  userId: number,
  n: Notice,
  inboxId: string | null,
): Promise<number> {
  try {
    const { data: tokens, error } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId)
      .eq("active", true);
    if (error) throw error;
    if (!tokens?.length) return 0;

    const result = await sendExpoPush(
      tokens.map((t) => ({
        to: t.token as string,
        title: n.title,
        // Phones show ~4 lines; the inbox has the rest.
        body: n.body.length > 400 ? `${n.body.slice(0, 397)}…` : n.body,
        data: { ...n.data, kind: n.kind, notificationId: inboxId },
        channelId: n.kind,
        sound: n.kind === "spend" ? undefined : "default",
        priority: n.kind === "alerts" ? "high" : "default",
      })),
    );
    if (result.deadTokens.length) {
      await supabase
        .from("push_tokens")
        .update({ active: false })
        .in("token", result.deadTokens);
    }
    return result.sent;
  } catch (err) {
    console.error("push failed (v15 migration applied?)", err);
    return 0;
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
