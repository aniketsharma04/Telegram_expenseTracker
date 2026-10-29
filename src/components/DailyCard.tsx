"use client";

import type { DailyStatus } from "@/lib/daily-budget";
import { formatINR } from "./theme";

/**
 * Today's spendable number (v14). Read-only on the web — the plan is edited
 * in the app or with /plan and /fixed in the bot.
 */
export default function DailyCard({
  daily,
}: {
  daily: DailyStatus | null | undefined;
}) {
  if (!daily?.ready) {
    return (
      <section className="card daily-card">
        <h2>Daily budget</h2>
        <p className="daily-hint">
          Turn your monthly income into one number to spend each day. Set it up
          in the app, or text the bot <code>/plan 100000</code> and{" "}
          <code>/fixed rent 25000</code>.
        </p>
      </section>
    );
  }

  const over = daily.todayLeft < 0;
  const fraction =
    daily.todayBudget > 0
      ? Math.min(1, daily.todaySpent / daily.todayBudget)
      : 1;
  const tone = over ? "over" : fraction >= 0.8 ? "near" : "ok";
  const everyday = daily.today.filter((e) => e.dailyAmount > 0);
  const aside = daily.today.filter((e) => e.dailyAmount === 0);
  const history = daily.history.slice(-14);
  const max = Math.max(1, ...history.map((h) => Math.max(h.budget, h.spent)));

  return (
    <section className="card daily-card">
      <h2>Daily budget</h2>
      <div className="daily-grid">
        <div>
          <div className={`daily-amount ${over ? "over" : ""}`}>
            {formatINR(Math.abs(daily.todayLeft))}
          </div>
          <div className="daily-sub">
            {over ? "over today's budget" : "left to spend today"} ·{" "}
            {formatINR(daily.todaySpent)} of {formatINR(daily.todayBudget)}
          </div>
          <div className="daily-track">
            <div
              className={`daily-fill ${tone}`}
              style={{ width: `${Math.max(2, fraction * 100)}%` }}
            />
          </div>

          {everyday.length > 0 && (
            <ul className="daily-list">
              {everyday.map((e, i) => (
                <li key={e.id ?? i}>
                  <span>{e.merchant?.trim() || e.category}</span>
                  <span>−{formatINR(e.dailyAmount)}</span>
                </li>
              ))}
            </ul>
          )}
          {aside.length > 0 && (
            <p className="daily-aside">
              Not counted:{" "}
              {aside
                .map(
                  (e) =>
                    `${e.merchant?.trim() || e.category} ${formatINR(Number(e.amount))}`,
                )
                .join(", ")}
            </p>
          )}
        </div>

        <div>
          <div
            className="daily-chart"
            role="img"
            aria-label="Spend per day against that day's budget, last 14 days"
          >
            {history.map((h) => (
              <div
                key={h.date}
                className="daily-col"
                title={`${h.date}: ${formatINR(h.spent)} of ${formatINR(h.budget)}`}
              >
                <div
                  className={`daily-bar ${h.spent > h.budget ? "over" : ""}`}
                  style={{ height: `${Math.max(2, (h.spent / max) * 100)}%` }}
                />
                <div
                  className="daily-tick"
                  style={{ bottom: `${(h.budget / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="daily-stats">
            <div>
              <span>Everyday money left</span>
              <b>{formatINR(daily.poolLeft)}</b>
              <small>{daily.daysLeft} days to go</small>
            </div>
            {daily.tomorrowBudget !== null && (
              <div>
                <span>Tomorrow</span>
                <b>{formatINR(daily.tomorrowBudget)}</b>
              </div>
            )}
            <div>
              <span>Plan</span>
              <b>{formatINR(daily.pool)}</b>
              <small>
                {formatINR(daily.income)} − {formatINR(daily.fixed)} fixed −{" "}
                {formatINR(daily.savingsGoal)} saved
                {daily.goals ? ` − ${formatINR(daily.goals)} goals` : ""}
              </small>
            </div>
            {daily.streak >= 2 && (
              <div>
                <span>Streak</span>
                <b>🔥 {daily.streak} days</b>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
