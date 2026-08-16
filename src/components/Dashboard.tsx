"use client";

import { useEffect, useMemo, useState } from "react";
import { getBrowserClient } from "@/lib/supabase-browser";
import type { Category, Expense } from "@/lib/types";
import StatTiles from "./StatTiles";
import CategoryChart from "./CategoryChart";
import TrendChart from "./TrendChart";
import TransactionsTable from "./TransactionsTable";

const LOOKBACK_DAYS = 90;

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

    // New rows pushed by Supabase realtime appear without a refresh.
    const channel = supabase
      .channel("expenses-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "expenses" },
        (payload) => {
          setExpenses((prev) => {
            const row = payload.new as Expense;
            if (!prev) return [row];
            if (prev.some((e) => e.id === row.id)) return prev;
            return [row, ...prev];
          });
        },
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
  const monthPrefix = today.slice(0, 7); // YYYY-MM

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
            Text your Telegram bot something like <code>300 zomato</code> and it
            will show up here in seconds.
          </div>
        </div>
      )}

      {!error && expenses !== null && expenses.length > 0 && (
        <>
          <StatTiles
            expenses={expenses}
            today={today}
            monthPrefix={monthPrefix}
          />
          <div className="charts">
            <div className="card">
              <h2>This month by category</h2>
              <CategoryChart
                expenses={expenses}
                monthPrefix={monthPrefix}
                colorByCategory={colorByCategory}
              />
            </div>
            <div className="card">
              <h2>Daily spend — last 30 days</h2>
              <TrendChart expenses={expenses} />
            </div>
          </div>
          <div className="card">
            <h2>Recent transactions</h2>
            <TransactionsTable
              expenses={expenses.slice(0, 25)}
              colorByCategory={colorByCategory}
            />
          </div>
        </>
      )}
    </main>
  );
}
