import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { parseReceipt } from "./llm";
import type { CategoryRule } from "./parser";

/**
 * Integration test for receipt-photo extraction. Hits the real Gemini API, so
 * it only runs when GEMINI_API_KEY (and RECEIPT_IMAGE path) are set:
 *
 *   $env:GEMINI_API_KEY="..."; $env:RECEIPT_IMAGE="path\to\receipt.png"; npx vitest run llm.receipt
 *
 * In a plain `npm test` (no env), it's skipped.
 */

const CATEGORIES: CategoryRule[] = [
  { name: "Food delivery", keywords: [] },
  { name: "Groceries", keywords: [] },
  { name: "Transport", keywords: [] },
  { name: "Health", keywords: [] },
  { name: "Shopping", keywords: [] },
  { name: "Dining out", keywords: [] },
];

const enabled = Boolean(
  process.env.GEMINI_API_KEY && process.env.RECEIPT_IMAGE,
);

describe.skipIf(!enabled)("parseReceipt (live Gemini)", () => {
  it("extracts grand total, merchant, date and category from a pharmacy receipt", async () => {
    const image = readFileSync(process.env.RECEIPT_IMAGE!);
    const result = await parseReceipt(
      image.buffer.slice(
        image.byteOffset,
        image.byteOffset + image.byteLength,
      ) as ArrayBuffer,
      "image/png",
      null,
      CATEGORIES,
      "2026-08-16",
    );

    expect(result).not.toBeNull();
    // Grand total is 343.00 — NOT the subtotal (317.50) or an item price.
    expect(result!.amount).toBe(343);
    expect(result!.category).toBe("Health");
    expect(result!.merchant?.toLowerCase()).toContain("sharma");
    expect(result!.expense_date).toBe("2026-08-16");
  }, 30000);
});
