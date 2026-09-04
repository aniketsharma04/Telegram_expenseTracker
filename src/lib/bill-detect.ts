import Anthropic from "@anthropic-ai/sdk";
import type { BillKind } from "./bills";

/**
 * Bill detection (v7) — turn a raw message into a candidate bill.
 *
 * Two stages, so the LLM only sees mail that's plausibly a bill:
 *   1. `looksLikeBill` — cheap, pure keyword gate over subject/sender/body.
 *   2. `extractBill`   — Gemini (or Claude) with a strict schema; falls back
 *                        to `heuristicExtract` when no LLM key is set.
 *
 * The same shape is produced by the Android notification listener, so both
 * sources land in one `detected_bills` inbox.
 */

export interface DetectedBillDraft {
  biller_name: string;
  kind: BillKind;
  amount: number | null;
  due_date: string | null; // YYYY-MM-DD
  bill_date: string | null;
  account_hint: string | null;
  confidence: "high" | "low";
}

export interface DetectSource {
  subject: string;
  from: string;
  body: string;
}

/**
 * Gmail search query. Deliberately narrow — every extra message is an LLM
 * call. `category:promotions` is excluded because marketing mail is full of
 * "pay now" language and produces almost all the false positives.
 */
export const BILL_QUERY = [
  "newer_than:45d",
  "-category:promotions",
  "-category:social",
  "(",
  [
    'subject:(bill OR "e-bill" OR statement OR invoice OR "due" OR "payment reminder" OR premium)',
    'subject:("total amount due" OR "minimum amount due" OR "bill generated")',
  ].join(" OR "),
  ")",
].join(" ");

// Words that make a message look like a bill *demand* rather than a receipt.
const BILL_SIGNALS = [
  "amount due",
  "total due",
  "due date",
  "payable",
  "bill amount",
  "minimum amount due",
  "bill generated",
  "statement",
  "outstanding",
  "kindly pay",
  "please pay",
  "pay by",
  "e-bill",
  "invoice",
  "premium due",
  // How most Indian utility bills actually phrase it. Safe to include because
  // a rupee figure is still required below before anything is treated as a bill.
  "due on",
  "bill of",
  "bill for",
  "your bill",
];

// Words that mean it's already settled, or isn't a bill at all.
const NEGATIVE_SIGNALS = [
  "payment received",
  "payment successful",
  "thank you for your payment",
  "successfully paid",
  "has been credited",
  "order confirmed",
  "shipped",
  "otp",
  "one time password",
  "unsubscribe from these alerts",
  "job alert",
  "newsletter",
];

import { aliasesFor, DISCOMS, GAS_BILLERS, WATER_BILLERS } from "./billers";

const KIND_KEYWORDS: Array<[BillKind, string[]]> = [
  [
    "electricity",
    [
      "electricity",
      "power",
      "units consumed",
      // Every state DISCOM by name and abbreviation, from the shared list.
      ...aliasesFor(DISCOMS),
    ],
  ],
  [
    "credit_card",
    [
      "credit card",
      "card statement",
      "minimum amount due",
      "total amount due",
      "card ending",
      "statement period",
    ],
  ],
  [
    "mobile",
    [
      "mobile",
      "postpaid",
      "airtel",
      "jio",
      "vodafone",
      "vi postpaid",
      "bsnl",
      "recharge",
    ],
  ],
  [
    "internet",
    [
      "broadband",
      "fiber",
      "fibre",
      "internet",
      "wifi",
      "act fibernet",
      "hathway",
      "excitel",
    ],
  ],
  [
    "gas",
    [
      "gas",
      "lpg",
      "indane",
      "hp gas",
      "bharat gas",
      "piped natural gas",
      "png",
      ...aliasesFor(GAS_BILLERS),
    ],
  ],
  ["water", ["water", "jal board", "water tax", ...aliasesFor(WATER_BILLERS)]],
  [
    "insurance",
    ["insurance", "premium", "policy", "lic", "hdfc life", "renewal premium"],
  ],
  ["rent", ["rent", "maintenance charges", "society dues"]],
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");

/** Cheap gate: is this worth spending an LLM call on? */
export function looksLikeBill(msg: DetectSource): boolean {
  const haystack = norm(
    `${msg.subject}\n${msg.from}\n${msg.body.slice(0, 4000)}`,
  );
  if (NEGATIVE_SIGNALS.some((w) => haystack.includes(w))) return false;
  if (!BILL_SIGNALS.some((w) => haystack.includes(w))) return false;
  // A bill always names a number. No rupee figure anywhere → not a bill.
  return /(?:₹|rs\.?|inr)\s?[\d,]+(?:\.\d{1,2})?/i.test(haystack);
}

/** Best-guess bill type from any text. Used by both the LLM and the fallback. */
export function guessKind(text: string): BillKind {
  const h = norm(text);
  for (const [kind, words] of KIND_KEYWORDS)
    if (words.some((w) => h.includes(w))) return kind;
  return "other";
}

/** Sender display name, e.g. `"BSES Rajdhani" <no-reply@bses.co.in>` → BSES Rajdhani. */
export function senderName(from: string): string {
  const display = /^\s*"?([^"<]+?)"?\s*</.exec(from)?.[1]?.trim();
  if (display) return display.slice(0, 60);
  const domain = /@([\w.-]+)/.exec(from)?.[1] ?? from;
  const label =
    domain
      .replace(/\.(com|in|co\.in|net|org)$/i, "")
      .split(".")
      .pop() ?? domain;
  return (label.charAt(0).toUpperCase() + label.slice(1)).slice(0, 60);
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** Parse the date formats Indian billers actually use → YYYY-MM-DD. */
export function parseLooseDate(raw: string, todayIST: string): string | null {
  const s = raw.trim().toLowerCase();
  const thisYear = Number(todayIST.slice(0, 4));
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return s;

  // 05/09/2026, 05-09-26, 5.9.2026 — day first, as used in India.
  const numeric = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(s);
  if (numeric) {
    const [, d, m, y] = numeric;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    return ymd(year, Number(m), Number(d));
  }

  // 05 Sep 2026 / 5 September / Sep 05, 2026
  const dmy = /^(\d{1,2})\s*[-\s]\s*([a-z]{3,})\.?,?\s*(\d{2,4})?$/.exec(s);
  if (dmy && MONTHS[dmy[2].slice(0, 3)]) {
    const year = dmy[3]
      ? dmy[3].length === 2
        ? 2000 + Number(dmy[3])
        : Number(dmy[3])
      : thisYear;
    return ymd(year, MONTHS[dmy[2].slice(0, 3)], Number(dmy[1]));
  }
  const mdy = /^([a-z]{3,})\.?\s+(\d{1,2}),?\s*(\d{2,4})?$/.exec(s);
  if (mdy && MONTHS[mdy[1].slice(0, 3)]) {
    const year = mdy[3]
      ? mdy[3].length === 2
        ? 2000 + Number(mdy[3])
        : Number(mdy[3])
      : thisYear;
    return ymd(year, MONTHS[mdy[1].slice(0, 3)], Number(mdy[2]));
  }
  return null;
}

function ymd(y: number, m: number, d: number): string | null {
  if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 31) || !(y >= 2000 && y <= 2100))
    return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const AMOUNT_RE = /(?:₹|rs\.?|inr)\s?([\d,]+(?:\.\d{1,2})?)/gi;

const DUE_KEYWORDS =
  /(?:due\s*date|payment\s*due|pay\s*by|last\s*date|due\s*on)/i;
/** The date shapes `parseLooseDate` understands, for spotting one inside prose. */
const DATE_PATTERN = new RegExp(
  [
    "\\d{4}-\\d{2}-\\d{2}",
    "\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{2,4}",
    "\\d{1,2}\\s*[-\\s]\\s*[A-Za-z]{3,9}\\.?,?(?:\\s*\\d{2,4})?",
    "[A-Za-z]{3,9}\\.?\\s+\\d{1,2},?(?:\\s*\\d{2,4})?",
  ].join("|"),
);

/**
 * First date that follows due-date wording. Scanning a short window after the
 * keyword avoids swallowing the next sentence, which a single greedy pattern
 * across a multi-line body will happily do.
 */
export function findDueDate(text: string, todayIST: string): string | null {
  const key = DUE_KEYWORDS.exec(text);
  if (!key) return null;
  const from = key.index + key[0].length;
  const found = DATE_PATTERN.exec(text.slice(from, from + 60));
  return found ? parseLooseDate(found[0], todayIST) : null;
}

/** No-LLM fallback: regex out the due amount and date. Low confidence by design. */
export function heuristicExtract(
  msg: DetectSource,
  todayIST: string,
): DetectedBillDraft | null {
  const text = `${msg.subject}\n${msg.body}`;
  // Prefer a figure that sits next to due/payable wording.
  const near =
    /(?:total\s+amount\s+due|amount\s+due|total\s+due|bill\s+amount|payable|amount\s+payable)[^\d₹]{0,40}(?:₹|rs\.?|inr)?\s?([\d,]+(?:\.\d{1,2})?)/i.exec(
      text,
    );
  let amount: number | null = near ? Number(near[1].replace(/,/g, "")) : null;
  if (amount == null) {
    const all = [...text.matchAll(AMOUNT_RE)].map((m) =>
      Number(m[1].replace(/,/g, "")),
    );
    amount = all.length ? Math.max(...all) : null;
  }
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;

  const hint =
    /(?:ending|ending\s*with|xx+|[*•]{2,})\s*(\d{4})/i.exec(text)?.[1] ?? null;

  return {
    biller_name: senderName(msg.from),
    kind: guessKind(`${msg.subject} ${msg.from} ${msg.body.slice(0, 2000)}`),
    amount,
    due_date: findDueDate(text, todayIST),
    bill_date: null,
    account_hint: hint ? `••${hint}` : null,
    confidence: "low",
  };
}

// ── LLM extraction ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = [
  "You read bill and statement emails received by a person in India and extract the payment due.",
  "Only treat a message as a bill if it ASKS for a payment that is still outstanding.",
  "A payment confirmation, receipt, OTP, promotion, or delivery update is NOT a bill — set is_bill false.",
  "Amounts are INR. For a credit card statement use the TOTAL amount due, not the minimum.",
  "Resolve every date against today's date and return it as YYYY-MM-DD.",
  "biller_name is the company that issued the bill, as a person would say it (e.g. 'BSES Rajdhani', 'HDFC Credit Card').",
  "account_hint is the masked account/consumer/card identifier if one is shown, e.g. '••4321'. Never return a full number.",
  "Set confidence high only when both the amount and the biller are unambiguous.",
].join(" ");

const KINDS = [
  "electricity",
  "water",
  "gas",
  "credit_card",
  "rent",
  "internet",
  "mobile",
  "insurance",
  "other",
];

const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    is_bill: { type: "BOOLEAN" },
    biller_name: { type: "STRING", nullable: true },
    kind: { type: "STRING", enum: KINDS },
    amount: {
      type: "NUMBER",
      nullable: true,
      description: "Total due in rupees",
    },
    due_date: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
    bill_date: { type: "STRING", nullable: true, description: "YYYY-MM-DD" },
    account_hint: {
      type: "STRING",
      nullable: true,
      description: "Masked id like ••4321",
    },
    confidence: { type: "STRING", enum: ["high", "low"] },
  },
  required: ["is_bill", "kind", "confidence"],
} as const;

interface RawExtract {
  is_bill?: boolean;
  biller_name?: string | null;
  kind?: string | null;
  amount?: number | null;
  due_date?: string | null;
  bill_date?: string | null;
  account_hint?: string | null;
  confidence?: "high" | "low";
}

/** Clamp whatever the model returned into a trustworthy draft. */
export function normalizeExtract(
  raw: RawExtract,
  msg: DetectSource,
  todayIST: string,
): DetectedBillDraft | null {
  if (!raw.is_bill) return null;
  const amount =
    raw.amount != null &&
    Number.isFinite(Number(raw.amount)) &&
    Number(raw.amount) > 0
      ? Number(raw.amount)
      : null;
  if (amount == null) return null; // a bill with no amount isn't actionable
  const kind = (
    KINDS.includes(raw.kind ?? "") ? raw.kind : null
  ) as BillKind | null;
  const date = (v: string | null | undefined) =>
    v ? parseLooseDate(v, todayIST) : null;
  return {
    biller_name: (raw.biller_name?.trim() || senderName(msg.from)).slice(0, 60),
    kind: kind ?? guessKind(`${msg.subject} ${msg.from}`),
    amount,
    due_date: date(raw.due_date),
    bill_date: date(raw.bill_date),
    account_hint: raw.account_hint?.trim().slice(0, 20) || null,
    confidence: raw.confidence === "high" ? "high" : "low",
  };
}

/** Trim to what matters — bill mail is mostly boilerplate and footers. */
function promptFor(msg: DetectSource, todayIST: string): string {
  return [
    `Today's date (IST): ${todayIST}`,
    `From: ${msg.from}`,
    `Subject: ${msg.subject}`,
    "",
    msg.body.slice(0, 6000),
  ].join("\n");
}

export async function extractBill(
  msg: DetectSource,
  todayIST: string,
): Promise<DetectedBillDraft | null> {
  try {
    if (process.env.GEMINI_API_KEY) {
      const raw = await extractWithGemini(msg, todayIST);
      return raw ? normalizeExtract(raw, msg, todayIST) : null;
    }
    if (process.env.ANTHROPIC_API_KEY) {
      const raw = await extractWithClaude(msg, todayIST);
      return raw ? normalizeExtract(raw, msg, todayIST) : null;
    }
  } catch (err) {
    console.error("bill extraction failed", err);
  }
  // No key, or the provider errored — regex is better than nothing.
  return heuristicExtract(msg, todayIST);
}

async function extractWithGemini(
  msg: DetectSource,
  todayIST: string,
): Promise<RawExtract | null> {
  const model = process.env.LLM_MODEL || "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: promptFor(msg, todayIST) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_SCHEMA,
          temperature: 0,
        },
      }),
    },
  );
  if (!res.ok) {
    console.error("gemini bill extract failed", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? (JSON.parse(text) as RawExtract) : null;
}

const CLAUDE_SCHEMA = {
  type: "object",
  properties: {
    is_bill: { type: "boolean" },
    biller_name: { type: ["string", "null"] },
    kind: { type: "string", enum: KINDS },
    amount: { type: ["number", "null"] },
    due_date: { type: ["string", "null"] },
    bill_date: { type: ["string", "null"] },
    account_hint: { type: ["string", "null"] },
    confidence: { type: "string", enum: ["high", "low"] },
  },
  required: [
    "is_bill",
    "biller_name",
    "kind",
    "amount",
    "due_date",
    "bill_date",
    "account_hint",
    "confidence",
  ],
  additionalProperties: false,
} as const;

async function extractWithClaude(
  msg: DetectSource,
  todayIST: string,
): Promise<RawExtract | null> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: process.env.LLM_MODEL || "claude-opus-5",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: CLAUDE_SCHEMA },
    },
    messages: [{ role: "user", content: promptFor(msg, todayIST) }],
  } as Anthropic.MessageCreateParamsNonStreaming);
  if (response.stop_reason === "refusal") return null;
  const block = response.content.find((b) => b.type === "text");
  return block && block.type === "text"
    ? (JSON.parse(block.text) as RawExtract)
    : null;
}
