"use client";

import type { Expense } from "@/lib/types";
import { formatINR } from "./theme";

interface Props {
  filtered: Expense[]; // expenses in the selected range + category
  prev: Expense[]; // comparison window
  prevLabel: string;
  rangeLabel: string;
  today: string;
}

function total(list: Expense[]): number {
  return list.reduce((s, e) => s + Number(e.amount), 0);
}

export default function StatTiles({ filtered, prev, prevLabel, rangeLabel, today }: Props) {
  const periodTotal = total(filtered);
  const prevTotal = total(prev);
  const todayTotal = total(filtered.filter((e) => e.expense_date === today));

  let comparison: string | null = null;
  if (prevTotal > 0) {
    const pct = Math.round(((periodTotal - prevTotal) / prevTotal) * 100);
    const arrow = pct > 0 ? "↑" : pct < 0 ? "↓" : "→";
    comparison = `${prevLabel}: ${formatINR(prevTotal)} (${arrow} ${Math.abs(pct)}%)`;
  }

  const byCategory = new Map<string, number>();
  for (const e of filtered) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount));
  }
  let topCategory = "—";
  let topAmount = 0;
  for (const [name, sum] of byCategory) {
    if (sum > topAmount) {
      topAmount = sum;
      topCategory = name;
    }
  }

  return (
    <div className="tiles">
      <div className="card tile">
        <div className="label">Spent · {rangeLabel.toLowerCase()}</div>
        <div className="value">{formatINR(periodTotal)}</div>
        {comparison && <div className="sub">{comparison}</div>}
      </div>
      <div className="card tile">
        <div className="label">Spent today</div>
        <div className="value">{formatINR(todayTotal)}</div>
      </div>
      <div className="card tile">
        <div className="label">Transactions</div>
        <div className="value">{filtered.length}</div>
      </div>
      <div className="card tile">
        <div className="label">Top category</div>
        <div className="value" style={{ fontSize: 20 }}>{topCategory}</div>
        {topAmount > 0 && <div className="sub">{formatINR(topAmount)}</div>}
      </div>
    </div>
  );
}
