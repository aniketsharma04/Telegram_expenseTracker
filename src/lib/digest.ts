import { SupabaseClient } from "@supabase/supabase-js";
import { NON_SPEND_CATEGORIES } from "./insights";
import { getIncomes } from "./income";
import { getFamily, familyMembers } from "./family";

/** Compose the month-in-review digest sent to each user on the 1st (Telegram HTML). */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmtINR(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function monthAdd(month: string, delta: number): string {
  let [y, m] = month.split("-").map(Number);
  m += delta;
  while (m < 1) { m += 12; y -= 1; }
  while (m > 12) { m -= 12; y += 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export async function composeMonthlyDigest(
  supabase: SupabaseClient,
  userId: number,
  today: string, // YYYY-MM-DD (the 1st when sent by cron)
): Promise<string | null> {
  const lastMonth = monthAdd(today.slice(0, 7), -1);
  const monthBefore = monthAdd(lastMonth, -1);
  const label = `${MONTH_NAMES[Number(lastMonth.slice(5, 7)) - 1]}`;

  const { data, error } = await supabase
    .from("expenses")
    .select("amount, category, merchant, expense_date, user_id")
    .gte("expense_date", `${monthBefore}-01`)
    .lt("expense_date", `${today.slice(0, 7)}-01`);
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    amount: number;
    category: string;
    merchant: string | null;
    expense_date: string;
    user_id: number | null;
  }>;

  const mine = rows.filter((r) => r.user_id === userId);
  const inMonth = (r: { expense_date: string }, m: string) =>
    r.expense_date.startsWith(m);

  const spendable = (r: { category: string }) => !NON_SPEND_CATEGORIES.has(r.category);
  const lastRows = mine.filter((r) => inMonth(r, lastMonth));
  if (lastRows.length === 0) return null; // nothing to report — skip the ping

  const spent = lastRows.filter(spendable).reduce((s, r) => s + Number(r.amount), 0);
  const prevSpent = mine
    .filter((r) => inMonth(r, monthBefore))
    .filter(spendable)
    .reduce((s, r) => s + Number(r.amount), 0);
  const invested = lastRows
    .filter((r) => r.category === "Investments")
    .reduce((s, r) => s + Number(r.amount), 0);

  const byCategory = new Map<string, number>();
  for (const r of lastRows.filter(spendable))
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + Number(r.amount));
  const top = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, sum]) => `• ${name}: ${fmtINR(sum)}`)
    .join("\n");

  const biggest = [...lastRows.filter(spendable)].sort(
    (a, b) => Number(b.amount) - Number(a.amount),
  )[0];

  let trend = "";
  if (prevSpent > 0) {
    const delta = ((spent - prevSpent) / prevSpent) * 100;
    trend =
      Math.abs(delta) < 3
        ? " (about the same as the month before)"
        : delta > 0
          ? ` (↑ ${Math.round(delta)}% vs the month before)`
          : ` (↓ ${Math.round(-delta)}% vs the month before)`;
  }

  let incomeLine = "";
  const incomes = await getIncomes(supabase, userId, `${lastMonth}-01`);
  const earned = incomes
    .filter((i) => inMonth({ expense_date: i.income_date }, lastMonth))
    .reduce((s, i) => s + Number(i.amount), 0);
  if (earned > 0) {
    const kept = earned - spent - invested;
    const rate = Math.round((Math.max(kept, 0) / earned) * 100);
    incomeLine = `\n💵 Earned ${fmtINR(earned)} → kept ${fmtINR(kept)} (${rate}% saved, after ${fmtINR(invested)} invested)`;
  }

  let familyBlock = "";
  try {
    const family = await getFamily(supabase, userId);
    if (family) {
      const members = await familyMembers(supabase, family.id);
      const memberIds = new Set(members.map((m) => m.id));
      const famRows = rows.filter(
        (r) =>
          r.user_id !== null && memberIds.has(r.user_id) && inMonth(r, lastMonth),
      );
      const famSpent = famRows.filter(spendable).reduce((s, r) => s + Number(r.amount), 0);
      const perMember = members
        .map((m) => ({
          name: m.name,
          total: famRows
            .filter((r) => r.user_id === m.id && spendable(r))
            .reduce((s, r) => s + Number(r.amount), 0),
        }))
        .sort((a, b) => b.total - a.total)
        .map((m) => `• ${m.name}: ${fmtINR(m.total)}`)
        .join("\n");
      familyBlock = `\n\n👨‍👩‍👧 <b>${family.name}</b>: ${fmtINR(famSpent)}\n${perMember}`;
    }
  } catch (err) {
    console.error("digest family block failed", err);
  }

  return (
    `📅 <b>${label} in review</b>\n\n` +
    `Spent: ${fmtINR(spent)}${trend}\n` +
    (top ? `${top}\n` : "") +
    (biggest
      ? `💸 Biggest: ${fmtINR(biggest.amount)}${biggest.merchant ? ` — ${biggest.merchant}` : ""} (${biggest.expense_date.slice(8)}‑${MONTH_NAMES[Number(biggest.expense_date.slice(5, 7)) - 1].slice(0, 3)})\n`
      : "") +
    `📈 Invested: ${fmtINR(invested)}` +
    incomeLine +
    familyBlock
  );
}
