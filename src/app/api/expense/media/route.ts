import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { localDate } from "@/lib/parser";
import { parseReceipt } from "@/lib/llm";
import { transcribeVoice, voiceConfigured } from "@/lib/voice";
import {
  logExpenseFromText,
  insertExpense,
  loadCategories,
  learnKeyword,
} from "@/lib/log-expense";
import { collectBudgetAlerts, pushAlertsToTelegram } from "@/lib/budgets";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // transcription + vision calls

/**
 * Voice-note and receipt-photo logging from the app — multipart form-data:
 *   kind:    "voice" | "receipt"
 *   file:    the audio (m4a/ogg) or image (jpeg/png)
 *   caption: optional text hint (receipt mode)
 * Same brains as the Telegram bot, different transport.
 */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart form-data" }, { status: 400 });
  }

  const kind = form.get("kind");
  const file = form.get("file");
  if ((kind !== "voice" && kind !== "receipt") || !(file instanceof Blob)) {
    return NextResponse.json({ error: "need kind=voice|receipt and a file" }, { status: 400 });
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "file too large (15MB max)" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const supabase = createServiceClient();

  if (kind === "voice") {
    if (!voiceConfigured()) {
      return NextResponse.json({ error: "voice transcription not configured" }, { status: 503 });
    }
    const name = (file as File).name || "voice.m4a";
    const transcript = await transcribeVoice(bytes, file.type || "audio/m4a", name);
    if (!transcript) {
      return NextResponse.json({
        status: "need_amount",
        question: "Couldn't make out that recording — try again closer to the mic, or type it.",
        alerts: [],
      });
    }
    const result = await logExpenseFromText(supabase, userId, transcript, "app_voice");
    const alerts =
      result.status === "logged" ? await collectBudgetAlerts(supabase, userId) : [];
    if (alerts.length > 0) await pushAlertsToTelegram(userId, alerts);
    return NextResponse.json({ ...result, transcript, alerts });
  }

  // Receipt photo → vision parse → insert (mirrors the Telegram photo handler).
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "receipt reading not configured" }, { status: 503 });
  }
  const captionRaw = form.get("caption");
  const caption =
    typeof captionRaw === "string" && captionRaw.trim() ? captionRaw.trim() : null;

  const categories = await loadCategories(supabase);
  const parsed = await parseReceipt(
    bytes,
    file.type || "image/jpeg",
    caption,
    categories,
    localDate(),
  );

  if (!parsed || !parsed.amount || parsed.amount <= 0) {
    return NextResponse.json({
      status: "need_amount",
      question:
        parsed?.clarifying_question ??
        "Couldn't read a total from that photo — try a clearer shot, or type the amount.",
      alerts: [],
    });
  }

  const expense = await insertExpense(supabase, {
    amount: parsed.amount,
    category: parsed.category ?? "Uncategorized",
    merchant: parsed.merchant,
    expense_date: parsed.expense_date ?? localDate(),
    user_id: userId,
    raw_message: caption ? `[app photo] ${caption}` : "[app photo]",
    source: "app_photo",
    parsed_by: "llm",
  });

  if (parsed.confidence === "high" && parsed.category && parsed.merchant) {
    await learnKeyword(supabase, categories, parsed.category, parsed.merchant);
  }

  const alerts = await collectBudgetAlerts(supabase, userId);
  if (alerts.length > 0) await pushAlertsToTelegram(userId, alerts);
  return NextResponse.json({
    status: "logged",
    expense,
    nudge: parsed.confidence === "low" || !parsed.category,
    alerts,
  });
}
