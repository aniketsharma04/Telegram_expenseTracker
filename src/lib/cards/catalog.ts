import type { CardProduct } from "./types";
import { CARDS } from "./catalog-data";

/**
 * The card catalogue: reward rules for the cards most Indians hold, written
 * as rupee value per ₹100 so every card compares on one scale. Curated by
 * hand from the banks' own terms (MITC / product pages) and re-checked when
 * banks change rules — each card carries the date it was last verified.
 *
 * Review monthly, and again after the April and July rule changes that
 * banks cluster around.
 */
export const CATALOG: CardProduct[] = CARDS;

const BY_KEY = new Map(CATALOG.map((c) => [c.key, c]));

export function productByKey(
  key: string | null | undefined,
): CardProduct | null {
  return key ? (BY_KEY.get(key) ?? null) : null;
}

/** The oldest check among the cards, shown as "rules last checked …". */
export const CATALOG_VERIFIED: string = CATALOG.reduce(
  (min, c) => (c.verified < min ? c.verified : min),
  CATALOG[0]?.verified ?? "2026-11-01",
);
