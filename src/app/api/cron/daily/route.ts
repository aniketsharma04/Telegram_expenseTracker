import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { localDate } from "@/lib/parser";
import { detectRecurring } from "@/lib/insights";
import { composeMonthlyDigest } from "@/lib/digest";
import { sendMessage } from "@/lib/telegram";
import { loadBillStatuses, reminderText } from "@/lib/bills";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOOKBACK_DAYS = 190;
const REMIND_DAYS_AHEAD = 2;

/**
 * Daily cron (Vercel, 03:30 UTC = 09:00 IST):
 *  - every day: remind users of recurring charges due in 2 days
 *  - every day: bill reminders at T-3, due day, and 2 days overdue
 *  - on the 1st: send everyone their month-in-review digest
 * Stateless dedup: a reminder fires only on the exact day daysUntil == 2.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const secret =
    process.env.CRON_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = localDate();
  const isFirstOfMonth = today.slice(8) === "01";

  const { data: users, error } = await supabase.from("users").select("id");
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  let reminders = 0;
  let billReminders = 0;
  let digests = 0;
  const failures: number[] = [];

  for (const user of users ?? []) {
    const userId = user.id as number;
    try {
      const { data: expenses, error: expError } = await supabase
        .from("expenses")
        .select("amount, category, merchant, expense_date")
        .eq("user_id", userId)
        .gte("expense_date", localDate(LOOKBACK_DAYS));
      if (expError) throw expError;

      for (const charge of detectRecurring(expenses ?? [], today)) {
        if (charge.daysUntil !== REMIND_DAYS_AHEAD) continue;
        await sendMessage(
          userId,
          `🔁 Heads up: <b>${charge.merchant}</b> (~₹${charge.amount.toLocaleString("en-IN")}, ${charge.category}) usually hits around the ${Number(charge.nextDate.slice(8))}th — that's in ${REMIND_DAYS_AHEAD} days.`,
        );
        reminders++;
      }

      for (const status of await loadBillStatuses(supabase, userId, today)) {
        const text = reminderText(status);
        if (!text) continue;
        await sendMessage(
          userId,
          text.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
        );
        billReminders++;
      }

      if (isFirstOfMonth) {
        const digest = await composeMonthlyDigest(supabase, userId, today);
        if (digest) {
          await sendMessage(userId, digest);
          digests++;
        }
      }
    } catch (err) {
      console.error(`cron failed for user ${userId}`, err);
      failures.push(userId);
    }
  }

  return NextResponse.json({
    ok: true,
    today,
    users: users?.length ?? 0,
    reminders,
    billReminders,
    digests,
    failures,
  });
}
