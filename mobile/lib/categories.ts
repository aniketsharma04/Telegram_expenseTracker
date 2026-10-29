import type { IconName } from "../components/ui";

/** Line icon per category — the leading bubble on every spend row. */
const ICONS: Record<string, IconName> = {
  "Food delivery": "package",
  Groceries: "shopping-cart",
  Transport: "navigation",
  Shopping: "shopping-bag",
  Entertainment: "film",
  "Utilities & bills": "zap",
  Health: "heart",
  "Dining out": "coffee",
  "Personal care": "scissors",
  Investments: "trending-up",
  "Loans & EMI": "credit-card",
  Travel: "map",
  Education: "book-open",
  "Gifts & donations": "gift",
};

export function categoryIcon(category: string): IconName {
  return ICONS[category] ?? "circle";
}

/** The category's colour at low strength — the bubble's background. */
export function tint(hex: string, dark: boolean): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return dark ? "rgba(255,255,255,0.08)" : "#f1efe9";
  return `#${clean}${dark ? "33" : "1f"}`;
}

/** "9:12 AM" from an ISO timestamp, in the phone's local time. */
export function clockTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const am = h < 12;
  h = h % 12 || 12;
  return `${h}:${m} ${am ? "AM" : "PM"}`;
}

/** Bills, accounts and inbox notices — same line-icon set as categories. */
export const BILL_KIND_ICON: Record<string, IconName> = {
  electricity: "zap",
  water: "droplet",
  gas: "thermometer",
  credit_card: "credit-card",
  rent: "home",
  internet: "wifi",
  mobile: "smartphone",
  insurance: "shield",
  other: "file-text",
};

export const ACCOUNT_KIND_ICON: Record<string, IconName> = {
  bank: "briefcase",
  cash: "dollar-sign",
  wallet: "smartphone",
  credit_card: "credit-card",
};

export const NOTICE_KIND_ICON: Record<string, IconName> = {
  daily: "sun",
  spend: "arrow-down-right",
  alerts: "alert-triangle",
  digest: "bar-chart-2",
};
