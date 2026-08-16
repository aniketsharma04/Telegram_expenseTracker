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

const SYSTEM_PROMPT = [
  "You parse casual personal expense messages from a user in India into structured data.",
  "Messages may be sloppy, misspelled, transcribed from voice notes, or in Hinglish.",
  "Amounts are in INR unless stated otherwise; 'k' means thousands (1.5k = 1500).",
  "Pick a category ONLY from the provided list, matching on the merchant or what was bought.",
  "Set expense_date only when the message references a date or relative day; resolve it against today's date.",
  "Set confidence to high only when both the amount and the category are clear.",
].join(" ");

function userPrompt(text: string, categories: CategoryRule[], todayIST: string): string {
  const categoryLines = categories
    .filter((c) => c.name !== "Uncategorized")
    .map((c) => `- ${c.name}${c.keywords.length ? ` (e.g. ${c.keywords.slice(0, 6).join(", ")})` : ""}`)
    .join("\n");
  return `Today's date (IST): ${todayIST}\n\nCategories:\n${categoryLines}\n\nExpense message: "${text}"`;
}

export async function parseWithLLM(
  text: string,
  categories: CategoryRule[],
  todayIST: string
): Promise<LLMParse | null> {
  try {
    if (process.env.GEMINI_API_KEY) return await parseWithGemini(text, categories, todayIST);
    if (process.env.ANTHROPIC_API_KEY) return await parseWithClaude(text, categories, todayIST);
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
    amount: { type: "NUMBER", nullable: true, description: "Amount spent in rupees, null if missing" },
    merchant: { type: "STRING", nullable: true, description: "Short title-cased merchant/what-it-was label" },
    category: { type: "STRING", nullable: true, description: "Exactly one of the provided category names, or null" },
    expense_date: { type: "STRING", nullable: true, description: "YYYY-MM-DD, only if the message implies a date" },
    confidence: { type: "STRING", enum: ["high", "low"] },
    clarifying_question: { type: "STRING", nullable: true, description: "One short question when confidence is low or amount missing" },
  },
  required: ["amount", "merchant", "category", "expense_date", "confidence", "clarifying_question"],
};

async function parseWithGemini(
  text: string,
  categories: CategoryRule[],
  todayIST: string
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
        contents: [{ parts: [{ text: userPrompt(text, categories, todayIST) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_SCHEMA,
          temperature: 0,
        },
      }),
    }
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
  required: ["amount", "merchant", "category", "expense_date", "confidence", "clarifying_question"],
  additionalProperties: false,
} as const;

async function parseWithClaude(
  text: string,
  categories: CategoryRule[],
  todayIST: string
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
    messages: [{ role: "user", content: userPrompt(text, categories, todayIST) }],
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (response.stop_reason === "refusal") return null;
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  return JSON.parse(block.text) as LLMParse;
}
