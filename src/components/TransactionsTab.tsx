"use client";

import { useMemo, useState } from "react";
import type { Expense } from "@/lib/types";
import { FALLBACK_COLOR, formatINR, memberColor, seriesColor, useIsDark } from "./theme";

interface Props {
  expenses: Expense[]; // already scoped + range-filtered
  categories: string[];
  colorByCategory: Record<string, string>;
  showMember: boolean; // family "all" view → attribute each row to its member
  memberName: Map<number, string>;
  memberIndex: Map<number, number>;
  rangeLabel: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function prettyDate(iso: string, today: string): string {
  if (iso === today) return "Today";
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

const SOURCE_ICON: Record<string, string> = {
  telegram_text: "💬",
  telegram_voice: "🎤",
  telegram_photo: "📷",
};

export default function TransactionsTab({
  expenses,
  categories,
  colorByCategory,
  showMember,
  memberName,
  memberIndex,
  rangeLabel,
}: Props) {
  const dark = useIsDark();
  const [catFilter, setCatFilter] = useState("all");

  const filtered = useMemo(
    () => (catFilter === "all" ? expenses : expenses.filter((e) => e.category === catFilter)),
    [expenses, catFilter]
  );

  const groups = useMemo(() => {
    const byDate = new Map<string, Expense[]>();
    for (const e of filtered.slice(0, 120)) {
      const list = byDate.get(e.expense_date) ?? [];
      list.push(e);
      byDate.set(e.expense_date, list);
    }
    return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const total = filtered.filter((e) => e.category !== "Investments").reduce((s, e) => s + Number(e.amount), 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="tab-content">
      <div className="tx-toolbar">
        <select className="cat-select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="Category filter">
          <option value="all">All categories</option>
          {[...categories].sort().map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <span className="tx-total">
          {filtered.length} · {formatINR(total)} <span className="muted">({rangeLabel.toLowerCase()})</span>
        </span>
      </div>

      {groups.length === 0 && (
        <div className="card">
          <div className="empty-state">Nothing in this period — text the bot an expense and it shows up here.</div>
        </div>
      )}

      {groups.map(([date, rows]) => (
        <section key={date} className="tx-group">
          <div className="tx-group-label">
            <span>{prettyDate(date, today)}</span>
            <span>{formatINR(rows.filter((e) => e.category !== "Investments").reduce((s, e) => s + Number(e.amount), 0))}</span>
          </div>
          <div className="card tx-card">
            {rows.map((e) => {
              const catColor = seriesColor(colorByCategory[e.category] ?? FALLBACK_COLOR, dark);
              const mIdx = e.user_id !== null ? (memberIndex.get(e.user_id) ?? 0) : 0;
              const mName = e.user_id !== null ? (memberName.get(e.user_id) ?? "—") : "—";
              return (
                <div className="tx-row" key={e.id}>
                  {showMember ? (
                    <span className="tx-avatar" style={{ background: memberColor(mIdx, dark) }}>
                      {mName.slice(0, 1).toUpperCase()}
                    </span>
                  ) : (
                    <span className="tx-avatar cat" style={{ background: catColor }} />
                  )}
                  <span className="tx-main">
                    <span className="tx-merchant">{e.merchant ?? e.category}</span>
                    <span className="tx-sub">
                      {showMember && <>{mName} · </>}
                      {e.category} · {SOURCE_ICON[e.source] ?? "💬"}
                    </span>
                  </span>
                  <span className={`tx-amt${e.category === "Investments" ? " invest" : ""}`}>
                    {e.category === "Investments" ? "↗ " : ""}
                    {formatINR(Number(e.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
