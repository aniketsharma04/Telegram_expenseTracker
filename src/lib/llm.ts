import Anthropic from "@anthropic-ai/sdk";
import type { CategoryRule } from "./parser";

/**
 * LLM fallback (v2): anything the rules parser can't confidently handle gets
 * sent to an LLM with a strict JSON schema, so we always get structured
 * fields back.
 *
 * Provider is picked from the environment: GEMINI_API_KEY → Google Gemini
 * (current setup), else ANTHROPIC_API_KEY → Claude. Neither set → no fallback.
 */

export interface LLMParse {
  amount: number | null;
  merchant: string | null;
  category: string | null;
  expense_date: string | null; // YYYY-MM-DD
  confidence: "high" | "low";
  clarifying_question: string | null;
}

/**
 * A receipt carries more than an expense does: the lines that make up the
 * total, and the tax/tip/discount that explain the gap between them (v10).
 */
export interface ReceiptLine {
  name: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
}

export interface ReceiptParse extends LLMParse {
  items: ReceiptLine[];
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  tip: number | null;
  bill_number: string | null;
}

const SYSTEM_PROMPT = [
  "You parse casual personal expense messages from a user in India into structured data.",
  "Messages may be sloppy, misspelled, transcribed from voice notes, or in Hinglish.",
  "Amounts are in INR unless stated otherwise; 'k' means thousands (1.5k = 1500).",
  "Pick a category ONLY from the provided list, matching on the merchant or what was bought.",
  "Set expense_date only when the message references a date or relative day; resolve it against today's date.",
  "Set confidence to high only when both the amount and the category are clear.",
].join(" ");

function userPrompt(
  text: string,
  categories: CategoryRule[],
  todayIST: string,
): string {
  const categoryLines = categories
    .filter((c) => c.name !== "Uncategorized")
    .map(
      (c) =>
        `- ${c.name}${c.keywords.length ? ` (e.g. ${c.keywords.slice(0, 6).join(", ")})` : ""}`,
    )
    .join("\n");
  return `Today's date (IST): ${todayIST}\n\nCategories:\n${categoryLines}\n\nExpense message: "${text}"`;
}

export async function parseWithLLM(
  text: string,
  categories: CategoryRule[],
  todayIST: string,
): Promise<LLMParse | null> {
  try {
    if (process.env.GEMINI_API_KEY)
      return await parseWithGemini(text, categories, todayIST);
    if (process.env.ANTHROPIC_API_KEY)
      return await parseWithClaude(text, categories, todayIST);
    return null;
  } catch (err) {
    console.error("LLM fallback failed", err);
    return null;
  }
}

// ── Gemini ──────────────────────────────────────────────────────────────────

const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    amount: {
      type: "NUMBER",
      nullable: true,
      description: "Amount spent in rupees, null if missing",
    },
    merchant: {
      type: "STRING",
      nullable: true,
      description: "Short title-cased merchant/what-it-was label",
    },
    category: {
      type: "STRING",
      nullable: true,
      description: "Exactly one of the provided category names, or null",
    },
    expense_date: {
      type: "STRING",
      nullable: true,
      description: "YYYY-MM-DD, only if the message implies a date",
    },
    confidence: { type: "STRING", enum: ["high", "low"] },
    clarifying_question: {
      type: "STRING",
      nullable: true,
      description:
        "One short question when confidence is low or amount missing",
    },
  },
  required: [
    "amount",
    "merchant",
    "category",
    "expense_date",
    "confidence",
    "clarifying_question",
  ],
};

async function parseWithGemini(
  text: string,
  categories: CategoryRule[],
  todayIST: string,
): Promise<LLMParse | null> {
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
        contents: [
          { parts: [{ text: userPrompt(text, categories, todayIST) }] },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_SCHEMA,
          temperature: 0,
        },
      }),
    },
  );
  if (!res.ok) {
    console.error("gemini request failed", res.status, await res.text());
    return null;
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return null;
  return JSON.parse(raw) as LLMParse;
}

// ── Receipt photos (v3) — Gemini vision reads the bill directly ────────────

const RECEIPT_PROMPT = [
  "This image is a receipt, bill, or payment screenshot from India.",
  "Extract the expense: the grand TOTAL actually paid (after taxes and discounts — not the subtotal or an item price),",
  "the merchant/store name, and the receipt date if visible.",
  "Also list every ordered line item exactly as printed, in order, with its quantity, unit price and line total.",
  "Read only real purchased lines — never turn a subtotal, tax, service charge, discount, tip, round-off or grand total into an item.",
  "Put those in their own fields instead, and leave any field you cannot read as null rather than guessing.",
  "If the image is not a receipt or no total can be read, return amount null with a clarifying question.",
].join(" ");

/** The expense fields plus the bill breakdown. */
const RECEIPT_SCHEMA = {
  type: "OBJECT",
  properties: {
    ...GEMINI_SCHEMA.properties,
    items: {
      type: "ARRAY",
      description: "Every purchased line on the bill, in printed order",
      items: {
        type: "OBJECT",
        properties: {
          name: {
            type: "STRING",
            nullable: true,
            description: "Item name as printed",
          },
          quantity: { type: "NUMBER", nullable: true },
          unit_price: {
            type: "NUMBER",
            nullable: true,
            description: "Price for one unit",
          },
          amount: { type: "NUMBER", nullable: true, description: "Line total" },
        },
        required: ["name", "quantity", "unit_price", "amount"],
      },
    },
    subtotal: {
      type: "NUMBER",
      nullable: true,
      description: "Total before tax",
    },
    tax: {
      type: "NUMBER",
      nullable: true,
      description: "GST/VAT plus service charge",
    },
    discount: {
      type: "NUMBER",
      nullable: true,
      description: "Discount as a positive number",
    },
    tip: { type: "NUMBER", nullable: true },
    bill_number: {
      type: "STRING",
      nullable: true,
      description: "Invoice/bill number",
    },
  },
  required: [
    ...GEMINI_SCHEMA.required,
    "items",
    "subtotal",
    "tax",
    "discount",
    "tip",
    "bill_number",
  ],
};

export async function parseReceipt(
  image: ArrayBuffer,
  mimeType: string,
  caption: string | null,
  categories: CategoryRule[],
  todayIST: string,
): Promise<ReceiptParse | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  const model = process.env.LLM_MODEL || "gemini-2.5-flash";

  const categoryLines = categories
    .filter((c) => c.name !== "Uncategorized")
    .map((c) => `- ${c.name}`)
    .join("\n");
  const captionNote = caption
    ? `\nThe user attached this note to the photo: "${caption}"`
    : "";

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": process.env.GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: Buffer.from(image).toString("base64"),
                  },
                },
                {
                  text: `${RECEIPT_PROMPT}${captionNote}\n\nToday's date (IST): ${todayIST}\n\nCategories:\n${categoryLines}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RECEIPT_SCHEMA,
            temperature: 0,
          },
        }),
      },
    );
    if (!res.ok) {
      console.error(
        "gemini receipt request failed",
        res.status,
        await res.text(),
      );
      return null;
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReceiptParse;
    // An older model response (or a re-run against the plain schema) simply
    // has no lines; the caller treats that as "total only", not an error.
    return {
      ...parsed,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch (err) {
    console.error("receipt parse failed", err);
    return null;
  }
}

// ── Claude (alternative provider — used when only ANTHROPIC_API_KEY is set) ─

const CLAUDE_SCHEMA = {
  type: "object",
  properties: {
    amount: { type: ["number", "null"] },
    merchant: { type: ["string", "null"] },
    category: { type: ["string", "null"] },
    expense_date: { type: ["string", "null"] },
    confidence: { type: "string", enum: ["high", "low"] },
    clarifying_question: { type: ["string", "null"] },
  },
  required: [
    "amount",
    "merchant",
    "category",
    "expense_date",
    "confidence",
    "clarifying_question",
  ],
  additionalProperties: false,
} as const;

async function parseWithClaude(
  text: string,
  categories: CategoryRule[],
  todayIST: string,
): Promise<LLMParse | null> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: process.env.LLM_MODEL || "claude-opus-5",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: CLAUDE_SCHEMA },
    },
    messages: [
      { role: "user", content: userPrompt(text, categories, todayIST) },
    ],
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") return null;
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  return JSON.parse(block.text) as LLMParse;
}
