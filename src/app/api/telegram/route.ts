import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { parseExpense, localDate, CategoryRule } from "@/lib/parser";
import { parseWithLLM, parseReceipt } from "@/lib/llm";
import { transcribeVoice, voiceConfigured } from "@/lib/voice";
import {
  sendMessage,
  downloadTelegramFile,
  TelegramUpdate,
  TelegramMessage,
} from "@/lib/telegram";
import { createServiceClient } from "@/lib/supabase-server";
import {
  ensureUser,
  getFamily,
  familyMembers,
  createFamily,
  joinFamilyByCode,
  inviteLink,
} from "@/lib/family";
import type { Expense } from "@/lib/types";

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
  "• <code>/undo</code> — delete it",
  "• <code>/category food</code> — change its category",
  "• <code>/amount 350</code> — change its amount",
  "• <code>/last</code> — show it",
  "",
  "Reports:",
  "• <code>/expense</code> — spent this month",
  "• <code>/invest</code> — invested this month",
  "• <code>/emi</code> — loans &amp; EMI this month",
  "• <code>/dashboard</code> — web dashboard link",
  "• <code>/status</code> — check bot configuration",
  "",
  "Family:",
  "• <code>/family create Sharma Family</code> — start a family",
  "• <code>/invite</code> — get a link to add members",
  "• <code>/family</code> — this month's family report",
].join("\n");

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
  chatId: number,
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
    if (r.user_id !== chatId) continue;
    if (r.category === "Investments") invested += Number(r.amount);
    else spent += Number(r.amount);
  }

  let familyLine = "";
  const family = await getFamily(supabase, chatId);
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
    version: "v3.0",
    telegram,
    llm: process.env.GEMINI_API_KEY
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
    await handleMessage(message, chatId);
  } catch (err) {
    console.error("webhook error", err);
    try {
      await sendMessage(
        chatId,
        "⚠️ Something went wrong — that message was NOT logged. Try again in a minute.",
      );
    } catch {
      // nothing more we can do
    }
  }
  return ok();
}

async function handleMessage(message: TelegramMessage, chatId: number) {
  if (message.photo && message.photo.length > 0) {
    await handleReceiptPhoto(message, chatId);
    return;
  }

  if (message.voice) {
    if (!voiceConfigured()) {
      await sendMessage(
        chatId,
        "🎤 Voice logging isn't set up yet (GROQ_API_KEY missing). Text me instead!",
      );
      return;
    }
    const audio = await downloadTelegramFile(message.voice.file_id);
    const transcript = audio
      ? await transcribeVoice(audio, message.voice.mime_type ?? "audio/ogg")
      : null;
    if (!transcript) {
      await sendMessage(
        chatId,
        "🎤 I couldn't make out that voice note — try again or type it.",
      );
      return;
    }
    await handleExpenseText(
      transcript,
      chatId,
      "telegram_voice",
      `\n🎤 <i>"${escapeHtml(transcript)}"</i>`,
    );
    return;
  }

  const text = message.text?.trim();
  if (!text) return;

  if (text.startsWith("/")) {
    await handleCommand(text, chatId);
    return;
  }

  await handleExpenseText(text, chatId, "telegram_text", "");
}

// ── Receipt photos: download → Gemini vision → same pipeline ───────────────

async function handleReceiptPhoto(message: TelegramMessage, chatId: number) {
  if (!process.env.GEMINI_API_KEY) {
    await sendMessage(
      chatId,
      "📷 Receipt reading isn't set up yet (GEMINI_API_KEY missing). Text me the amount instead!",
    );
    return;
  }

  // Telegram sends several sizes; the last is the largest.
  const fileId = message.photo![message.photo!.length - 1].file_id;
  const image = await downloadTelegramFile(fileId);
  if (!image) {
    await sendMessage(
      chatId,
      "📷 I couldn't download that photo — try sending it again.",
    );
    return;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("categories")
    .select("name, keywords");
  if (error) throw error;
  const categories = (data ?? []) as CategoryRule[];

  const caption = message.caption?.trim() || null;
  const parsed = await parseReceipt(
    image,
    "image/jpeg",
    caption,
    categories,
    localDate(),
  );

  if (!parsed || !parsed.amount || parsed.amount <= 0) {
    await sendMessage(
      chatId,
      parsed?.clarifying_question ??
        "📷 I couldn't read a total from that receipt — try a clearer photo, or just type it like <code>300 zomato</code>.",
    );
    return;
  }

  const row = {
    amount: parsed.amount,
    category: parsed.category ?? "Uncategorized",
    merchant: parsed.merchant,
    expense_date: parsed.expense_date ?? localDate(),
  };
  await insertExpense(supabase, {
    ...row,
    user_id: chatId,
    raw_message: caption ? `[photo] ${caption}` : "[photo]",
    source: "telegram_photo",
    parsed_by: "llm",
  });

  if (parsed.confidence === "high" && parsed.category && parsed.merchant) {
    await learnKeyword(supabase, categories, parsed.category, parsed.merchant);
  }

  const nudge =
    parsed.confidence === "low" || !parsed.category
      ? "\n🤔 Not sure about the category — reply <code>/category &lt;name&gt;</code> to fix it."
      : "";
  await sendMessage(
    chatId,
    `📷 ${confirmText(row)}` + (await monthlySummary(supabase, chatId)) + nudge,
  );
}

// ── Expense pipeline: rules fast path → LLM fallback → clarify ─────────────

async function handleExpenseText(
  text: string,
  chatId: number,
  source: "telegram_text" | "telegram_voice",
  suffix: string,
) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("categories")
    .select("name, keywords");
  if (error) throw error;
  const categories = (data ?? []) as CategoryRule[];

  const parsed = parseExpense(text, categories);

  // Fast path: rules found both an amount and a category.
  if (parsed.ok && parsed.category) {
    const row = {
      amount: parsed.amount!,
      category: parsed.category,
      merchant: parsed.merchant,
      expense_date: parsed.expenseDate,
    };
    await insertExpense(supabase, {
      ...row,
      user_id: chatId,
      raw_message: text,
      source,
      parsed_by: "rules",
    });
    await sendMessage(
      chatId,
      confirmText(row) + suffix + (await monthlySummary(supabase, chatId)),
    );
    return;
  }

  // Fallback: let the LLM take a shot at anything messier.
  const llm = await parseWithLLM(text, categories, localDate());
  if (llm) {
    if (llm.amount && llm.amount > 0) {
      const row = {
        amount: llm.amount,
        category: llm.category ?? "Uncategorized",
        merchant: llm.merchant,
        expense_date: llm.expense_date ?? parsed.expenseDate,
      };
      await insertExpense(supabase, {
        ...row,
        user_id: chatId,
        raw_message: text,
        source,
        parsed_by: "llm",
      });

      // Self-improving keyword table: confident categorizations teach the fast path.
      if (llm.confidence === "high" && llm.category && llm.merchant) {
        await learnKeyword(supabase, categories, llm.category, llm.merchant);
      }

      const nudge =
        llm.confidence === "low" || !llm.category
          ? "\n🤔 Not sure about the category — reply <code>/category &lt;name&gt;</code> to fix it."
          : "";
      await sendMessage(
        chatId,
        confirmText(row) +
          suffix +
          (await monthlySummary(supabase, chatId)) +
          nudge,
      );
      return;
    }

    // LLM ran but found no amount → ask instead of guessing.
    await sendMessage(
      chatId,
      (llm.clarifying_question ??
        "How much was that? Send it with an amount, like <code>300 zomato</code>.") +
        suffix,
    );
    return;
  }

  // No LLM configured (or it errored): fall back to v1 behavior.
  if (parsed.ok) {
    const row = {
      amount: parsed.amount!,
      category: "Uncategorized",
      merchant: parsed.merchant,
      expense_date: parsed.expenseDate,
    };
    await insertExpense(supabase, {
      ...row,
      user_id: chatId,
      raw_message: text,
      source,
      parsed_by: "rules",
    });
    await sendMessage(
      chatId,
      confirmText(row) + suffix + (await monthlySummary(supabase, chatId)),
    );
  } else {
    await sendMessage(
      chatId,
      "I couldn't find an amount in that. Try something like <code>300 zomato</code>." +
        suffix,
    );
  }
}

async function insertExpense(
  supabase: SupabaseClient,
  row: {
    amount: number;
    category: string;
    merchant: string | null;
    user_id: number;
    raw_message: string;
    source: string;
    parsed_by: string;
    expense_date: string;
  },
) {
  const { error } = await supabase.from("expenses").insert(row);
  if (error) throw error;
}

/** Add a merchant keyword to a category so the rules parser catches it next time. */
async function learnKeyword(
  supabase: SupabaseClient,
  categories: CategoryRule[],
  categoryName: string,
  merchant: string,
) {
  const keyword = merchant.toLowerCase().trim();
  if (keyword.length < 3 || keyword.length > 30 || /^\d+$/.test(keyword))
    return;

  const category = categories.find((c) => c.name === categoryName);
  if (!category) return;

  // Skip if any category already knows this keyword.
  const known = categories.some((c) =>
    c.keywords.some((k) => k.toLowerCase() === keyword),
  );
  if (known) return;

  const { error } = await supabase
    .from("categories")
    .update({ keywords: [...category.keywords, keyword] })
    .eq("name", categoryName);
  if (error) console.error("keyword learn failed", error);
  else console.log(`learned keyword "${keyword}" → ${categoryName}`);
}

// ── Correction commands (act on the most recent entry) ─────────────────────

async function handleCommand(text: string, chatId: number) {
  const [cmd, ...rest] = text.split(/\s+/);
  const arg = rest.join(" ").trim();

  switch (cmd.toLowerCase()) {
    case "/start":
      // Deep-link payload: t.me/<bot>?start=fam_CODE → join that family.
      if (arg.startsWith("fam_")) {
        const supabase = createServiceClient();
        const result = await joinFamilyByCode(supabase, chatId, arg.slice(4));
        await sendMessage(
          chatId,
          result.message + (result.joined ? `\n\n${HELP_TEXT}` : ""),
        );
        return;
      }
      await sendMessage(chatId, HELP_TEXT);
      return;
    case "/help":
      await sendMessage(chatId, HELP_TEXT);
      return;
    case "/family":
      if (arg.toLowerCase().startsWith("create")) {
        await handleFamilyCreate(chatId, arg.slice(6).trim());
      } else {
        await sendFamilyReport(chatId);
      }
      return;
    case "/invite":
      await sendInvite(chatId);
      return;
    case "/undo":
      await undoLast(chatId);
      return;
    case "/last":
      await showLast(chatId);
      return;
    case "/category":
      await recategorizeLast(chatId, arg);
      return;
    case "/status":
      await sendStatus(chatId);
      return;
    case "/expense":
    case "/expenses":
      await sendMonthReport(chatId, null);
      return;
    case "/invest":
    case "/investments":
      await sendMonthReport(chatId, "Investments");
      return;
    case "/emi":
    case "/loan":
    case "/loans":
      await sendMonthReport(chatId, "Loans & EMI");
      return;
    case "/dashboard": {
      const url =
        process.env.APP_URL || "https://telegram-expense-tracker-nu.vercel.app";
      await sendMessage(chatId, `📈 Your dashboard: ${url}`);
      return;
    }
    case "/amount":
      await reamountLast(chatId, arg);
      return;
    default:
      await sendMessage(chatId, `Unknown command. ${"\n"}${HELP_TEXT}`);
  }
}

// ── Family commands ─────────────────────────────────────────────────────────

async function handleFamilyCreate(chatId: number, name: string) {
  const supabase = createServiceClient();
  const existing = await getFamily(supabase, chatId);
  if (existing) {
    await sendMessage(
      chatId,
      `You're already in <b>${existing.name}</b> — one family per person for now. Use <code>/invite</code> to add members.`,
    );
    return;
  }
  if (!name) {
    await sendMessage(
      chatId,
      "Give the family a name, e.g. <code>/family create Sharma Family</code>",
    );
    return;
  }
  const family = await createFamily(supabase, chatId, name.slice(0, 60));
  await sendMessage(
    chatId,
    `👨‍👩‍👧 <b>${family.name}</b> created!\n\nForward this link to your family members — one tap and they're in:\n${inviteLink(family.invite_code)}\n\nEveryone who joins logs their own expenses, and <code>/family</code> shows the combined picture.`,
  );
}

async function sendInvite(chatId: number) {
  const supabase = createServiceClient();
  const family = await getFamily(supabase, chatId);
  if (!family) {
    await sendMessage(
      chatId,
      "You're not in a family yet — start one with <code>/family create Sharma Family</code>",
    );
    return;
  }
  await sendMessage(
    chatId,
    `Forward this to add someone to <b>${family.name}</b>:\n${inviteLink(family.invite_code)}`,
  );
}

async function sendFamilyReport(chatId: number) {
  const supabase = createServiceClient();
  const family = await getFamily(supabase, chatId);
  if (!family) {
    await sendMessage(
      chatId,
      "You're not in a family yet.\n\nStart one with <code>/family create Sharma Family</code>, then <code>/invite</code> to add members — everyone's expenses roll up into one family view.",
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

  await sendMessage(
    chatId,
    `👨‍👩‍👧 <b>${family.name} — since ${monthLabel}</b>\nSpent: ${fmtINR(spent)} · Invested: ${fmtINR(invested)}\n\n${memberLines}\n\nMembers: ${members.length} · <code>/invite</code> to add more`,
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
async function sendMonthReport(chatId: number, categoryName: string | null) {
  const supabase = createServiceClient();
  const today = localDate();
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthLabel = `1 ${MONTH_NAMES[Number(today.slice(5, 7)) - 1]}`;

  const { data, error } = await supabase
    .from("expenses")
    .select("amount, category, merchant, expense_date")
    .eq("user_id", chatId)
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
      await sendMessage(
        chatId,
        `No ${categoryName} entries yet this month (since ${monthLabel}).`,
      );
      return;
    }
    const total = subset.reduce((s, r) => s + Number(r.amount), 0);
    const recent = subset
      .slice(0, 5)
      .map(
        (r) =>
          `• ${fmtINR(r.amount)}${r.merchant ? ` — ${r.merchant}` : ""} (${Number(r.expense_date.slice(8))} ${MONTH_NAMES[Number(r.expense_date.slice(5, 7)) - 1]})`,
      )
      .join("\n");
    await sendMessage(
      chatId,
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
  await sendMessage(
    chatId,
    `📊 <b>This month (since ${monthLabel})</b>\nSpent: ${fmtINR(spent)} across ${txCount} transactions` +
      (top ? `\n${top}` : "") +
      `\n📈 Invested: ${fmtINR(invested)}`,
  );
}

async function sendStatus(chatId: number) {
  const llm = process.env.GEMINI_API_KEY
    ? `Gemini (${process.env.LLM_MODEL || "gemini-2.5-flash"})`
    : process.env.ANTHROPIC_API_KEY
      ? `Claude (${process.env.LLM_MODEL || "claude-opus-5"})`
      : "❌ not configured — messy messages fall back to Uncategorized";
  const voice = voiceConfigured()
    ? "✅ configured (Groq Whisper)"
    : "❌ not configured — add GROQ_API_KEY in Vercel and redeploy";
  let db = "✅ connected";
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("expenses").select("id").limit(1);
    if (error) db = `❌ ${error.message}`;
  } catch (e) {
    db = `❌ ${e instanceof Error ? e.message : "unreachable"}`;
  }
  await sendMessage(
    chatId,
    `⚙️ <b>Status</b>\nDatabase: ${db}\nSmart parsing: ${llm}\nVoice notes: ${voice}`,
  );
}

async function latestExpense(
  supabase: SupabaseClient,
  chatId: number,
): Promise<Expense | null> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", chatId)
    .order("logged_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as Expense) ?? null;
}

async function undoLast(chatId: number) {
  const supabase = createServiceClient();
  const last = await latestExpense(supabase, chatId);
  if (!last) {
    await sendMessage(chatId, "Nothing to undo — no expenses logged yet.");
    return;
  }
  const { error } = await supabase.from("expenses").delete().eq("id", last.id);
  if (error) throw error;
  await sendMessage(
    chatId,
    `🗑️ Deleted ${fmtINR(last.amount)} · ${last.category}${last.merchant ? ` (${last.merchant})` : ""}` +
      (await monthlySummary(supabase, chatId)),
  );
}

async function showLast(chatId: number) {
  const supabase = createServiceClient();
  const last = await latestExpense(supabase, chatId);
  if (!last) {
    await sendMessage(chatId, "No expenses logged yet.");
    return;
  }
  await sendMessage(
    chatId,
    `Last entry: ${fmtINR(last.amount)} · ${last.category}${last.merchant ? ` (${last.merchant})` : ""} on ${last.expense_date}`,
  );
}

async function recategorizeLast(chatId: number, arg: string) {
  if (!arg) {
    await sendMessage(
      chatId,
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
    await sendMessage(
      chatId,
      `No category matches "${escapeHtml(arg)}". Options:\n${categories.map((c) => `• ${c.name}`).join("\n")}`,
    );
    return;
  }

  const last = await latestExpense(supabase, chatId);
  if (!last) {
    await sendMessage(chatId, "No expenses logged yet.");
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
  await sendMessage(
    chatId,
    `✏️ Moved ${fmtINR(last.amount)}${last.merchant ? ` (${last.merchant})` : ""} → ${match.name}`,
  );
}

async function reamountLast(chatId: number, arg: string) {
  const amount = parseFloat(arg.replace(/[₹,]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    await sendMessage(
      chatId,
      "Give me the corrected amount, e.g. <code>/amount 350</code>",
    );
    return;
  }
  const supabase = createServiceClient();
  const last = await latestExpense(supabase, chatId);
  if (!last) {
    await sendMessage(chatId, "No expenses logged yet.");
    return;
  }
  const { error } = await supabase
    .from("expenses")
    .update({ amount })
    .eq("id", last.id);
  if (error) throw error;
  await sendMessage(
    chatId,
    `✏️ Changed ${fmtINR(last.amount)} → ${fmtINR(amount)} · ${last.category}${last.merchant ? ` (${last.merchant})` : ""}`,
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
