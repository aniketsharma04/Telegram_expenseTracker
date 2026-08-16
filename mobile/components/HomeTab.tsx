import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Expense } from "../lib/api";
import { FALLBACK_COLOR, formatINR, Palette, seriesColor } from "../lib/theme";
import { Card, SectionTitle, TrackBar } from "./ui";

export type RangeKey = "month" | "30d" | "90d";
export const RANGE_LABELS: Record<RangeKey, string> = {
  month: "This month",
  "30d": "30 days",
  "90d": "90 days",
};

interface Props {
  p: Palette;
  dark: boolean;
  inRange: Expense[];
  prev: Expense[];
  prevLabel: string;
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  today: string;
  colorByCategory: Record<string, string>;
  scopeLabel: string;
}

function spentOf(list: Expense[]): number {
  return list.filter((e) => e.category !== "Investments").reduce((s, e) => s + Number(e.amount), 0);
}

export default function HomeTab(props: Props) {
  const { p, dark, inRange, prev, prevLabel, range, setRange, today, colorByCategory, scopeLabel } = props;

  const spent = spentOf(inRange);
  const invested = inRange
    .filter((e) => e.category === "Investments")
    .reduce((s, e) => s + Number(e.amount), 0);
  const todaySpent = spentOf(inRange.filter((e) => e.expense_date === today));
  const prevSpent = spentOf(prev);
  const pct = prevSpent > 0 ? Math.round(((spent - prevSpent) / prevSpent) * 100) : null;

  const categories = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of inRange) totals.set(e.category, (totals.get(e.category) ?? 0) + Number(e.amount));
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const head = sorted.slice(0, 7);
    const tail = sorted.slice(7);
    const rows = head.map(([name, total]) => ({ name, total, color: seriesColor(colorByCategory[name], dark) }));
    if (tail.length) rows.push({ name: "Other", total: tail.reduce((s, [, t]) => s + t, 0), color: FALLBACK_COLOR });
    return rows;
  }, [inRange, colorByCategory, dark]);
  const maxCat = Math.max(1, ...categories.map((c) => c.total));

  const merchants = useMemo(() => {
    const totals = new Map<string, { total: number; count: number }>();
    for (const e of inRange) {
      const key = e.merchant?.trim();
      if (!key) continue;
      const entry = totals.get(key) ?? { total: 0, count: 0 };
      entry.total += Number(e.amount);
      entry.count += 1;
      totals.set(key, entry);
    }
    return [...totals.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [inRange]);
  const maxMerchant = Math.max(1, ...merchants.map((m) => m.total));

  return (
    <View style={styles.col}>
      <View style={[styles.rangeRow, { backgroundColor: p.surface, borderColor: p.border }]}>
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
          <Pressable
            key={key}
            style={[styles.rangeBtn, range === key && { backgroundColor: p.page }]}
            onPress={() => setRange(key)}
          >
            <Text style={{ fontSize: 13, color: range === key ? p.ink : p.ink2, fontWeight: range === key ? "600" : "400" }}>
              {RANGE_LABELS[key]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Card p={p}>
        <Text style={{ fontSize: 13, color: p.ink2 }}>
          {scopeLabel} · spent {RANGE_LABELS[range].toLowerCase()}
        </Text>
        <Text style={[styles.hero, { color: p.ink }]}>{formatINR(spent)}</Text>
        <View style={styles.heroSub}>
          {pct !== null && (
            <Text style={{ fontSize: 13, fontWeight: "600", color: pct <= 0 ? p.good : p.ink2 }}>
              {pct <= 0 ? "▼" : "▲"} {Math.abs(pct)}% vs {prevLabel}
            </Text>
          )}
          <Text style={{ fontSize: 13, color: p.ink2 }}>Today: {formatINR(todaySpent)}</Text>
          <Text style={{ fontSize: 13, color: p.ink2 }}>Invested: {formatINR(invested)}</Text>
          <Text style={{ fontSize: 13, color: p.ink2 }}>{inRange.length} transactions</Text>
        </View>
      </Card>

      <Card p={p}>
        <SectionTitle p={p}>By category</SectionTitle>
        {categories.length === 0 && <Text style={{ color: p.ink2, fontSize: 14 }}>Nothing in this period yet.</Text>}
        <View style={{ gap: 12 }}>
          {categories.map((c) => (
            <View key={c.name} style={styles.barRow}>
              <View style={[styles.dot, { backgroundColor: c.color }]} />
              <Text style={[styles.barName, { color: p.ink }]} numberOfLines={1}>
                {c.name}
              </Text>
              <TrackBar p={p} fraction={c.total / maxCat} color={c.color} />
              <Text style={[styles.barAmt, { color: p.ink }]}>{formatINR(c.total)}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card p={p}>
        <SectionTitle p={p}>Top merchants</SectionTitle>
        {merchants.length === 0 && <Text style={{ color: p.ink2, fontSize: 14 }}>No merchants yet.</Text>}
        <View style={{ gap: 12 }}>
          {merchants.map((m) => (
            <View key={m.name}>
              <View style={styles.merchantMeta}>
                <Text style={{ fontSize: 13, fontWeight: "500", color: p.ink }} numberOfLines={1}>
                  {m.name}
                </Text>
                <Text style={{ fontSize: 13, color: p.ink }}>
                  {formatINR(m.total)} <Text style={{ color: p.muted, fontSize: 12 }}>· {m.count}×</Text>
                </Text>
              </View>
              <TrackBar p={p} fraction={m.total / maxMerchant} color={p.accent} />
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  col: { gap: 14 },
  rangeRow: { flexDirection: "row", alignSelf: "flex-start", borderRadius: 10, borderWidth: 1, padding: 3, gap: 4 },
  rangeBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  hero: { fontSize: 36, fontWeight: "800", letterSpacing: -0.5, marginTop: 4 },
  heroSub: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6, marginTop: 10 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 3 },
  barName: { width: 104, fontSize: 13 },
  barAmt: { minWidth: 64, textAlign: "right", fontSize: 13, fontWeight: "600" },
  merchantMeta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5, gap: 12 },
});
