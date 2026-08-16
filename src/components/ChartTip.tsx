"use client";

/** Shared tooltip body — plain HTML, so it styles itself with the CSS tokens. */
export default function ChartTip({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; color?: string }>;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "8px 12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        fontSize: 12.5,
        color: "var(--ink)",
      }}
    >
      <div style={{ color: "var(--ink-2)", marginBottom: 4 }}>{title}</div>
      {rows.map((r) => (
        <div
          key={r.label}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          {r.color && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: r.color,
              }}
            />
          )}
          <span style={{ color: "var(--ink-2)" }}>{r.label}</span>
          <span
            style={{
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              marginLeft: "auto",
              paddingLeft: 12,
            }}
          >
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}
