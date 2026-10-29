import { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "./supabase-server";
import type { TelegramMessage } from "./telegram";

/**
 * v3 multi-user: users register implicitly on first message; a user can
 * belong to at most one family. Family data is always derived by aggregating
 * members' individual expenses — never stored separately.
 */

export interface FamilyInfo {
  id: string;
  name: string;
  invite_code: string;
  role: string;
}

export interface FamilyMember {
  id: number;
  name: string;
}

/** Register/refresh the sender — open registration, called on every message. */
export async function ensureUser(
  message: TelegramMessage,
  chatId: number,
): Promise<void> {
  const supabase = createServiceClient();
  // v12: an account that arrived via email may already exist for this person,
  // linked to this chat. Update that row rather than creating a second one.
  const { data: linked } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", chatId)
    .limit(1);
  const existingId = (linked?.[0] as { id: number } | undefined)?.id;

  const profile = {
    first_name: message.from?.first_name ?? null,
    username: message.from?.username ?? null,
    telegram_id: chatId,
  };

  const { error } = existingId
    ? await supabase.from("users").update(profile).eq("id", existingId)
    : await supabase
        .from("users")
        .upsert({ id: chatId, ...profile }, { onConflict: "id" });
  if (error) {
    // Pre-v12 schema has no telegram_id — fall back to the original shape.
    const { telegram_id: _dropped, ...legacy } = profile;
    const retry = await supabase
      .from("users")
      .upsert({ id: chatId, ...legacy }, { onConflict: "id" });
    if (retry.error) console.error("ensureUser failed", retry.error);
  }
}

export async function getFamily(
  supabase: SupabaseClient,
  userId: number,
): Promise<FamilyInfo | null> {
  const { data, error } = await supabase
    .from("family_members")
    .select("role, families(id, name, invite_code)")
    .eq("user_id", userId)
    .limit(1);
  if (error) throw error;
  const row = data?.[0] as unknown as
    | {
        role: string;
        families: { id: string; name: string; invite_code: string } | null;
      }
    | undefined;
  if (!row?.families) return null;
  return {
    id: row.families.id,
    name: row.families.name,
    invite_code: row.families.invite_code,
    role: row.role,
  };
}

export async function familyMembers(
  supabase: SupabaseClient,
  familyId: string,
): Promise<FamilyMember[]> {
  const { data, error } = await supabase
    .from("family_members")
    .select("user_id, users(first_name, username)")
    .eq("family_id", familyId);
  if (error) throw error;
  return (
    (data ?? []) as unknown as Array<{
      user_id: number;
      users: { first_name: string | null; username: string | null } | null;
    }>
  ).map((r) => ({
    id: r.user_id,
    name: r.users?.first_name || r.users?.username || `User ${r.user_id}`,
  }));
}

/** Unambiguous alphabet (no 0/O, 1/I/L) so codes survive being read aloud. */
function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let code = "";
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return code;
}

export function inviteLink(code: string): string {
  const bot =
    process.env.TELEGRAM_BOT_USERNAME || "Aniket_financial_expense_bot";
  return `https://t.me/${bot}?start=fam_${code}`;
}

export async function createFamily(
  supabase: SupabaseClient,
  ownerId: number,
  name: string,
): Promise<FamilyInfo> {
  const invite_code = generateInviteCode();
  const { data, error } = await supabase
    .from("families")
    .insert({ name, owner_id: ownerId, invite_code })
    .select("id, name, invite_code")
    .single();
  if (error) throw error;
  const { error: memberError } = await supabase
    .from("family_members")
    .insert({ family_id: data.id, user_id: ownerId, role: "owner" });
  if (memberError) throw memberError;
  return {
    id: data.id,
    name: data.name,
    invite_code: data.invite_code,
    role: "owner",
  };
}

export async function joinFamilyByCode(
  supabase: SupabaseClient,
  userId: number,
  code: string,
): Promise<{ joined: boolean; message: string }> {
  const { data, error } = await supabase
    .from("families")
    .select("id, name")
    .eq("invite_code", code.toUpperCase())
    .limit(1);
  if (error) throw error;
  const family = data?.[0];
  if (!family) {
    return {
      joined: false,
      message:
        "That invite link doesn't match any family. Ask for a fresh one.",
    };
  }

  const existing = await getFamily(supabase, userId);
  if (existing) {
    if (existing.id === family.id) {
      return {
        joined: false,
        message: `You're already a member of <b>${family.name}</b> 👍`,
      };
    }
    return {
      joined: false,
      message: `You're already in <b>${existing.name}</b>. It's one family per person for now.`,
    };
  }

  const { error: joinError } = await supabase
    .from("family_members")
    .insert({ family_id: family.id, user_id: userId, role: "member" });
  if (joinError) throw joinError;
  return {
    joined: true,
    message: `👨‍👩‍👧 Welcome to <b>${family.name}</b>! Your expenses now count toward the family total too. Try <code>/family</code> anytime.`,
  };
}
