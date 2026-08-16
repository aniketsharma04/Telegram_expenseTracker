"use client";

import { useMemo, useState } from "react";
import type { ApiData } from "@/lib/types";
import { formatINR, memberColor, useIsDark } from "./theme";

const BOT_URL = "https://t.me/Aniket_financial_expense_bot";

export default function FamilyTab({ data, onChanged }: { data: ApiData; onChanged: () => void }) {
  const dark = useIsDark();
  const [copied, setCopied] = useState(false);

  const monthPrefix = data.today.slice(0, 7);
  const totals = useMemo(() => {
    const byMember = new Map<number, number>();
    let familySpent = 0;
    let familyInvested = 0;
    for (const e of data.expenses) {
      if (!e.expense_date.startsWith(monthPrefix) || e.user_id === null) continue;
      if (e.category === "Investments") {
        familyInvested += Number(e.amount);
      } else {
        familySpent += Number(e.amount);
        byMember.set(e.user_id, (byMember.get(e.user_id) ?? 0) + Number(e.amount));
      }
    }
    return { byMember, familySpent, familyInvested };
  }, [data.expenses, monthPrefix]);

  if (!data.family) {
    return (
      <div className="tab-content">
        <section className="card">
          <h2>Start a family</h2>
          <p className="prose">
            Track everyone&apos;s spending together — each member logs their own expenses with the
            bot, and the family view rolls it all up while keeping individual trackers intact.
          </p>
          <ol className="login-steps">
            <li>
              Open the bot and send <code>/family create Sharma Family</code>
            </li>
            <li>Forward the invite link it gives you to your family group</li>
            <li>One tap and they&apos;re in — their expenses appear here</li>
          </ol>
          <a className="btn-primary" href={BOT_URL} target="_blank" rel="noreferrer">
            Open the Telegram bot
          </a>
        </section>
      </div>
    );
  }

  const inviteUrl = `https://t.me/Aniket_financial_expense_bot?start=fam_${data.family.invite_code}`;
  const maxMember = Math.max(1, ...data.family.members.map((m) => totals.byMember.get(m.id) ?? 0));

  return (
    <div className="tab-content">
      <section className="card hero-card">
        <div className="hero-label">👨‍👩‍👧 {data.family.name} · this month</div>
        <div className="hero-amount">{formatINR(totals.familySpent)}</div>
        <div className="hero-sub">
          <span>Invested: {formatINR(totals.familyInvested)}</span>
          <span>{data.family.members.length} members</span>
        </div>
      </section>

      <section className="card">
        <h2>Members</h2>
        <div className="member-list">
          {data.family.members.map((m, i) => {
            const spent = totals.byMember.get(m.id) ?? 0;
            return (
              <div className="member-row" key={m.id}>
                <span className="tx-avatar" style={{ background: memberColor(i, dark) }}>
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="member-meta">
                  <span className="member-name">
                    {m.id === data.user.id ? `${m.name} (you)` : m.name}
                    {i === 0 && <span className="role-badge">owner</span>}
                  </span>
                  <span className="member-track">
                    <span
                      className="member-bar"
                      style={{ width: `${Math.max(3, (spent / maxMember) * 100)}%`, background: memberColor(i, dark) }}
                    />
                  </span>
                </span>
                <span className="member-amt">{formatINR(spent)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Add a member</h2>
        <p className="prose">
          Anyone who opens this link joins <b>{data.family.name}</b> and starts logging with the
          bot right away.
        </p>
        <div className="invite-row">
          <code className="invite-code">{inviteUrl}</code>
          <button
            className="btn-primary small"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // clipboard unavailable — the link is selectable
              }
            }}
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
        <button className="btn-ghost" onClick={onChanged}>
          ↻ Refresh members
        </button>
      </section>
    </div>
  );
}
