"use client";

import type { Expense } from "@/lib/types";
import { formatINR } from "./theme";
import { RANGE_LABELS, RangeKey } from "./App";
import CategoryChart from "./CategoryChart";
import TrendChart from "./TrendChart";
import TopMerchants from "./TopMerchants";

interface Props {
  inRange: Expense[];
  prev: Expense[];
  prevLabel: string;
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  today: string;
  rangeStart: string;
  colorByCategory: Record<string, string>;
  scopeLabel: string;
}

function spentOf(list: Expense[]): number {
  return list.filter((e) => e.category !== "Investments").reduce((s, e) => s + Number(e.amount), 0);
}

export default function HomeTab({
  inRange,
  prev,
  prevLabel,
  range,
  setRange,
  today,
  rangeStart,
  colorByCategory,
  scopeLabel,
}: Props) {
  const spent = spentOf(inRange);
  const invested = inRange
    .filter((e) => e.category === "Investments")
    .reduce((s, e) => s + Number(e.amount), 0);
  const todaySpent = spentOf(inRange.filter((e) => e.expense_date === today));
  const prevSpent = spentOf(prev);

  let delta: { text: string; cls: string } | null = null;
  if (prevSpent > 0) {
    const pct = Math.round(((spent - prevSpent) / prevSpent) * 100);
    delta =
      pct <= 0
        ? { text: `▼ ${Math.abs(pct)}% vs ${prevLabel}`, cls: "delta-good" }
        : { text: `▲ ${pct}% vs ${prevLabel}`, cls: "delta-plain" };
  }

  return (
    <div className="tab-content">
      <div className="range-row">
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
          <button key={key} className={`range-btn${range === key ? " active" : ""}`} onClick={() => setRange(key)}>
            {RANGE_LABELS[key]}
          </button>
        ))}
      </div>

      <section className="card hero-card">
        <div className="hero-label">
          {scopeLabel} · spent {RANGE_LABELS[range].toLowerCase()}
        </div>
        <div className="hero-amount">{formatINR(spent)}</div>
        <div className="hero-sub">
          {delta && <span className={delta.cls}>{delta.text}</span>}
          <span>Today: {formatINR(todaySpent)}</span>
          <span>Invested: {formatINR(invested)}</span>
          <span>{inRange.length} transactions</span>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>By category</h2>
          <CategoryChart expenses={inRange} selected="all" colorByCategory={colorByCategory} />
        </section>
        <section className="card">
          <h2>Daily spend</h2>
          <TrendChart expenses={inRange} startDate={rangeStart} today={today} />
        </section>
      </div>

      <section className="card">
        <h2>Top merchants</h2>
        <TopMerchants expenses={inRange} />
      </section>
    </div>
  );
}
