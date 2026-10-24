import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "./supabase-server";
import { notify } from "./notify";
import { localDate } from "./parser";
import { getUser } from "./identity";
import { loadDailyStatus, plannedUsers } from "./plan";
import {
  eveningReport,
  morningBrief,
  spendLine,
  type DailyStatus,
} from "./daily-budget";

/**
 * The two scheduled daily-budget messages (v14), and the live per-spend ping.
 * Only users who set up a plan get the scheduled ones — the plan row is the
 * opt-in, and its switches turn each message off.
 */

export function cronAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const secret =
    process.env.CRON_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.TELEGRAM_WEBHOOK_SECRET;
  return Boolean(secret) && auth === secret;
}

export async function runBriefs(
  req: NextRequest,
  slot: "morning" | "evening",
): Promise<NextResponse> {
  if (!cronAuthorized(req))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const today = localDate();
  let sent = 0;
  const failures: number[] = [];

  for (const plan of await plannedUsers(supabase)) {
    if (slot === "morning" && !plan.morning_brief) continue;
    if (slot === "evening" && !plan.evening_report) continue;
    const userId = Number(plan.user_id);
    try {
      const text =
        slot === "morning"
          ? await composeMorning(supabase, userId, today)
          : eveningReport((await loadDailyStatus(supabase, userId, today)).status, today);
      if (await notify(supabase, userId, text)) sent++;
    } catch (err) {
      console.error(`${slot} brief failed for user ${userId}`, err);
      failures.push(userId);
    }
  }
  return NextResponse.json({ ok: true, slot, today, sent, failures });
}

async function composeMorning(
  supabase: SupabaseClient,
  userId: number,
  today: string,
): Promise<string> {
  const [{ status }, user] = await Promise.all([
    loadDailyStatus(supabase, userId, today),
    getUser(supabase, userId),
  ]);
  // Yesterday's line only within the same month — on the 1st, last month is the digest's job.
  const yesterday = status.history.length >= 2 ? status.history[status.history.length - 2] : null;
  return morningBrief(status, user?.display_name ?? user?.first_name ?? null, yesterday);
}

/**
 * After new expenses land: one message with a line per spend and where the
 * day stands. Silent for users without a plan, or with live updates off.
 */
export async function pingSpends(
  supabase: SupabaseClient,
  userId: number,
  expenseIds: string[],
): Promise<void> {
  if (!expenseIds.length) return;
  try {
    const { status, plan } = await loadDailyStatus(supabase, userId);
    if (!plan || !plan.live_updates || !status.ready) return;
    const text = spendMessage(status, expenseIds);
    if (text) await notify(supabase, userId, text);
  } catch (err) {
    console.error("spend ping failed", err);
  }
}

/** The spend lines for these ids, against today's status. Older-dated spends are skipped. */
export function spendMessage(status: DailyStatus, expenseIds: string[]): string | null {
  const lines = status.today
    .filter((e) => e.id && expenseIds.includes(e.id))
    .map((e) => spendLine(e, status));
  return lines.length ? lines.join("\n\n") : null;
}
