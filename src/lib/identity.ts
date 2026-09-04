import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Who a user is, separated from how we reach them (v12).
 *
 * `users.id` stays the internal key everything else references. What changes
 * is that it's no longer *also* the Telegram chat id: an account can exist
 * with an email and no Telegram at all, and a Telegram chat can be attached
 * to an account later.
 *
 * Every notification path must go through `telegramChatId()` rather than
 * assuming the user id is a chat id — for an email-only user there is no
 * chat, and sending to their user id would post into a stranger's chat or
 * nowhere at all.
 */

export interface UserRecord {
  id: number;
  email: string | null;
  telegram_id: number | null;
  display_name: string | null;
  first_name: string | null;
  username: string | null;
  consent_at: string | null;
  deleted_at: string | null;
}

const USER_COLUMNS =
  "id, email, telegram_id, display_name, first_name, username, consent_at, deleted_at";

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Loose on purpose: the code we send is the real check. */
export function isEmailShaped(raw: string): boolean {
  const email = normaliseEmail(raw);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

/** A person's name for greetings, from whichever identity they signed up with. */
export function displayNameOf(
  user: Pick<UserRecord, "display_name" | "first_name" | "username" | "email">,
): string {
  if (user.display_name?.trim()) return user.display_name.trim();
  if (user.first_name?.trim()) return user.first_name.trim();
  if (user.username?.trim()) return user.username.trim();
  if (user.email) return user.email.split("@")[0];
  return "You";
}

export async function getUser(
  supabase: SupabaseClient,
  userId: number,
): Promise<UserRecord | null> {
  const { data, error } = await supabase
    .from("users")
    .select(USER_COLUMNS)
    .eq("id", userId)
    .limit(1);
  if (error) {
    // Pre-v12 schema: fall back to the columns that have always existed.
    const legacy = await supabase
      .from("users")
      .select("id, first_name, username")
      .eq("id", userId)
      .limit(1);
    const row = legacy.data?.[0] as
      | { id: number; first_name: string | null; username: string | null }
      | undefined;
    return row
      ? {
          ...row,
          email: null,
          telegram_id: row.id, // pre-v12, the id was the chat id
          display_name: null,
          consent_at: null,
          deleted_at: null,
        }
      : null;
  }
  return (data?.[0] as UserRecord) ?? null;
}

/**
 * Where to send this user a Telegram message, or null when they never linked
 * one. Callers must treat null as "this person doesn't use Telegram" and stay
 * silent rather than guessing.
 */
export async function telegramChatId(
  supabase: SupabaseClient,
  userId: number,
): Promise<number | null> {
  const user = await getUser(supabase, userId);
  if (!user) return null;
  if (user.deleted_at) return null;
  return user.telegram_id ?? null;
}

export async function findUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<UserRecord | null> {
  const { data, error } = await supabase
    .from("users")
    .select(USER_COLUMNS)
    .ilike("email", normaliseEmail(email))
    .limit(1);
  if (error) throw error;
  const user = (data?.[0] as UserRecord) ?? null;
  return user?.deleted_at ? null : user;
}

/**
 * Sign-in by email: return the existing account or create one.
 *
 * The id comes from a sequence in a range Telegram ids never reach, so an
 * email account and a Telegram account can never collide.
 */
export async function findOrCreateEmailUser(
  supabase: SupabaseClient,
  email: string,
): Promise<{ user: UserRecord; created: boolean }> {
  const existing = await findUserByEmail(supabase, email);
  if (existing) return { user: existing, created: false };

  const { data: idRow, error: seqError } =
    await supabase.rpc("next_app_user_id");
  let id: number;
  if (seqError || idRow == null) {
    // No RPC (it's optional): derive an id in the same reserved range.
    id = 9_000_000_000_000 + Math.floor(Math.random() * 1_000_000_000);
  } else {
    id = Number(idRow);
  }

  const { data, error } = await supabase
    .from("users")
    .insert({
      id,
      email: normaliseEmail(email),
      consent_at: new Date().toISOString(),
    })
    .select(USER_COLUMNS)
    .single();
  if (error) throw error;
  return { user: data as UserRecord, created: true };
}

/** Attach a Telegram chat to an account, so notifications can reach it. */
export async function linkTelegram(
  supabase: SupabaseClient,
  userId: number,
  chatId: number,
  profile: { first_name?: string | null; username?: string | null } = {},
): Promise<boolean> {
  const { error } = await supabase
    .from("users")
    .update({
      telegram_id: chatId,
      first_name: profile.first_name ?? undefined,
      username: profile.username ?? undefined,
    })
    .eq("id", userId);
  if (error) {
    console.error("linkTelegram failed", error);
    return false;
  }
  return true;
}

/** The account a Telegram chat belongs to, if any. */
export async function userByTelegramChat(
  supabase: SupabaseClient,
  chatId: number,
): Promise<UserRecord | null> {
  const { data, error } = await supabase
    .from("users")
    .select(USER_COLUMNS)
    .eq("telegram_id", chatId)
    .limit(1);
  if (error) throw error;
  const user = (data?.[0] as UserRecord) ?? null;
  return user?.deleted_at ? null : user;
}

// ── Linking a Telegram chat to an existing account ─────────────────────────

/** Six characters, no ambiguous glyphs — this gets read off a screen. */
const LINK_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateLinkCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += LINK_ALPHABET[Math.floor(Math.random() * LINK_ALPHABET.length)];
  }
  return code;
}

/** Pure: is this shaped like a link code at all? Saves a database round trip. */
export function isLinkCodeShaped(raw: string): boolean {
  const code = raw.trim().toUpperCase();
  return code.length === 6 && [...code].every((c) => LINK_ALPHABET.includes(c));
}

export async function issueLinkCode(
  supabase: SupabaseClient,
  userId: number,
): Promise<string | null> {
  const code = generateLinkCode();
  const expires = new Date(Date.now() + 15 * 60_000).toISOString();
  try {
    // One live code per account: asking again invalidates the last one.
    await supabase.from("link_codes").delete().eq("user_id", userId);
    const { error } = await supabase
      .from("link_codes")
      .insert({ code, user_id: userId, expires_at: expires });
    if (error) throw error;
    return code;
  } catch (err) {
    console.error("issueLinkCode failed (v12 migration applied?)", err);
    return null;
  }
}

/**
 * Redeem a code sent to the bot, attaching that chat to the account.
 * Returns the account id on success.
 */
export async function redeemLinkCode(
  supabase: SupabaseClient,
  code: string,
  chatId: number,
  profile: { first_name?: string | null; username?: string | null } = {},
): Promise<{ ok: true; userId: number } | { ok: false; reason: string }> {
  const key = code.trim().toUpperCase();
  if (!isLinkCodeShaped(key))
    return { ok: false, reason: "That code doesn't look right." };

  try {
    const { data, error } = await supabase
      .from("link_codes")
      .select("code, user_id, expires_at, used_at")
      .eq("code", key)
      .limit(1);
    if (error) throw error;
    const row = data?.[0] as
      | { user_id: number; expires_at: string; used_at: string | null }
      | undefined;

    if (!row) return { ok: false, reason: "That code isn't valid." };
    if (row.used_at)
      return { ok: false, reason: "That code has already been used." };
    if (Date.parse(row.expires_at) < Date.now())
      return {
        ok: false,
        reason: "That code has expired — generate a new one in the app.",
      };

    // A chat can only belong to one account.
    const taken = await userByTelegramChat(supabase, chatId);
    if (taken && taken.id !== row.user_id)
      return {
        ok: false,
        reason: "This Telegram account is already linked elsewhere.",
      };

    await linkTelegram(supabase, row.user_id, chatId, profile);
    await supabase
      .from("link_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("code", key);
    return { ok: true, userId: row.user_id };
  } catch (err) {
    console.error("redeemLinkCode failed", err);
    return { ok: false, reason: "Couldn't link right now — try again." };
  }
}

/**
 * The account a Telegram message belongs to.
 *
 * Existing users have id == chat id, so they resolve to themselves. Someone
 * who signed up by email and linked this chat resolves to their real account,
 * which is what stops a second, duplicate account being created for them.
 */
export async function resolveTelegramUserId(
  supabase: SupabaseClient,
  chatId: number,
): Promise<number> {
  const linked = await userByTelegramChat(supabase, chatId);
  return linked?.id ?? chatId;
}
