"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Expense } from "@/lib/types";
import { CHROME, formatINR, useIsDark } from "./theme";
import ChartTip from "./ChartTip";

function shortDay(iso: string): string {
  const [, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(d)} ${months[Number(m) - 1]}`;
}

interface Props {
  expenses: Expense[]; // already filtered to range + category
  startDate: string; // YYYY-MM-DD
  today: string; // YYYY-MM-DD
}

export default function TrendChart({ expenses, startDate, today }: Props) {
  const dark = useIsDark();
  const chrome = dark ? CHROME.dark : CHROME.light;

  const data = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of expenses) {
      totals.set(e.expense_date, (totals.get(e.expense_date) ?? 0) + Number(e.amount));
    }
    // Oldest → newest, gaps filled with zero so quiet days stay visible.
    const days: Array<{ date: string; total: number }> = [];
    const cursor = new Date(`${startDate}T00:00:00Z`);
    for (let i = 0; i < 400; i++) {
      const iso = cursor.toISOString().slice(0, 10);
      if (iso > today) break;
      days.push({ date: iso, total: totals.get(iso) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
  }, [expenses, startDate, today]);

  const tickInterval = Math.max(0, Math.floor(data.length / 7));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={chrome.grid} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDay}
          interval={tickInterval}
          axisLine={{ stroke: chrome.baseline }}
          tickLine={false}
          tick={{ fill: chrome.muted, fontSize: 11 }}
        />
        <YAxis
          width={44}
          axisLine={false}
          tickLine={false}
          tick={{ fill: chrome.muted, fontSize: 11 }}
          tickFormatter={(v: number) => (v >= 1000 ? `₹${v / 1000}k` : `₹${v}`)}
        />
        <Tooltip
          cursor={{ fill: chrome.grid, opacity: 0.35 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as (typeof data)[number];
            return (
              <ChartTip
                title={shortDay(d.date)}
                rows={[{ label: "Spent", value: formatINR(d.total), color: chrome.accent }]}
              />
            );
          }}
        />
        <Bar dataKey="total" fill={chrome.accent} radius={[3, 3, 0, 0]} maxBarSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}
