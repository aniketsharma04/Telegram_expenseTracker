"use client";

import type { Expense } from "@/lib/types";
import { formatINR } from "./theme";

interface Props {
  expenses: Expense[];
  today: string; // YYYY-MM-DD (IST)
  monthPrefix: string; // YYYY-MM (IST)
}

export default function StatTiles({ expenses, today, monthPrefix }: Props) {
  const thisMonth = expenses.filter((e) =>
    e.expense_date.startsWith(monthPrefix),
  );
  const monthTotal = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
  const todayTotal = thisMonth
    .filter((e) => e.expense_date === today)
    .reduce((s, e) => s + Number(e.amount), 0);

  const byCategory = new Map<string, number>();
  for (const e of thisMonth) {
    byCategory.set(
      e.category,
      (byCategory.get(e.category) ?? 0) + Number(e.amount),
    );
  }
  let topCategory = "—";
  let topAmount = 0;
  for (const [name, total] of byCategory) {
    if (total > topAmount) {
      topAmount = total;
      topCategory = name;
    }
  }

  return (
    <div className="tiles">
      <div className="card tile">
        <div className="label">Spent this month</div>
        <div className="value">{formatINR(monthTotal)}</div>
      </div>
      <div className="card tile">
        <div className="label">Spent today</div>
        <div className="value">{formatINR(todayTotal)}</div>
      </div>
      <div className="card tile">
        <div className="label">Transactions this month</div>
        <div className="value">{thisMonth.length}</div>
      </div>
      <div className="card tile">
        <div className="label">Top category</div>
        <div className="value" style={{ fontSize: 20 }}>
          {topCategory}
        </div>
        {topAmount > 0 && <div className="sub">{formatINR(topAmount)}</div>}
      </div>
    </div>
  );
}
