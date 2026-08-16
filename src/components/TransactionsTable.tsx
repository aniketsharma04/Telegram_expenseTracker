"use client";

import type { Expense } from "@/lib/types";
import { FALLBACK_COLOR, formatINR, seriesColor, useIsDark } from "./theme";

interface Props {
  expenses: Expense[];
  colorByCategory: Record<string, string>;
}

function shortDate(iso: string): string {
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

export default function TransactionsTable({
  expenses,
  colorByCategory,
}: Props) {
  const dark = useIsDark();

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="tx-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Merchant</th>
            <th>Category</th>
            <th className="hide-mobile">Source</th>
            <th style={{ textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td className="date">{shortDate(e.expense_date)}</td>
              <td>{e.merchant ?? "—"}</td>
              <td>
                <span className="cat-cell">
                  <span
                    className="cat-dot"
                    style={{
                      background: seriesColor(
                        colorByCategory[e.category] ?? FALLBACK_COLOR,
                        dark,
                      ),
                    }}
                  />
                  {e.category}
                </span>
              </td>
              <td
                className="hide-mobile"
                style={{ color: "var(--muted)", fontSize: 12 }}
              >
                {e.source.replace("telegram_", "")}
              </td>
              <td className="amount">{formatINR(Number(e.amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
