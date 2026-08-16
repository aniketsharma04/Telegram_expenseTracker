"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Expense } from "@/lib/types";
import { CHROME, FALLBACK_COLOR, formatINR, seriesColor, useIsDark } from "./theme";
import ChartTip from "./ChartTip";

const MAX_BARS = 7; // beyond this, the tail folds into "Other"

interface Props {
  expenses: Expense[]; // already filtered to the selected date range
  selected: string; // category name or "all" — non-selected bars get de-emphasized
  colorByCategory: Record<string, string>;
}

export default function CategoryChart({ expenses, selected, colorByCategory }: Props) {
  const dark = useIsDark();
  const chrome = dark ? CHROME.dark : CHROME.light;

  const data = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of expenses) {
      totals.set(e.category, (totals.get(e.category) ?? 0) + Number(e.amount));
    }
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const head = sorted.slice(0, MAX_BARS);
    const tail = sorted.slice(MAX_BARS);
    const rows = head.map(([name, total]) => ({
      name,
      total,
      color: seriesColor(colorByCategory[name] ?? FALLBACK_COLOR, dark),
    }));
    if (tail.length > 0) {
      rows.push({
        name: "Other",
        total: tail.reduce((s, [, t]) => s + t, 0),
        color: FALLBACK_COLOR,
      });
    }
    return rows;
  }, [expenses, colorByCategory, dark]);

  if (data.length === 0) {
    return <div className="empty-state">Nothing logged in this period yet.</div>;
  }

  const periodTotal = data.reduce((s, d) => s + d.total, 0);
  const height = Math.max(180, data.length * 40 + 20);
  // Emphasis: when one category is selected, it keeps its hue and the rest recede.
  const barColor = (d: (typeof data)[number]) =>
    selected === "all" || d.name === selected ? d.color : chrome.baseline;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={118}
          axisLine={false}
          tickLine={false}
          tick={{ fill: chrome.ink2, fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: chrome.grid, opacity: 0.35 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as (typeof data)[number];
            const share = periodTotal > 0 ? Math.round((d.total / periodTotal) * 100) : 0;
            return (
              <ChartTip
                title={d.name}
                rows={[{ label: `${share}% of period`, value: formatINR(d.total), color: d.color }]}
              />
            );
          }}
        />
        <Bar dataKey="total" barSize={14} radius={[0, 4, 4, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={barColor(d)} />
          ))}
          <LabelList
            dataKey="total"
            position="right"
            formatter={(v) => formatINR(Number(v))}
            style={{ fill: chrome.ink, fontSize: 12, fontVariantNumeric: "tabular-nums" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
