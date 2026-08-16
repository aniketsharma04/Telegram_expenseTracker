import { NextResponse } from "next/server";
import { parseExpense, CategoryRule } from "@/lib/parser";
import { sendMessage, TelegramUpdate } from "@/lib/telegram";
import { createServiceClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const HELP_TEXT = [
  "Just text me an expense and I'll log it. Examples:",
  "",
  "• <code>300 zomato</code>",
  "• <code>400 metro card</code>",
  "• <code>spent 1.2k on groceries yesterday</code>",
  "",
  "I pull out the amount, guess the category from the merchant, and it shows up on your dashboard within seconds.",
].join("\n");

/** Always answer 200 so Telegram doesn't endlessly retry a message we already saw. */
function ok() {
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  // Telegram echoes back the secret we registered the webhook with.
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (
    !process.env.TELEGRAM_WEBHOOK_SECRET ||
    secret !== process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return ok();
  }

  const message = update.message;
  const text = message?.text?.trim();
  if (!message || !text) return ok(); // ignore stickers, edits, etc. in v1

  const chatId = message.chat.id;

  // Single-user tool: silently ignore anyone who isn't the owner.
  const allowed = process.env.TELEGRAM_ALLOWED_CHAT_ID;
  if (allowed && String(chatId) !== allowed) return ok();

  try {
    if (text === "/start" || text === "/help") {
      await sendMessage(chatId, HELP_TEXT);
      return ok();
    }

    const supabase = createServiceClient();

    const { data: categories, error: catError } = await supabase
      .from("categories")
      .select("name, keywords");
    if (catError) throw catError;

    const parsed = parseExpense(text, (categories ?? []) as CategoryRule[]);

    if (!parsed.ok) {
      await sendMessage(
        chatId,
        "I couldn't find an amount in that. Try something like <code>300 zomato</code>.",
      );
      return ok();
    }

    const category = parsed.category ?? "Uncategorized";
    const { error: insertError } = await supabase.from("expenses").insert({
      amount: parsed.amount,
      category,
      merchant: parsed.merchant,
      raw_message: text,
      source: "telegram_text",
      parsed_by: "rules",
      expense_date: parsed.expenseDate,
    });
    if (insertError) throw insertError;

    const amountStr = `₹${parsed.amount!.toLocaleString("en-IN")}`;
    const merchantStr = parsed.merchant ? ` (${parsed.merchant})` : "";
    const dateStr =
      parsed.expenseDate !== todayIST() ? ` on ${parsed.expenseDate}` : "";
    await sendMessage(
      chatId,
      `✅ Logged ${amountStr} · ${category}${merchantStr}${dateStr}`,
    );
  } catch (err) {
    // Log for visibility (Vercel function logs), but still tell the user —
    // a silent failure means an expense they think is logged, isn't.
    console.error("webhook error", err);
    try {
      await sendMessage(
        chatId,
        "⚠️ Something went wrong — that expense was NOT logged. Try again in a minute.",
      );
    } catch {
      // nothing more we can do
    }
  }
  return ok();
}

function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
