"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiData, Expense } from "@/lib/types";
import LoginScreen from "./LoginScreen";
import HomeTab from "./HomeTab";
import TransactionsTab from "./TransactionsTab";
import FamilyTab from "./FamilyTab";

export type Tab = "home" | "transactions" | "family";
export type Scope = "personal" | "family";
export type RangeKey = "month" | "30d" | "90d";

export const RANGE_LABELS: Record<RangeKey, string> = {
  month: "This month",
  "30d": "30 days",
  "90d": "90 days",
};

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function rangeStartOf(range: RangeKey, today: string): string {
  if (range === "month") return `${today.slice(0, 7)}-01`;
  return shiftDate(today, range === "30d" ? 29 : 89);
}

const TAB_META: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
  {
    key: "home",
    label: "Home",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    ),
  },
  {
    key: "transactions",
    label: "Transactions",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    key: "family",
    label: "Family",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M2.8 19c.8-3 3.2-4.6 6.2-4.6s5.4 1.6 6.2 4.6" />
        <circle cx="17" cy="9" r="2.4" />
        <path d="M15.6 14.7c2.6.2 4.6 1.6 5.4 4.3" />
      </svg>
    ),
  },
];

export default function App() {
  const [data, setData] = useState<ApiData | null>(null);
  const [auth, setAuth] = useState<"loading" | "unauth" | "ok">("loading");
  const [tab, setTab] = useState<Tab>("home");
  const [scope, setScope] = useState<Scope>("personal");
  const [member, setMember] = useState<number | "all">("all");
  const [range, setRange] = useState<RangeKey>("month");

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/data", { cache: "no-store" });
      if (r.status === 401) {
        setAuth("unauth");
        return;
      }
      if (!r.ok) return;
      setData((await r.json()) as ApiData);
      setAuth("ok");
    } catch {
      // transient network failure — keep showing last data
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 20000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const derived = useMemo(() => {
    if (!data) return null;
    const members = data.family?.members ?? [];
    const memberName = new Map<number, string>(members.map((m) => [m.id, m.name]));
    const memberIndex = new Map<number, number>(members.map((m, i) => [m.id, i]));
    if (!memberName.has(data.user.id)) {
      memberName.set(data.user.id, data.user.name);
      memberIndex.set(data.user.id, 0);
    }

    const activeIds =
      scope === "family" && data.family
        ? member === "all"
          ? members.map((m) => m.id)
          : [member]
        : [data.user.id];
    const idSet = new Set(activeIds);
    const scoped = data.expenses.filter((e) => e.user_id !== null && idSet.has(e.user_id));

    const rangeStart = rangeStartOf(range, data.today);
    const inRange = scoped.filter(
      (e) => e.expense_date >= rangeStart && e.expense_date <= data.today
    );

    let prev: Expense[];
    let prevLabel: string;
    if (range === "month") {
      const [y, m] = data.today.slice(0, 7).split("-").map(Number);
      const prevPrefix = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
      prev = scoped.filter((e) => e.expense_date.startsWith(prevPrefix));
      prevLabel = "last month";
    } else {
      const days = range === "30d" ? 30 : 90;
      const prevStart = shiftDate(data.today, days * 2 - 1);
      prev = scoped.filter((e) => e.expense_date >= prevStart && e.expense_date < rangeStart);
      prevLabel = `previous ${days} days`;
    }

    const colorByCategory: Record<string, string> = {};
    for (const c of data.categories) colorByCategory[c.name] = c.color ?? "#898781";

    return { members, memberName, memberIndex, scoped, inRange, prev, prevLabel, rangeStart, colorByCategory };
  }, [data, scope, member, range]);

  if (auth === "unauth") return <LoginScreen />;
  if (auth === "loading" || !data || !derived) {
    return (
      <div className="login-wrap">
        <div className="splash">
          <div className="brand-mark large">₹</div>
          <div className="splash-text">Loading…</div>
        </div>
      </div>
    );
  }

  const hasFamily = Boolean(data.family);
  const showMemberChips = hasFamily && scope === "family";
  const familyScoped = scope === "family" && member === "all";

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">₹</div>
          <span>Expense Tracker</span>
        </div>
        <nav className="top-tabs">
          {TAB_META.map((t) => (
            <button key={t.key} className={`top-tab${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
        <a className="icon-btn" href="/api/auth/logout" title={`Signed in as ${data.user.name} — log out`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 4h4v16h-4" />
            <path d="M10 8l-4 4 4 4M6 12h9" />
          </svg>
        </a>
      </header>

      {hasFamily && (
        <div className="scope-row">
          <div className="seg">
            <button
              className={`seg-btn${scope === "personal" ? " active" : ""}`}
              onClick={() => {
                setScope("personal");
                setMember("all");
              }}
            >
              Personal
            </button>
            <button className={`seg-btn${scope === "family" ? " active" : ""}`} onClick={() => setScope("family")}>
              Family
            </button>
          </div>
        </div>
      )}

      {showMemberChips && (
        <div className="chips-row">
          <button className={`chip${member === "all" ? " active" : ""}`} onClick={() => setMember("all")}>
            <span className="chip-avatar all">👨‍👩‍👧</span>
            {data.family!.name}
          </button>
          {derived.members.map((m, i) => (
            <button key={m.id} className={`chip${member === m.id ? " active" : ""}`} onClick={() => setMember(m.id)}>
              <span className={`chip-avatar m${i % 8}`}>{m.name.slice(0, 1).toUpperCase()}</span>
              {m.id === data.user.id ? "You" : m.name}
            </button>
          ))}
        </div>
      )}

      {tab === "home" && (
        <HomeTab
          inRange={derived.inRange}
          prev={derived.prev}
          prevLabel={derived.prevLabel}
          range={range}
          setRange={setRange}
          today={data.today}
          rangeStart={derived.rangeStart}
          colorByCategory={derived.colorByCategory}
          scopeLabel={
            scope === "family"
              ? member === "all"
                ? data.family!.name
                : derived.memberName.get(member as number) ?? ""
              : "Personal"
          }
        />
      )}
      {tab === "transactions" && (
        <TransactionsTab
          expenses={derived.inRange}
          categories={data.categories.map((c) => c.name)}
          colorByCategory={derived.colorByCategory}
          showMember={familyScoped}
          memberName={derived.memberName}
          memberIndex={derived.memberIndex}
          rangeLabel={RANGE_LABELS[range]}
        />
      )}
      {tab === "family" && <FamilyTab data={data} onChanged={refresh} />}

      <nav className="tabbar">
        {TAB_META.map((t) => (
          <button key={t.key} className={`tab-item${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
