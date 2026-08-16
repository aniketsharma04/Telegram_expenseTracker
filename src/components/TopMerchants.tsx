"use client";

import { useMemo } from "react";
import type { Expense } from "@/lib/types";
import { CHROME, formatINR, useIsDark } from "./theme";

const MAX_ROWS = 7;

export default function TopMerchants({ expenses }: { expenses: Expense[] }) {
  const dark = useIsDark();
  const chrome = dark ? CHROME.dark : CHROME.light;

  const rows = useMemo(() => {
    const totals = new Map<string, { total: number; count: number }>();
    for (const e of expenses) {
      const key = e.merchant?.trim();
      if (!key) continue;
      const entry = totals.get(key) ?? { total: 0, count: 0 };
      entry.total += Number(e.amount);
      entry.count += 1;
      totals.set(key, entry);
    }
    return [...totals.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, MAX_ROWS);
  }, [expenses]);

  if (rows.length === 0) {
    return <div className="empty-state">No merchants in this period yet.</div>;
  }

  const max = rows[0].total;

  return (
    <div className="merchant-list">
      {rows.map((r) => (
        <div className="merchant-row" key={r.name}>
          <div className="merchant-meta">
            <span className="merchant-name">{r.name}</span>
            <span className="merchant-amount">
              {formatINR(r.total)}
              <span className="merchant-count"> · {r.count}×</span>
            </span>
          </div>
          <div className="merchant-track">
            <div
              className="merchant-bar"
              style={{ width: `${Math.max(2, (r.total / max) * 100)}%`, background: chrome.accent }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
