import { SupabaseClient } from "@supabase/supabase-js";
import { isExpoToken } from "./push";

/**
 * The app side of notifications (v15): device registration and the inbox.
 * Delivery lives in notify.ts.
 */

export interface InboxItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

/**
 * Remember this device for this user. A token belongs to one device, so
 * registering it again — even after someone else logs in on the same phone —
 * moves it to whoever is signed in now.
 */
export async function registerPushToken(
  supabase: SupabaseClient,
  userId: number,
  token: string,
  platform: "android" | "ios",
): Promise<boolean> {
  if (!isExpoToken(token)) return false;
  const { error } = await supabase.from("push_tokens").upsert(
    {
      token,
      user_id: userId,
      platform,
      active: true,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (error) throw error;
  return true;
}

/** On logout: this device stops getting this user's notices. */
export async function unregisterPushToken(
  supabase: SupabaseClient,
  userId: number,
  token: string,
): Promise<void> {
  const { error } = await supabase
    .from("push_tokens")
    .delete()
    .eq("token", token)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function listInbox(
  supabase: SupabaseClient,
  userId: number,
  limit = 50,
): Promise<InboxItem[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, kind, title, body, data, created_at, read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as InboxItem[];
  } catch (err) {
    console.error("listInbox failed (v15 migration applied?)", err);
    return [];
  }
}

export async function unreadCount(
  supabase: SupabaseClient,
  userId: number,
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) throw error;
    return count ?? 0;
  } catch {
    return 0; // pre-v15: nothing to show
  }
}

/** Mark some (or, with no ids, all) of the user's notices read. */
export async function markRead(
  supabase: SupabaseClient,
  userId: number,
  ids?: string[],
): Promise<void> {
  let q = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) throw error;
}
