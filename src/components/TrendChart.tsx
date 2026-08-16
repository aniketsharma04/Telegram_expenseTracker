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

const DAYS = 30;

function istDate(offsetDays: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - offsetDays * 86400000));
}

function shortDay(iso: string): string {
  const [, m, d] = iso.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${Number(d)} ${months[Number(m) - 1]}`;
}

export default function TrendChart({ expenses }: { expenses: Expense[] }) {
  const dark = useIsDark();
  const chrome = dark ? CHROME.dark : CHROME.light;

  const data = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of expenses) {
      totals.set(
        e.expense_date,
        (totals.get(e.expense_date) ?? 0) + Number(e.amount),
      );
    }
    // Oldest → newest, gaps filled with zero so quiet days stay visible.
    const days: Array<{ date: string; total: number }> = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const date = istDate(i);
      days.push({ date, total: totals.get(date) ?? 0 });
    }
    return days;
  }, [expenses]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={chrome.grid} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDay}
          interval={4}
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
                rows={[
                  {
                    label: "Spent",
                    value: formatINR(d.total),
                    color: chrome.accent,
                  },
                ]}
              />
            );
          }}
        />
        <Bar
          dataKey="total"
          fill={chrome.accent}
          radius={[3, 3, 0, 0]}
          maxBarSize={14}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
