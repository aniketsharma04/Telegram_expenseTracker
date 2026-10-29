import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "./supabase-server";
import { notify, type Notice } from "./notify";
import { localDate } from "./parser";
import { getUser } from "./identity";
import { loadDailyStatus, plannedUsers } from "./plan";
import { creditGoals, cycleCredits, goalOutlook } from "./goals";
import {
  eveningPush,
  eveningReport,
  inr,
  morningBrief,
  morningPush,
  spendLine,
  spendPush,
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
    const userId = Number(plan.user_id);
    try {
      // A new budget month credits the goals — even with the brief switched off.
      const goalLines =
        slot === "morning" ? await closeLastMonth(supabase, userId, today) : [];
      if (slot === "morning" && !plan.morning_brief) continue;
      if (slot === "evening" && !plan.evening_report) continue;
      const notice =
        slot === "morning"
          ? await composeMorning(supabase, userId, today)
          : await composeEvening(supabase, userId, today);
      if (goalLines.length) {
        const lines = goalLines.join("\n");
        notice.body += `\n${lines}`;
        if (notice.html) notice.html += `\n\n${lines}`;
      }
      if (await notify(supabase, userId, notice)) sent++;
    } catch (err) {
      console.error(`${slot} brief failed for user ${userId}`, err);
      failures.push(userId);
    }
  }
  return NextResponse.json({ ok: true, slot, today, sent, failures });
}

/**
 * On the first day of a budget month: credit each goal for the month that
 * just ended (once — goal_credits dedupes) and say what moved.
 */
async function closeLastMonth(
  supabase: SupabaseClient,
  userId: number,
  today: string,
): Promise<string[]> {
  const { status, goals } = await loadDailyStatus(supabase, userId, today);
  if (status.dayOfMonth !== 1 || !status.ready || !goals.length) return [];
  const lastDay = new Date(
    Date.parse(`${status.cycleStart}T00:00:00Z`) - 86_400_000,
  )
    .toISOString()
    .slice(0, 10);
  const last = (await loadDailyStatus(supabase, userId, lastDay)).status;
  const applied = await creditGoals(
    supabase,
    goals,
    cycleCredits(goals, last.poolLeft, last.cycleEnd),
    last.cycleStart,
  );
  return applied
    .filter((a) => a.amount > 0)
    .map(({ goal, amount }) =>
      goal.saved >= goal.target_amount
        ? `🎉 ${goal.name} reached: ${inr(goal.target_amount)} saved!`
        : `🎯 ${inr(amount)} → ${goal.name} (${goalOutlook(goal, today).pct}%)`,
    );
}

async function composeMorning(
  supabase: SupabaseClient,
  userId: number,
  today: string,
): Promise<Notice> {
  const [{ status }, user] = await Promise.all([
    loadDailyStatus(supabase, userId, today),
    getUser(supabase, userId),
  ]);
  // Yesterday's line only within the same month — on the 1st, last month is the digest's job.
  const yesterday =
    status.history.length >= 2
      ? status.history[status.history.length - 2]
      : null;
  return {
    kind: "daily",
    ...morningPush(status, yesterday),
    html: morningBrief(
      status,
      user?.display_name ?? user?.first_name ?? null,
      yesterday,
    ),
    data: { screen: "home" },
  };
}

async function composeEvening(
  supabase: SupabaseClient,
  userId: number,
  today: string,
): Promise<Notice> {
  const { status } = await loadDailyStatus(supabase, userId, today);
  return {
    kind: "daily",
    ...eveningPush(status),
    html: eveningReport(status, today),
    data: { screen: "home" },
  };
}

/** A flushed offline queue can carry many spends — past this, one summary instead of a push each. */
const MAX_SPEND_PUSHES = 3;

/**
 * After new expenses land: a push per spend saying where the day stands.
 * Silent for users without a plan, or with live updates off.
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
    const spends = status.today.filter(
      (e) => e.id && expenseIds.includes(e.id),
    );
    if (!spends.length) return;

    if (spends.length > MAX_SPEND_PUSHES) {
      const total = spends.reduce((sum, e) => sum + e.dailyAmount, 0);
      await notify(supabase, userId, {
        kind: "spend",
        title: `${spends.length} spends captured · ${inr(total)}`,
        body:
          status.todayLeft >= 0
            ? `${inr(status.todayLeft)} left today of ${inr(status.todayBudget)}`
            : `${inr(-status.todayLeft)} over today's ${inr(status.todayBudget)}`,
        html: spendMessage(status, expenseIds) ?? undefined,
        data: { screen: "home" },
      });
      return;
    }
    for (const e of spends) {
      const { bigSpend, ...text } = spendPush(e, status);
      await notify(supabase, userId, {
        kind: "spend",
        ...text,
        html: spendLine(e, status),
        // The app offers "Paid from savings" right on a big one.
        data: { screen: "home", expenseId: e.id, bigSpend },
      });
    }
  } catch (err) {
    console.error("spend ping failed", err);
  }
}

/** The spend lines for these ids, against today's status. Older-dated spends are skipped. */
export function spendMessage(
  status: DailyStatus,
  expenseIds: string[],
): string | null {
  const lines = status.today
    .filter((e) => e.id && expenseIds.includes(e.id))
    .map((e) => spendLine(e, status));
  return lines.length ? lines.join("\n\n") : null;
}
