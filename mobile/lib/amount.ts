/**
 * Read a rupee amount the way people type it: "100000", "1,00,000",
 * "₹50,000", "1 lakh", "1.5L", "2 lac", "50k", "1.2 cr". Null when it isn't one.
 */
export function parseAmount(raw: string): number | null {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/₹|rs\.?|inr/g, "")
    .replace(/,/g, "")
    .trim();
  if (!s) return null;
  const m = s.match(
    /^(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|l|k|thousand|cr|crores?)?$/,
  );
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] ?? "";
  const mult = /^(lakh|lac|l)/.test(unit)
    ? 100_000
    : /^(k|thousand)/.test(unit)
      ? 1_000
      : /^cr/.test(unit)
        ? 10_000_000
        : 1;
  const value = Math.round(n * mult);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
