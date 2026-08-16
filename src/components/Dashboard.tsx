"use client";

import { useEffect, useMemo, useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";
import type { Category, Expense } from "@/lib/types";
import StatTiles from "./StatTiles";
import CategoryChart from "./CategoryChart";
import TrendChart from "./TrendChart";
import TopMerchants from "./TopMerchants";
import TransactionsTable from "./TransactionsTable";

const LOOKBACK_DAYS = 180; // covers the 90-day range plus its comparison window

export type RangeKey = "month" | "30d" | "90d";

const RANGE_LABELS: Record<RangeKey, string> = {
  month: "This month",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

function istDate(offsetDays = 0): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - offsetDays * 86400000));
}

export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("month");
  const [catFilter, setCatFilter] = useState<string>("all");

  useEffect(() => {
    const supabase = getBrowserClient();
    let cancelled = false;

    async function load() {
      const since = istDate(LOOKBACK_DAYS);
      const [expRes, catRes] = await Promise.all([
        supabase
          .from("expenses")
          .select("*")
          .gte("expense_date", since)
          .order("logged_at", { ascending: false }),
        supabase.from("categories").select("*"),
      ]);
      if (cancelled) return;
      if (expRes.error || catRes.error) {
        setError((expRes.error ?? catRes.error)!.message);
        return;
      }
      setExpenses((expRes.data ?? []) as Expense[]);
      setCategories((catRes.data ?? []) as Category[]);
    }

    load();

    const channel = supabase
      .channel("expenses-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        (payload) => {
          setExpenses((prev) => {
            if (!prev) return prev;
            if (payload.eventType === "INSERT") {
              const row = payload.new as Expense;
              return prev.some((e) => e.id === row.id) ? prev : [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Expense;
              return prev.map((e) => (e.id === row.id ? row : e));
            }
            if (payload.eventType === "DELETE") {
              const gone = payload.old as { id: string };
              return prev.filter((e) => e.id !== gone.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const colorByCategory = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of categories) map[c.name] = c.color ?? "#898781";
    return map;
  }, [categories]);

  const today = istDate();
  const monthPrefix = today.slice(0, 7);

  const derived = useMemo(() => {
    if (!expenses) return null;

    const rangeStart = range === "month" ? `${monthPrefix}-01` : istDate(range === "30d" ? 29 : 89);
    const inRange = expenses.filter((e) => e.expense_date >= rangeStart && e.expense_date <= today);
    const filtered = catFilter === "all" ? inRange : inRange.filter((e) => e.category === catFilter);

    // Previous window for the comparison sub-line: last calendar month for
    // "This month", otherwise the same-length window immediately before.
    let prev: Expense[];
    let prevLabel: string;
    if (range === "month") {
      const [y, m] = monthPrefix.split("-").map(Number);
      const prevPrefix = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
      prev = expenses.filter((e) => e.expense_date.startsWith(prevPrefix));
      prevLabel = "last month";
    } else {
      const days = range === "30d" ? 30 : 90;
      const prevStart = istDate(days * 2 - 1);
      prev = expenses.filter((e) => e.expense_date >= prevStart && e.expense_date < rangeStart);
      prevLabel = `previous ${days} days`;
    }
    if (catFilter !== "all") prev = prev.filter((e) => e.category === catFilter);

    return { rangeStart, inRange, filtered, prev, prevLabel };
  }, [expenses, range, catFilter, monthPrefix, today]);

  return (
    <main className="container">
      <header className="page-header">
        <h1>Expense Tracker</h1>
        <span className="live-badge">
          <span className="dot" /> live — updates as you text the bot
        </span>
      </header>

      {error && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="empty-state">Couldn&apos;t load data: {error}</div>
        </div>
      )}

      {!error && expenses === null && (
        <div className="card">
          <div className="empty-state">Loading…</div>
        </div>
      )}

      {!error && expenses !== null && expenses.length === 0 && (
        <div className="card">
          <div className="empty-state">
            No expenses yet.
            <br />
            Text your Telegram bot something like <code>300 zomato</code> and it will show up here in seconds.
          </div>
        </div>
      )}

      {!error && expenses !== null && expenses.length > 0 && derived && (
        <>
          <div className="filters">
            <div className="range-buttons" role="group" aria-label="Date range">
              {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
                <button
                  key={key}
                  className={`range-btn${range === key ? " active" : ""}`}
                  onClick={() => setRange(key)}
                >
                  {RANGE_LABELS[key]}
                </button>
              ))}
            </div>
            <select
              className="cat-select"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              aria-label="Category filter"
            >
              <option value="all">All categories</option>
              {categories
                .map((c) => c.name)
                .sort()
                .map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
            </select>
          </div>

          <StatTiles
            filtered={derived.filtered}
            prev={derived.prev}
            prevLabel={derived.prevLabel}
            rangeLabel={RANGE_LABELS[range]}
            today={today}
          />
          <div className="charts">
            <div className="card">
              <h2>{RANGE_LABELS[range]} by category</h2>
              <CategoryChart
                expenses={derived.inRange}
                selected={catFilter}
                colorByCategory={colorByCategory}
              />
            </div>
            <div className="card">
              <h2>Daily spend — {RANGE_LABELS[range].toLowerCase()}</h2>
              <TrendChart expenses={derived.filtered} startDate={derived.rangeStart} today={today} />
            </div>
          </div>
          <div className="charts">
            <div className="card">
              <h2>Top merchants — {RANGE_LABELS[range].toLowerCase()}</h2>
              <TopMerchants expenses={derived.filtered} />
            </div>
            <div className="card">
              <h2>Recent transactions</h2>
              <TransactionsTable expenses={derived.filtered.slice(0, 25)} colorByCategory={colorByCategory} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
