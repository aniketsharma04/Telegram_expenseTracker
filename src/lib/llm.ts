import Anthropic from "@anthropic-ai/sdk";
import type { CategoryRule } from "./parser";

/**
 * LLM fallback (v2): anything the rules parser can't confidently handle gets
 * sent to Claude with a strict JSON schema, so we always get structured fields
 * back. Only called when ANTHROPIC_API_KEY is configured.
 */

export interface LLMParse {
  amount: number | null;
  merchant: string | null;
  category: string | null;
  expense_date: string | null; // YYYY-MM-DD
  confidence: "high" | "low";
  clarifying_question: string | null;
}

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    amount: {
      type: ["number", "null"],
      description: "The amount spent in rupees, or null if no amount can be found",
    },
    merchant: {
      type: ["string", "null"],
      description: "Short merchant/what-it-was label, title-cased, e.g. 'Zomato' or 'Birthday Gift'",
    },
    category: {
      type: ["string", "null"],
      description: "Exactly one of the provided category names, or null if none fits",
    },
    expense_date: {
      type: ["string", "null"],
      description: "Date the money was spent (YYYY-MM-DD), or null if not mentioned",
    },
    confidence: {
      type: "string",
      enum: ["high", "low"],
      description: "high only when amount AND category are clear from the message",
    },
    clarifying_question: {
      type: ["string", "null"],
      description: "One short question to ask the user when confidence is low or the amount is missing",
    },
  },
  required: ["amount", "merchant", "category", "expense_date", "confidence", "clarifying_question"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = [
  "You parse casual personal expense messages from a user in India into structured data.",
  "Messages may be sloppy, misspelled, transcribed from voice notes, or in Hinglish.",
  "Amounts are in INR unless stated otherwise; 'k' means thousands (1.5k = 1500).",
  "Pick a category ONLY from the provided list, matching on the merchant or what was bought.",
  "Set expense_date only when the message references a date or relative day; resolve it against today's date.",
].join(" ");

export function llmModel(): string {
  return process.env.LLM_MODEL || "claude-opus-5";
}

export async function parseWithLLM(
  text: string,
  categories: CategoryRule[],
  todayIST: string
): Promise<LLMParse | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic();
  const categoryLines = categories
    .filter((c) => c.name !== "Uncategorized")
    .map((c) => `- ${c.name}${c.keywords.length ? ` (e.g. ${c.keywords.slice(0, 6).join(", ")})` : ""}`)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: llmModel(),
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: `Today's date (IST): ${todayIST}\n\nCategories:\n${categoryLines}\n\nExpense message: "${text}"`,
        },
      ],
    } as Anthropic.MessageCreateParamsNonStreaming);

    if (response.stop_reason === "refusal") return null;
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    return JSON.parse(block.text) as LLMParse;
  } catch (err) {
    console.error("LLM fallback failed", err);
    return null;
  }
}
