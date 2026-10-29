import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  localDate,
  CategoryRule,
  parseExpense,
  extractAmount,
} from "@/lib/parser";
import { parseReceipt } from "@/lib/llm";
import {
  logExpenseFromText,
  logSplitExpense,
  deleteExpenseScoped,
  insertExpense,
  learnKeyword,
  loadCategories,
} from "@/lib/log-expense";
import {
  getBudgets,
  setBudget,
  removeBudget,
  collectBudgetAlerts,
  deliverBudgetAlerts,
} from "@/lib/budgets";
import { budgetProgress, NON_SPEND_CATEGORIES } from "@/lib/insights";
import { logIncome, getIncomes } from "@/lib/income";
import { loadBillStatuses, markBillPaid } from "@/lib/bills";
import { transcribeVoice, voiceConfigured } from "@/lib/voice";
import {
  sendMessage,
  downloadTelegramFile,
  TelegramUpdate,
  TelegramMessage,
} from "@/lib/telegram";
import { createServiceClient } from "@/lib/supabase-server";
import { signToken } from "@/lib/auth";
import {
  ensureUser,
  getFamily,
  familyMembers,
  createFamily,
  joinFamilyByCode,
  inviteLink,
} from "@/lib/family";
import { looksLikeBankMessage } from "@/lib/bank-message";
import { ingestBankMessage } from "@/lib/ingest";
import { redeemLinkCode, resolveTelegramUserId } from "@/lib/identity";
import { notify, notifyTelegram } from "@/lib/notify";
import { saveParsedReceipt } from "@/lib/receipts";
import { geminiConfigured, userGeminiKey } from "@/lib/ai-keys";
import type { Expense } from "@/lib/types";
import {
  addCommitment,
  getPlan,
  loadDailyStatus,
  removeCommitment,
  savePlan,
  setBudgetScope,
  suggestCommitments,
} from "@/lib/plan";
import { spendMessage } from "@/lib/briefs";
import { eveningReport, inr, SETUP_HINT } from "@/lib/daily-budget";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // LLM + transcription calls need more than the default

const HELP_TEXT = [
  "Just text me an expense and I'll log it. Examples:",
  "",
  "• <code>300 zomato</code>",
  "• <code>spent 1.2k on groceries yesterday</code>",
  "• 🎤 a voice note works too",
  "",
  "Fixing mistakes (applies to the last entry):",
  "• <code>/undo</code>: delete it",
  "• <code>/category food</code>: change its category",
  "• <code>/amount 350</code>: change its amount",
  "• <code>/last</code>: show it",
  "",
  "Reports:",
  "• <code>/expense</code>: spent this month",
  "• <code>/invest</code>: invested this month",
  "• <code>/emi</code>: loans &amp; EMI this month",
  "• <code>/dashboard</code>: web dashboard link",
  "• <code>/status</code>: check bot configuration",
  "",
  "Family:",
  "• <code>/family create Sharma Family</code>: start a family",
  "• <code>/invite</code>: get a link to add members",
  "• <code>/family</code>: this month's family report",
  "• <code>/split 1200 dinner</code>: split a bill equally with your family",
  "",
  "Money habits:",
  "• <code>/budget 15000</code>: overall monthly cap (alerts at 80% and 100%)",
  "• <code>/budget groceries 3000</code>: cap one category",
  "• <code>/budget</code>: see how the month is tracking",
  "• <code>/income 50000 salary</code>: log income · <code>/income</code>: see savings",
  "",
  "Daily budget:",
  "• <code>/plan 100000</code>: monthly income · <code>/plan save 15000</code>: savings goal",
  "• <code>/plan payday 30</code>: budget months run salary to salary",
  "• <code>/fixed rent 25000</code>: a fixed monthly cost (kept out of the daily number)",
  "• <code>/fixed</code>: list them · <code>/fixed remove rent</code>: remove one",
  "• <code>/today</code>: what's left today",
  "• <code>/fromsavings</code>: last spend came from savings, not today's budget",
  "• <code>/plan morning off</code> · <code>evening off</code> · <code>live off</code>: mute a message",
].join("\n");

/**
 * Reply in the Telegram chat. Chat only — replies don't belong in the app
 * inbox or on the phone's lock screen; real notices go through notify().
 */
async function reply(userId: number, text: string): Promise<void> {
  await notifyTelegram(createServiceClient(), userId, text);
}

function ok() {
  return NextResponse.json({ ok: true });
}

function fmtINR(n: number): string {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function confirmText(e: {
  amount: number;
  category: string;
  merchant: string | null;
  expense_date: string;
}): string {
  const merchant = e.merchant ? ` (${e.merchant})` : "";
  const date = e.expense_date !== localDate() ? ` on ${e.expense_date}` : "";
  return `✅ Added ${fmtINR(e.amount)} · ${e.category}${merchant}${date}`;
}

/** Running month totals for the sender (plus their family, if any) appended to every confirmation. */
async function monthlySummary(
  supabase: SupabaseClient,
  userId: number,
): Promise<string> {
  const monthStart = `${localDate().slice(0, 7)}-01`;
  const { data, error } = await supabase
    .from("expenses")
    .select("amount, category, user_id")
    .gte("expense_date", monthStart);
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    amount: number;
    category: string;
    user_id: number | null;
  }>;

  let spent = 0;
  let invested = 0;
  for (const r of rows) {
    if (r.user_id !== userId) continue;
    if (r.category === "Investments") invested += Number(r.amount);
    else spent += Number(r.amount);
  }

  let familyLine = "";
  const family = await getFamily(supabase, userId);
  if (family) {
    const members = await familyMembers(supabase, family.id);
    const memberIds = new Set(members.map((m) => m.id));
    const familySpent = rows
      .filter(
        (r) =>
          r.user_id !== null &&
          memberIds.has(r.user_id) &&
          r.category !== "Investments",
      )
      .reduce((s, r) => s + Number(r.amount), 0);
    familyLine = `\n👨‍👩‍👧 ${family.name}: ${fmtINR(familySpent)} this month`;
  }

  return `\n📊 Spent this month: ${fmtINR(spent)}\n📈 Invested this month: ${fmtINR(invested)}${familyLine}`;
}

/** Health/config check — booleans only, no secrets. Lets us verify env wiring in production. */
export async function GET() {
  // Validate the bot token against Telegram itself — a wrong token here means
  // replies and voice-file downloads silently fail while text logging works.
  let telegram = "missing";
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`,
      );
      const body = (await res.json()) as {
        ok: boolean;
        result?: { username?: string };
      };
      telegram = body.ok
        ? `ok (@${body.result?.username})`
        : `INVALID (HTTP ${res.status})`;
    } catch {
      telegram = "unreachable";
    }
  }
  return NextResponse.json({
    ok: true,
    version: "v3.1",
    telegram,
    llm: geminiConfigured()
      ? "gemini"
      : process.env.ANTHROPIC_API_KEY
        ? "claude"
        : "none",
    voice: Boolean(process.env.GROQ_API_KEY),
    db: Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  });
}

export async function POST(req: Request) {
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

  const message = update.message; // edits are handled via /undo & /category instead
  if (!message) return ok();

  // v3: open registration — anyone who messages the bot gets their own tracker.
  const chatId = message.chat.id;

  try {
    await ensureUser(message, chatId);
    // v12: a chat may belong to an account created by email, so the user id
    // is no longer always the chat id.
    const text = message.text?.trim();
    if (text && /^\/link\b/i.test(text)) {
      await handleLinkCommand(text, chatId, message);
      return ok();
    }
    // The chat may belong to an account created by email, so resolve it.
    const userId = await resolveTelegramUserId(createServiceClient(), chatId);
    await handleMessage(message, userId);
  } catch (err) {
    console.error("webhook error", err);
    try {
      await sendMessage(
        chatId,
        "⚠️ Something went wrong, so that message was NOT logged. Try again in a minute.",
      );
    } catch {
      // nothing more we can do
    }
  }
  return ok();
}

async function handleMessage(message: TelegramMessage, userId: number) {
  if (message.photo && message.photo.length > 0) {
    await handleReceiptPhoto(message, userId);
    return;
  }

  if (message.voice) {
    if (!voiceConfigured()) {
      await reply(
        userId,
        "🎤 Voice logging isn't set up yet (GROQ_API_KEY missing). Text me instead!",
      );
      return;
    }
    const audio = await downloadTelegramFile(message.voice.file_id);
    const transcript = audio
      ? await transcribeVoice(audio, message.voice.mime_type ?? "audio/ogg")
      : null;
    if (!transcript) {
      await reply(
        userId,
        "🎤 I couldn't make out that voice note. Try again or type it.",
      );
      return;
    }
    await handleExpenseText(
      transcript,
      userId,
      "telegram_voice",
      `\n🎤 <i>"${escapeHtml(transcript)}"</i>`,
    );
    return;
  }

  const text = message.text?.trim();
  if (!text) return;

  if (text.startsWith("/")) {
    await handleCommand(text, userId);
    return;
  }

  await handleExpenseText(text, userId, "telegram_text", "");
}

/**
 * `/link ABC123` — attach this chat to an account that was created by email,
 * so reminders and alerts can reach the person who owns it.
 */
async function handleLinkCommand(
  text: string,
  chatId: number,
  message: TelegramMessage,
) {
  const code = text.replace(/^\/link\s*/i, "").trim();
  if (!code) {
    await sendMessage(
      chatId,
      "Open the app → Settings → <b>Link Telegram</b>, then send me the code it shows, like <code>/link ABC123</code>.",
    );
    return;
  }

  const result = await redeemLinkCode(createServiceClient(), code, chatId, {
    first_name: message.from?.first_name ?? null,
    username: message.from?.username ?? null,
  });
  await sendMessage(
    chatId,
    result.ok
      ? "🔗 Linked. Reminders and alerts for your account will arrive here."
      : `⚠️ ${escapeHtml(result.reason)}`,
  );
}

// ── Receipt photos: download → Gemini vision → same pipeline ───────────────

async function handleReceiptPhoto(message: TelegramMessage, userId: number) {
  if (!geminiConfigured()) {
    await reply(
      userId,
      "📷 Receipt reading isn't set up yet (GEMINI_API_KEY missing). Text me the amount instead!",
    );
    return;
  }

  // Telegram sends several sizes; the last is the largest.
  const fileId = message.photo![message.photo!.length - 1].file_id;
  const image = await downloadTelegramFile(fileId);
  if (!image) {
    await reply(
      userId,
      "📷 I couldn't download that photo. Try sending it again.",
    );
    return;
  }

  const supabase = createServiceClient();
  const categories = await loadCategories(supabase);

  const caption = message.caption?.trim() || null;
  const parsed = await parseReceipt(
    image,
    "image/jpeg",
    caption,
    categories,
    localDate(),
    await userGeminiKey(supabase, userId),
  );

  if (!parsed || !parsed.amount || parsed.amount <= 0) {
    await reply(
      userId,
      parsed?.clarifying_question ??
        "📷 I couldn't read a total from that receipt. Try a clearer photo, or just type it like <code>300 zomato</code>.",
    );
    return;
  }

  const row = {
    amount: parsed.amount,
    category: parsed.category ?? "Uncategorized",
    merchant: parsed.merchant,
    expense_date: parsed.expense_date ?? localDate(),
  };
  const logged = await insertExpense(supabase, {
    ...row,
    user_id: userId,
    raw_message: caption ? `[photo] ${caption}` : "[photo]",
    source: "telegram_photo",
    parsed_by: "llm",
  });

  if (parsed.confidence === "high" && parsed.category && parsed.merchant) {
    await learnKeyword(supabase, categories, parsed.category, parsed.merchant);
  }

  // v10: keep the itemised bill behind the total.
  const receipt = await saveParsedReceipt(
    supabase,
    userId,
    logged.id,
    parsed,
    "telegram_photo",
  );
  const itemLine = receipt.items
    ? `
🧾 ${receipt.items} item${receipt.items === 1 ? "" : "s"} saved${receipt.reconciled ? "" : " (partial, check the total)"}`
    : "";

  const nudge =
    parsed.confidence === "low" || !parsed.category
      ? "\n🤔 Not sure about the category. Reply <code>/category &lt;name&gt;</code> to fix it."
      : "";
  const alerts = await collectBudgetAlerts(supabase, userId);
  // The chat reply carries them; the inbox and phone get them too.
  await deliverBudgetAlerts(supabase, userId, alerts, { telegram: false });
  await reply(
    userId,
    `📷 ${confirmText(row)}` +
      itemLine +
      (await monthlySummary(supabase, userId)) +
      nudge +
      (alerts.length ? `\n\n${alerts.map(escapeHtml).join("\n")}` : ""),
  );
}

// ── Expense pipeline: rules fast path → LLM fallback → clarify ─────────────

/**
 * v9: a forwarded bank SMS is not an expense message — it's a statement of
 * something that already happened, with the bank's own balance attached.
 * Route it to the capture pipeline instead of the expense parser.
 */
async function handleBankMessage(
  text: string,
  userId: number,
  suffix: string,
): Promise<boolean> {
  if (!looksLikeBankMessage(text)) return false;
  const supabase = createServiceClient();
  const result = await ingestBankMessage(supabase, userId, {
    body: text,
    source: "telegram",
  });
  if (result.status === "ignored") return false;

  const money = `₹${result.txn?.amount?.toLocaleString("en-IN") ?? ""}`;
  const where = result.accountName
    ? ` · ${escapeHtml(result.accountName)}`
    : "";
  const balance =
    result.balance != null
      ? `
Bank says balance: <b>₹${result.balance.toLocaleString("en-IN")}</b>`
      : "";
  const drift =
    result.drift != null && Math.abs(result.drift) >= 1
      ? `
⚠️ Off by ₹${Math.abs(result.drift).toLocaleString("en-IN")} from what's logged.`
      : "";
  const icon =
    result.status === "duplicate"
      ? "🔁"
      : result.txn?.direction === "credit"
        ? "📥"
        : "📤";

  await reply(
    userId,
    `${icon} <b>${money}</b>${where}
${escapeHtml(result.note)}${balance}${drift}` +
      suffix +
      (result.expenseId
        ? await dailySuffix(supabase, userId, result.expenseId)
        : ""),
  );
  return true;
}

async function handleExpenseText(
  text: string,
  userId: number,
  source: "telegram_text" | "telegram_voice",
  suffix: string,
) {
  // Forwarded bank alerts go through capture, not the expense parser.
  if (await handleBankMessage(text, userId, suffix)) return;

  const supabase = createServiceClient();
  const result = await logExpenseFromText(supabase, userId, text, source);

  if (result.status === "need_amount") {
    await reply(
      userId,
      (result.question ??
        "I couldn't find an amount in that. Try something like <code>300 zomato</code>.") +
        suffix,
    );
    return;
  }

  // v8: your own money moving between your own accounts isn't spending, so
  // say what was recorded and why rather than confirming an expense.
  if (result.status === "transferred") {
    const route = [result.from, result.to].filter(Boolean).join(" → ");
    const label =
      result.transfer.kind === "card_payment" ? "Card payment" : "Transfer";
    await reply(
      userId,
      `🔄 <b>${label}</b> ₹${result.transfer.amount.toLocaleString("en-IN")}` +
        (route ? `\n${escapeHtml(route)}` : "") +
        `\n<i>${escapeHtml(result.reason)}</i>` +
        "\nNot counted as spending." +
        suffix,
    );
    return;
  }

  const nudge = result.nudge
    ? "\n🤔 Not sure about the category. Reply <code>/category &lt;name&gt;</code> to fix it."
    : "";
  const alerts = await collectBudgetAlerts(supabase, userId);
  // The chat reply carries them; the inbox and phone get them too.
  await deliverBudgetAlerts(supabase, userId, alerts, { telegram: false });
  await reply(
    userId,
    confirmText(result.expense) +
      suffix +
      ((await dailySuffix(supabase, userId, result.expense.id)) ||
        (await monthlySummary(supabase, userId))) +
      nudge +
      (alerts.length ? `\n\n${alerts.map(escapeHtml).join("\n")}` : ""),
  );
}

// ── Correction commands (act on the most recent entry) ─────────────────────

async function handleCommand(text: string, userId: number) {
  const [cmd, ...rest] = text.split(/\s+/);
  const arg = rest.join(" ").trim();

  switch (cmd.toLowerCase()) {
    case "/start":
      // Deep-link payload: t.me/<bot>?start=fam_CODE → join that family.
      if (arg.startsWith("fam_")) {
        const supabase = createServiceClient();
        const result = await joinFamilyByCode(supabase, userId, arg.slice(4));
        await reply(
          userId,
          result.message + (result.joined ? `\n\n${HELP_TEXT}` : ""),
        );
        return;
      }
      await reply(userId, HELP_TEXT);
      return;
    case "/help":
      await reply(userId, HELP_TEXT);
      return;
    case "/family":
      if (arg.toLowerCase().startsWith("create")) {
        await handleFamilyCreate(userId, arg.slice(6).trim());
      } else {
        await sendFamilyReport(userId);
      }
      return;
    case "/invite":
      await sendInvite(userId);
      return;
    case "/undo":
      await undoLast(userId);
      return;
    case "/last":
      await showLast(userId);
      return;
    case "/category":
      await recategorizeLast(userId, arg);
      return;
    case "/status":
      await sendStatus(userId);
      return;
    case "/expense":
    case "/expenses":
      await sendMonthReport(userId, null);
      return;
    case "/invest":
    case "/investments":
      await sendMonthReport(userId, "Investments");
      return;
    case "/emi":
    case "/loan":
    case "/loans":
      await sendMonthReport(userId, "Loans & EMI");
      return;
    case "/app": {
      // Mobile-app login: long-lived signed token, pasted into the app once.
      const appToken = signToken(userId, 60 * 60 * 24 * 30);
      await reply(
        userId,
        `📱 Your app login code (valid 30 days, tap to copy):\n\n<code>${appToken}</code>\n\nOpen the Aaj app → paste the code → done.`,
      );
      return;
    }
    case "/dashboard": {
      const url =
        process.env.APP_URL || "https://telegram-expense-tracker-nu.vercel.app";
      const link = `${url}/api/auth/login?token=${signToken(userId, 900)}`;
      await reply(
        userId,
        `📈 Tap to open <b>your</b> dashboard (link valid for 15 minutes, stays signed in after that):\n${link}`,
      );
      return;
    }
    case "/amount":
      await reamountLast(userId, arg);
      return;
    case "/budget":
      await handleBudget(userId, arg);
      return;
    case "/income":
      await handleIncome(userId, arg);
      return;
    case "/split":
      await handleSplit(userId, arg);
      return;
    case "/bills":
      await sendBills(userId);
      return;
    case "/paid":
      await handlePaid(userId, arg);
      return;
    case "/plan":
      await handlePlan(userId, arg);
      return;
    case "/fixed":
      await handleFixed(userId, arg);
      return;
    case "/today":
      await sendToday(userId);
      return;
    case "/fromsavings":
      await rescopeLast(userId, "savings");
      return;
    case "/countdaily":
      await rescopeLast(userId, "daily");
      return;
    default:
      await reply(userId, `Unknown command. ${"\n"}${HELP_TEXT}`);
  }
}

// ── Family commands ─────────────────────────────────────────────────────────

async function handleFamilyCreate(userId: number, name: string) {
  const supabase = createServiceClient();
  const existing = await getFamily(supabase, userId);
  if (existing) {
    await reply(
      userId,
      `You're already in <b>${existing.name}</b>. It's one family per person for now. Use <code>/invite</code> to add members.`,
    );
    return;
  }
  if (!name) {
    await reply(
      userId,
      "Give the family a name, e.g. <code>/family create Sharma Family</code>",
    );
    return;
  }
  const family = await createFamily(supabase, userId, name.slice(0, 60));
  await reply(
    userId,
    `👨‍👩‍👧 <b>${family.name}</b> created!\n\nForward this link to your family members. One tap and they're in:\n${inviteLink(family.invite_code)}\n\nEveryone who joins logs their own expenses, and <code>/family</code> shows the combined picture.`,
  );
}

async function sendInvite(userId: number) {
  const supabase = createServiceClient();
  const family = await getFamily(supabase, userId);
  if (!family) {
    await reply(
      userId,
      "You're not in a family yet. Start one with <code>/family create Sharma Family</code>",
    );
    return;
  }
  await reply(
    userId,
    `Forward this to add someone to <b>${family.name}</b>:\n${inviteLink(family.invite_code)}`,
  );
}

async function sendFamilyReport(userId: number) {
  const supabase = createServiceClient();
  const family = await getFamily(supabase, userId);
  if (!family) {
    await reply(
      userId,
      "You're not in a family yet.\n\nStart one with <code>/family create Sharma Family</code>, then <code>/invite</code> to add members. Everyone's expenses roll up into one family view.",
    );
    return;
  }

  const members = await familyMembers(supabase, family.id);
  const memberIds = new Set(members.map((m) => m.id));
  const today = localDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthLabel = `1 ${MONTH_NAMES[Number(today.slice(5, 7)) - 1]}`;

  const { data, error } = await supabase
    .from("expenses")
    .select("amount, category, user_id")
    .gte("expense_date", monthStart);
  if (error) throw error;
  const rows = (
    (data ?? []) as Array<{
      amount: number;
      category: string;
      user_id: number | null;
    }>
  ).filter((r) => r.user_id !== null && memberIds.has(r.user_id));

  let spent = 0;
  let invested = 0;
  const byMember = new Map<number, number>();
  for (const r of rows) {
    if (r.category === "Investments") {
      invested += Number(r.amount);
    } else {
      spent += Number(r.amount);
      byMember.set(
        r.user_id!,
        (byMember.get(r.user_id!) ?? 0) + Number(r.amount),
      );
    }
  }

  const memberLines = members
    .map((m) => ({ name: m.name, total: byMember.get(m.id) ?? 0 }))
    .sort((a, b) => b.total - a.total)
    .map((m) => `• ${m.name}: ${fmtINR(m.total)}`)
    .join("\n");

  await reply(
    userId,
    `👨‍👩‍👧 <b>${family.name}, since ${monthLabel}</b>\nSpent: ${fmtINR(spent)} · Invested: ${fmtINR(invested)}\n\n${memberLines}\n\nMembers: ${members.length} · <code>/invite</code> to add more`,
  );
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** /expense (all spending), /invest, /emi — month-to-date report starting from the 1st. */
async function sendMonthReport(userId: number, categoryName: string | null) {
  const supabase = createServiceClient();
  const today = localDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthLabel = `1 ${MONTH_NAMES[Number(today.slice(5, 7)) - 1]}`;

  const { data, error } = await supabase
    .from("expenses")
    .select("amount, category, merchant, expense_date")
    .eq("user_id", userId)
    .gte("expense_date", monthStart)
    .order("logged_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    amount: number;
    category: string;
    merchant: string | null;
    expense_date: string;
  }>;

  if (categoryName) {
    const subset = rows.filter((r) => r.category === categoryName);
    if (subset.length === 0) {
      await reply(
        userId,
        `No ${categoryName} entries yet this month (since ${monthLabel}).`,
      );
      return;
    }
    const total = subset.reduce((s, r) => s + Number(r.amount), 0);
    const recent = subset
      .slice(0, 5)
      .map(
        (r) =>
          `• ${fmtINR(r.amount)}${r.merchant ? ` at ${r.merchant}` : ""} (${Number(r.expense_date.slice(8))} ${MONTH_NAMES[Number(r.expense_date.slice(5, 7)) - 1]})`,
      )
      .join("\n");
    await reply(
      userId,
      `💰 <b>${categoryName}</b> since ${monthLabel}: ${fmtINR(total)} across ${subset.length} ${subset.length === 1 ? "entry" : "entries"}\n${recent}`,
    );
    return;
  }

  let spent = 0;
  let invested = 0;
  const byCategory = new Map<string, number>();
  for (const r of rows) {
    if (r.category === "Investments") {
      invested += Number(r.amount);
    } else {
      spent += Number(r.amount);
      byCategory.set(
        r.category,
        (byCategory.get(r.category) ?? 0) + Number(r.amount),
      );
    }
  }
  const top = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, sum]) => `• ${name}: ${fmtINR(sum)}`)
    .join("\n");
  const txCount = rows.filter((r) => r.category !== "Investments").length;
  await reply(
    userId,
    `📊 <b>This month (since ${monthLabel})</b>\nSpent: ${fmtINR(spent)} across ${txCount} transactions` +
      (top ? `\n${top}` : "") +
      `\n📈 Invested: ${fmtINR(invested)}`,
  );
}

async function sendStatus(userId: number) {
  const llm = geminiConfigured()
    ? `Gemini (${process.env.LLM_MODEL || "gemini-2.5-flash"})`
    : process.env.ANTHROPIC_API_KEY
      ? `Claude (${process.env.LLM_MODEL || "claude-opus-5"})`
      : "❌ not configured, so messy messages fall back to Uncategorized";
  const voice = voiceConfigured()
    ? "✅ configured (Groq Whisper)"
    : "❌ not configured. Add GROQ_API_KEY in Vercel and redeploy";
  let db = "✅ connected";
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("expenses").select("id").limit(1);
    if (error) db = `❌ ${error.message}`;
  } catch (e) {
    db = `❌ ${e instanceof Error ? e.message : "unreachable"}`;
  }
  await reply(
    userId,
    `⚙️ <b>Status</b>\nDatabase: ${db}\nSmart parsing: ${llm}\nVoice notes: ${voice}`,
  );
}

async function latestExpense(
  supabase: SupabaseClient,
  userId: number,
): Promise<Expense | null> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as Expense) ?? null;
}

async function undoLast(userId: number) {
  const supabase = createServiceClient();
  const last = await latestExpense(supabase, userId);
  if (!last) {
    await reply(userId, "Nothing to undo. No expenses logged yet.");
    return;
  }
  const removed = await deleteExpenseScoped(supabase, userId, last.id);
  const splitNote = removed > 1 ? ` (whole split, ${removed} shares)` : "";
  await reply(
    userId,
    `🗑️ Deleted ${fmtINR(last.amount)} · ${last.category}${last.merchant ? ` (${last.merchant})` : ""}${splitNote}` +
      (await monthlySummary(supabase, userId)),
  );
}

async function showLast(userId: number) {
  const supabase = createServiceClient();
  const last = await latestExpense(supabase, userId);
  if (!last) {
    await reply(userId, "No expenses logged yet.");
    return;
  }
  await reply(
    userId,
    `Last entry: ${fmtINR(last.amount)} · ${last.category}${last.merchant ? ` (${last.merchant})` : ""} on ${last.expense_date}`,
  );
}

async function recategorizeLast(userId: number, arg: string) {
  if (!arg) {
    await reply(
      userId,
      "Tell me which category, e.g. <code>/category groceries</code>",
    );
    return;
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("categories")
    .select("name, keywords");
  if (error) throw error;
  const categories = (data ?? []) as CategoryRule[];

  const needle = arg.toLowerCase();
  const match =
    categories.find((c) => c.name.toLowerCase() === needle) ??
    categories.find((c) => c.name.toLowerCase().startsWith(needle)) ??
    categories.find((c) => c.name.toLowerCase().includes(needle));
  if (!match) {
    await reply(
      userId,
      `No category matches "${escapeHtml(arg)}". Options:\n${categories.map((c) => `• ${c.name}`).join("\n")}`,
    );
    return;
  }

  const last = await latestExpense(supabase, userId);
  if (!last) {
    await reply(userId, "No expenses logged yet.");
    return;
  }
  const { error: updateError } = await supabase
    .from("expenses")
    .update({ category: match.name })
    .eq("id", last.id);
  if (updateError) throw updateError;

  // A manual correction is the strongest signal there is — learn from it.
  if (last.merchant) {
    await learnKeyword(supabase, categories, match.name, last.merchant);
  }
  await reply(
    userId,
    `✏️ Moved ${fmtINR(last.amount)}${last.merchant ? ` (${last.merchant})` : ""} → ${match.name}`,
  );
}

async function reamountLast(userId: number, arg: string) {
  const amount = parseFloat(arg.replace(/[₹,]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    await reply(
      userId,
      "Give me the corrected amount, e.g. <code>/amount 350</code>",
    );
    return;
  }
  const supabase = createServiceClient();
  const last = await latestExpense(supabase, userId);
  if (!last) {
    await reply(userId, "No expenses logged yet.");
    return;
  }
  const { error } = await supabase
    .from("expenses")
    .update({ amount })
    .eq("id", last.id);
  if (error) throw error;
  await reply(
    userId,
    `✏️ Changed ${fmtINR(last.amount)} → ${fmtINR(amount)} · ${last.category}${last.merchant ? ` (${last.merchant})` : ""}`,
  );
}

// ── v4: budgets, income, splits ─────────────────────────────────────────────

/** Fuzzy category lookup shared by /budget (same rules as /category). */
function matchCategory(
  categories: CategoryRule[],
  needleRaw: string,
): CategoryRule | null {
  const needle = needleRaw.toLowerCase().trim();
  return (
    categories.find((c) => c.name.toLowerCase() === needle) ??
    categories.find((c) => c.name.toLowerCase().startsWith(needle)) ??
    categories.find((c) => c.name.toLowerCase().includes(needle)) ??
    null
  );
}

async function handleBudget(userId: number, arg: string) {
  const supabase = createServiceClient();

  try {
    // "/budget" → progress list
    if (!arg) {
      const budgets = await getBudgets(supabase, userId);
      if (budgets.length === 0) {
        await reply(
          userId,
          "No budgets set yet.\n\n• <code>/budget 15000</code>: overall monthly cap\n• <code>/budget groceries 3000</code>: cap one category\n\nI'll warn you at 80% and 100%.",
        );
        return;
      }
      const monthStart = `${localDate().slice(0, 7)}-01`;
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, category, expense_date")
        .eq("user_id", userId)
        .gte("expense_date", monthStart);
      if (error) throw error;
      const progress = budgetProgress(
        budgets,
        (data ?? []).map((e) => ({ ...e, merchant: null })),
        localDate(),
      );
      const lines = progress
        .sort((a, b) =>
          a.category === null ? -1 : b.category === null ? 1 : b.pct - a.pct,
        )
        .map((b) => {
          const pct = Math.round(b.pct * 100);
          const icon = pct >= 100 ? "🚨" : pct >= 80 ? "⚠️" : "✅";
          return `${icon} ${b.category ?? "Overall"}: ${fmtINR(b.spent)} / ${fmtINR(b.monthly_cap)} (${pct}%)`;
        })
        .join("\n");
      await reply(userId, `🎯 <b>Budgets this month</b>\n${lines}`);
      return;
    }

    // "/budget remove groceries" | "/budget remove overall"
    if (arg.toLowerCase().startsWith("remove")) {
      const what = arg.slice(6).trim();
      if (!what) {
        await reply(
          userId,
          "Remove which one? e.g. <code>/budget remove groceries</code> or <code>/budget remove overall</code>",
        );
        return;
      }
      let category: string | null = null;
      if (what.toLowerCase() !== "overall") {
        const categories = await loadCategories(supabase);
        const match = matchCategory(categories, what);
        if (!match) {
          await reply(userId, `No category matches "${escapeHtml(what)}".`);
          return;
        }
        category = match.name;
      }
      const removed = await removeBudget(supabase, userId, category);
      await reply(
        userId,
        removed
          ? `🗑️ Removed the ${category ?? "overall"} budget.`
          : `There's no ${category ?? "overall"} budget to remove.`,
      );
      return;
    }

    // "/budget 15000" (overall) or "/budget groceries 3000"
    const tokens = arg.split(/\s+/);
    const capRaw = tokens[tokens.length - 1];
    const { amount: cap } = extractAmount(capRaw);
    if (!cap) {
      await reply(
        userId,
        "Give me a number, e.g. <code>/budget 15000</code> or <code>/budget groceries 3000</code>",
      );
      return;
    }
    let category: string | null = null;
    const catText = tokens.slice(0, -1).join(" ").trim();
    if (catText) {
      const categories = await loadCategories(supabase);
      const match = matchCategory(categories, catText);
      if (!match) {
        await reply(
          userId,
          `No category matches "${escapeHtml(catText)}". Options:\n${categories.map((c) => `• ${c.name}`).join("\n")}`,
        );
        return;
      }
      category = match.name;
    }
    await setBudget(supabase, userId, category, cap);
    await reply(
      userId,
      `🎯 Budget set: ${category ?? "overall spending"} capped at ${fmtINR(cap)}/month. I'll warn you at 80% and 100%.`,
    );
  } catch (err) {
    console.error("/budget failed", err);
    await reply(
      userId,
      "⚠️ Budgets aren't available yet. The v4 database migration hasn't been applied.",
    );
  }
}

async function handleIncome(userId: number, arg: string) {
  const supabase = createServiceClient();
  const today = localDate();
  const monthStart = `${today.slice(0, 7)}-01`;

  try {
    // "/income" → month report with savings rate
    if (!arg) {
      const incomes = await getIncomes(supabase, userId, monthStart);
      const earned = incomes.reduce((s, i) => s + Number(i.amount), 0);
      if (earned === 0) {
        await reply(
          userId,
          "No income logged this month. Log it like <code>/income 50000 salary</code> and I'll track how much you keep.",
        );
        return;
      }
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, category")
        .eq("user_id", userId)
        .gte("expense_date", monthStart);
      if (error) throw error;
      let spent = 0;
      let invested = 0;
      for (const r of data ?? []) {
        if (NON_SPEND_CATEGORIES.has(r.category)) invested += Number(r.amount);
        else spent += Number(r.amount);
      }
      const kept = earned - spent - invested;
      const rate = Math.round((Math.max(kept, 0) / earned) * 100);
      await reply(
        userId,
        `💵 <b>This month</b>\nEarned: ${fmtINR(earned)}\nSpent: ${fmtINR(spent)} · Invested: ${fmtINR(invested)}\nKept: ${fmtINR(kept)} (${rate}% saved)`,
      );
      return;
    }

    // "/income 50000 salary [yesterday]"
    let working = arg;
    let offsetDays = 0;
    if (/\byesterday\b/i.test(working)) {
      offsetDays = 1;
      working = working.replace(/\byesterday\b/i, " ");
    }
    const { amount, rest } = extractAmount(working);
    if (!amount) {
      await reply(userId, "How much? e.g. <code>/income 50000 salary</code>");
      return;
    }
    const source = rest.trim() ? rest.trim().slice(0, 80) : null;
    await logIncome(supabase, userId, {
      amount,
      source,
      income_date: localDate(offsetDays),
      raw_message: `/income ${arg}`,
      channel: "telegram",
    });
    await reply(
      userId,
      `💵 Logged income ${fmtINR(amount)}${source ? ` (${escapeHtml(source)})` : ""}. Send <code>/income</code> anytime to see this month's savings.`,
    );
  } catch (err) {
    console.error("/income failed", err);
    await reply(
      userId,
      "⚠️ Income tracking isn't available yet. The v4 database migration hasn't been applied.",
    );
  }
}

async function handleSplit(userId: number, arg: string) {
  const supabase = createServiceClient();
  if (!arg) {
    await reply(
      userId,
      "Split a bill equally with your family, e.g. <code>/split 1200 dinner</code>. You pay, and everyone's share gets logged.",
    );
    return;
  }

  const family = await getFamily(supabase, userId);
  if (!family) {
    await reply(
      userId,
      "You're not in a family yet. Use <code>/family create</code> first, then invite members to split with.",
    );
    return;
  }
  const members = await familyMembers(supabase, family.id);
  if (members.length < 2) {
    await reply(
      userId,
      "Your family has no other members yet. <code>/invite</code> someone first.",
    );
    return;
  }

  const categories = await loadCategories(supabase);
  const parsed = parseExpense(arg, categories);
  if (!parsed.ok || !parsed.amount) {
    await reply(
      userId,
      "I couldn't find an amount. Try <code>/split 1200 dinner</code>",
    );
    return;
  }

  try {
    const split = await logSplitExpense(
      supabase,
      userId,
      members.map((m) => m.id),
      {
        amount: parsed.amount,
        category: parsed.category ?? "Uncategorized",
        merchant: parsed.merchant,
        expense_date: parsed.expenseDate,
        raw_message: `/split ${arg}`,
        source: "telegram_text",
        parsed_by: "rules",
      },
    );
    const names = members
      .filter((m) => m.id !== userId)
      .map((m) => m.name)
      .join(", ");
    const alerts = await collectBudgetAlerts(supabase, userId);
    // The chat reply carries them; the inbox and phone get them too.
    await deliverBudgetAlerts(supabase, userId, alerts, { telegram: false });
    await reply(
      userId,
      `🤝 Split ${fmtINR(parsed.amount)} · ${parsed.category ?? "Uncategorized"}${parsed.merchant ? ` (${escapeHtml(parsed.merchant)})` : ""} across ${split.count} people: ${fmtINR(split.perHead)} each (${escapeHtml(names)}).\nYou paid, so <code>/undo</code> removes the whole split.` +
        (alerts.length ? `\n\n${alerts.map(escapeHtml).join("\n")}` : ""),
    );
    // Tell the other members their share was logged.
    for (const m of members) {
      if (m.id === userId) continue;
      try {
        await notify(
          supabase,
          m.id,
          `🤝 ${escapeHtml(members.find((x) => x.id === userId)?.name ?? "A family member")} split ${fmtINR(parsed.amount)}${parsed.merchant ? ` (${escapeHtml(parsed.merchant)})` : ""}. Your share of ${fmtINR(split.perHead)} was logged for you.`,
        );
      } catch (err) {
        console.error("split notify failed", err);
      }
    }
  } catch (err) {
    console.error("/split failed", err);
    await reply(
      userId,
      "⚠️ Splits aren't available yet. The v4 database migration hasn't been applied.",
    );
  }
}

// ── v5: bills ───────────────────────────────────────────────────────────────

async function sendBills(userId: number) {
  const supabase = createServiceClient();
  const bills = await loadBillStatuses(supabase, userId, localDate());
  if (bills.length === 0) {
    await reply(
      userId,
      "No bills registered yet. Add them in the app (Bills tab → +): electricity, water, credit card, rent… I'll remind you before they're due, and <b>Pay now</b> opens your UPI app with the amount filled in.",
    );
    return;
  }
  const lines = bills.map((b) => {
    const amt = b.amount ? ` · ${fmtINR(b.amount)}` : "";
    const when =
      b.daysUntil < 0
        ? `⏰ ${-b.daysUntil}d overdue`
        : b.daysUntil === 0
          ? "🔴 due today"
          : b.daysUntil <= 3
            ? `🟠 in ${b.daysUntil}d`
            : `🟢 in ${b.daysUntil}d (${Number(b.dueDate.slice(8))}th)`;
    const paid = b.paidThisMonth ? " ✅ paid this month" : "";
    return `• <b>${escapeHtml(b.name)}</b>${amt}: ${when}${paid}`;
  });
  await reply(
    userId,
    `🧾 <b>Your bills</b>\n${lines.join("\n")}\n\nMark one paid: <code>/paid electricity 1234</code> (amount optional if it's the usual).`,
  );
}

async function handlePaid(userId: number, arg: string) {
  if (!arg) {
    await reply(
      userId,
      "Which bill? e.g. <code>/paid electricity 1234</code>. See <code>/bills</code> for names.",
    );
    return;
  }
  const supabase = createServiceClient();
  const bills = await loadBillStatuses(supabase, userId, localDate());
  if (bills.length === 0) {
    await reply(
      userId,
      "No bills registered yet. Add them in the app's Bills tab first.",
    );
    return;
  }

  // Amount is the last numeric token (if any); the rest names the bill.
  const tokens = arg.split(/\s+/);
  let amount: number | null = null;
  const { amount: parsedAmt } = extractAmount(tokens[tokens.length - 1]);
  if (parsedAmt && tokens.length > 1) {
    amount = parsedAmt;
    tokens.pop();
  }
  const needle = tokens.join(" ").toLowerCase();
  const bill =
    bills.find((b) => b.name.toLowerCase() === needle) ??
    bills.find((b) => b.name.toLowerCase().includes(needle)) ??
    bills.find((b) => b.kind.replace("_", " ").includes(needle));
  if (!bill) {
    await reply(
      userId,
      `No bill matches "${escapeHtml(needle)}". Your bills:\n${bills.map((b) => `• ${escapeHtml(b.name)}`).join("\n")}`,
    );
    return;
  }
  const finalAmount = amount ?? bill.amount;
  if (!finalAmount) {
    await reply(
      userId,
      `How much did you pay for ${escapeHtml(bill.name)}? e.g. <code>/paid ${escapeHtml(bill.name.split(" ")[0].toLowerCase())} 1234</code>`,
    );
    return;
  }

  try {
    await markBillPaid(
      supabase,
      userId,
      bill.id,
      finalAmount,
      localDate(),
      "telegram_bill",
    );
    const alerts = await collectBudgetAlerts(supabase, userId);
    // The chat reply carries them; the inbox and phone get them too.
    await deliverBudgetAlerts(supabase, userId, alerts, { telegram: false });
    await reply(
      userId,
      `✅ ${escapeHtml(bill.name)} marked paid. ${fmtINR(finalAmount)} logged under ${bill.category}.` +
        (await monthlySummary(supabase, userId)) +
        (alerts.length ? `\n\n${alerts.map(escapeHtml).join("\n")}` : ""),
    );
  } catch (err) {
    console.error("/paid failed", err);
    await reply(userId, "⚠️ Couldn't mark that paid. Try again in a minute.");
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Daily budget (v14) ──────────────────────────────────────────────────────

/** "Today: ₹1,467 left of ₹1,667" under a confirmation — empty without a plan. */
async function dailySuffix(
  supabase: SupabaseClient,
  userId: number,
  expenseId: string,
): Promise<string> {
  try {
    const { status, plan } = await loadDailyStatus(supabase, userId);
    if (!plan || !status.ready) return "";
    const text = spendMessage(status, [expenseId]);
    if (!text) return "";
    // The confirmation already names the spend; keep the line about the day.
    const [first, ...rest] = text.split("\n");
    return `\n\n${first.startsWith("💸") ? rest.join("\n") : text}`;
  } catch (err) {
    console.error("daily suffix failed", err);
    return "";
  }
}

const parseMoney = (raw: string): number | null => {
  // "1 lakh" / "1.5L" — only here: in an expense, "1l milk" is a litre.
  const lakh = raw.match(/(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?|l)\b/i);
  if (lakh) return Math.round(Number(lakh[1]) * 100000);
  const { amount } = extractAmount(raw);
  return amount && amount > 0 ? Math.round(amount) : null;
};

async function handlePlan(userId: number, arg: string) {
  const supabase = createServiceClient();
  const words = arg.toLowerCase().split(/\s+/).filter(Boolean);

  if (words.length) {
    const toggle = ["morning", "evening", "live"].indexOf(words[0]);
    if (toggle >= 0 && (words[1] === "on" || words[1] === "off")) {
      const key = (
        ["morning_brief", "evening_report", "live_updates"] as const
      )[toggle];
      await savePlan(supabase, userId, { [key]: words[1] === "on" });
    } else if (words[0] === "payday" || words[0] === "salary") {
      const day = words[1] === "off" ? null : Number(words[1]);
      if (day !== null && !(Number.isInteger(day) && day >= 1 && day <= 31)) {
        await reply(
          userId,
          "Which day does salary arrive? e.g. <code>/plan payday 30</code> (or <code>/plan payday off</code>)",
        );
        return;
      }
      await savePlan(supabase, userId, { payday: day });
    } else if (words[0] === "save" || words[0] === "savings") {
      const rest = words.slice(1).join(" ");
      const n = rest === "0" ? 0 : parseMoney(rest);
      if (n === null) {
        await reply(
          userId,
          "How much a month? e.g. <code>/plan save 15000</code>",
        );
        return;
      }
      await savePlan(supabase, userId, { savings_goal: n });
    } else {
      const n = parseMoney(words.join(" ").replace(/^income\s*/, ""));
      if (n === null) {
        await reply(
          userId,
          "Tell me your monthly income, e.g. <code>/plan 100000</code>",
        );
        return;
      }
      await savePlan(supabase, userId, { monthly_income: n });
    }
  }

  const { status, plan, commitments } = await loadDailyStatus(supabase, userId);
  if (!plan) {
    await reply(userId, SETUP_HINT);
    return;
  }
  const lines = [
    "🧮 <b>Your plan</b>",
    "",
    `Income: ${status.income ? inr(status.income) : "not set"}${status.incomeSource === "last_month" ? " (last month's)" : ""}`,
    `− Fixed costs: ${inr(status.fixed)}${commitments.length ? "" : " (add with <code>/fixed rent 25000</code>)"}`,
    `− Savings goal: ${inr(status.savingsGoal)}`,
    ...(status.goals ? [`− Goals: ${inr(status.goals)}`] : []),
    `= Everyday money: <b>${inr(status.pool)}</b> (≈${inr(status.baseDaily)}/day)`,
    `Budget month: ${status.cycleStart.slice(8)}/${status.cycleStart.slice(5, 7)} → ${status.cycleEnd.slice(8)}/${status.cycleEnd.slice(5, 7)}${plan.payday ? ` (salary on the ${plan.payday})` : " (set salary day with <code>/plan payday 30</code>)"}`,
  ];
  if (status.ready)
    lines.push(
      "",
      `Today: <b>${inr(status.todayLeft)}</b> left of ${inr(status.todayBudget)}`,
    );
  lines.push(
    "",
    `Morning ${plan.morning_brief ? "on" : "off"} · Evening ${plan.evening_report ? "on" : "off"} · Live ${plan.live_updates ? "on" : "off"}`,
  );
  if (!commitments.length) {
    const ideas = await suggestCommitments(supabase, userId, commitments);
    if (ideas.length)
      lines.push(
        "",
        "Looks like fixed costs (tap to copy):",
        ...ideas
          .slice(0, 5)
          .map(
            (i) => `• <code>/fixed ${escapeHtml(i.name)} ${i.amount}</code>`,
          ),
      );
  }
  await reply(userId, lines.join("\n"));
}

async function handleFixed(userId: number, arg: string) {
  const supabase = createServiceClient();
  const removeMatch = arg.match(/^(?:remove|delete|rm)\s+(.+)$/i);
  if (removeMatch) {
    const removed = await removeCommitment(supabase, userId, removeMatch[1]);
    await reply(
      userId,
      removed
        ? `🗑️ Removed <b>${escapeHtml(removed)}</b> from fixed costs.`
        : `No fixed cost called "${escapeHtml(removeMatch[1])}". Send <code>/fixed</code> to see the list.`,
    );
    return;
  }

  if (arg) {
    const amount = parseMoney(arg);
    const name = arg
      .replace(/(?:₹|rs\.?|inr)?\s*\d[\d,]*(?:\.\d+)?\s*k?\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!amount || !name) {
      await reply(userId, "Like this: <code>/fixed rent 25000</code>");
      return;
    }
    const categories = await loadCategories(supabase);
    const guessed = parseExpense(
      `${amount} ${name}`,
      categories as CategoryRule[],
    ).category;
    await addCommitment(supabase, userId, {
      name: name.replace(/^\w/, (c) => c.toUpperCase()),
      amount,
      category: guessed && guessed !== "Uncategorized" ? guessed : null,
    });
    // Listing a fixed cost means they're using the daily budget — make sure a plan row exists.
    if (!(await getPlan(supabase, userId)))
      await savePlan(supabase, userId, {});
  }

  const { status, commitments } = await loadDailyStatus(supabase, userId);
  if (!commitments.length) {
    await reply(
      userId,
      "No fixed costs yet. Add one: <code>/fixed rent 25000</code>",
    );
    return;
  }
  await reply(
    userId,
    [
      "📌 <b>Fixed monthly costs</b>",
      ...status.commitments.map(
        (c) =>
          `• ${escapeHtml(c.name)} ${inr(c.amount)}${c.paid >= c.amount * 0.7 ? " ✅ paid" : ""}`,
      ),
      `Total: <b>${inr(status.fixed)}</b>, kept out of your daily budget.`,
      "",
      status.ready
        ? `Everyday money: ${inr(status.pool)} · today ${inr(status.todayBudget)}`
        : SETUP_HINT,
    ].join("\n"),
  );
}

async function sendToday(userId: number) {
  const supabase = createServiceClient();
  const { status } = await loadDailyStatus(supabase, userId);
  await reply(
    userId,
    eveningReport(status, localDate()).replace(
      "Today's report",
      "Today so far",
    ),
  );
}

async function rescopeLast(userId: number, scope: "savings" | "daily") {
  const supabase = createServiceClient();
  const last = await latestExpense(supabase, userId);
  if (!last) {
    await reply(userId, "No expenses logged yet.");
    return;
  }
  try {
    await setBudgetScope(supabase, userId, last.id, scope);
  } catch {
    await reply(userId, "Couldn't change that. Is the v14 migration applied?");
    return;
  }
  const { status } = await loadDailyStatus(supabase, userId);
  await reply(
    userId,
    (scope === "savings"
      ? `💰 ${fmtINR(last.amount)}${last.merchant ? ` (${escapeHtml(last.merchant)})` : ""} now comes from savings.`
      : `💸 ${fmtINR(last.amount)} now counts against your daily budget.`) +
      (status.ready
        ? `\nToday: <b>${inr(status.todayLeft)}</b> left of ${inr(status.todayBudget)}`
        : ""),
  );
}
