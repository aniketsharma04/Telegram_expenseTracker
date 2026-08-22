import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Expense } from "../lib/api";
import { FALLBACK_COLOR, formatINR, memberColor, Palette, seriesColor } from "../lib/theme";
import { Avatar, Card } from "./ui";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SOURCE_ICON: Record<string, string> = {
  telegram_text: "💬",
  telegram_voice: "🎤",
  telegram_photo: "📷",
  app_form: "📱",
  app_text: "📱",
  app_voice: "🎤",
  app_photo: "📷",
};

interface Props {
  p: Palette;
  dark: boolean;
  expenses: Expense[];
  colorByCategory: Record<string, string>;
  showMember: boolean;
  memberName: Map<number, string>;
  memberIndex: Map<number, number>;
  today: string;
  /** Tap a row to edit — only fires for the signed-in user's own entries. */
  onEdit: (e: Expense) => void;
}

function prettyDate(iso: string, today: string): string {
  if (iso === today) return "Today";
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

export default function TransactionsTab({
  p,
  dark,
  expenses,
  colorByCategory,
  showMember,
  memberName,
  memberIndex,
  today,
  onEdit,
}: Props) {
  const [catFilter, setCatFilter] = useState("all");

  const presentCategories = useMemo(
    () => [...new Set(expenses.map((e) => e.category))].sort(),
    [expenses]
  );
  const filtered = useMemo(
    () => (catFilter === "all" ? expenses : expenses.filter((e) => e.category === catFilter)),
    [expenses, catFilter]
  );

  const groups = useMemo(() => {
    const byDate = new Map<string, Expense[]>();
    for (const e of filtered.slice(0, 100)) {
      const list = byDate.get(e.expense_date) ?? [];
      list.push(e);
      byDate.set(e.expense_date, list);
    }
    return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {["all", ...presentCategories].map((name) => {
          const active = catFilter === name;
          return (
            <Pressable
              key={name}
              onPress={() => setCatFilter(name)}
              style={[
                styles.chip,
                { borderColor: active ? p.accent : p.border, backgroundColor: active ? p.accentSoft : p.surface },
              ]}
            >
              <Text style={{ fontSize: 13, color: active ? p.ink : p.ink2, fontWeight: active ? "600" : "400" }}>
                {name === "all" ? "All" : name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {groups.length === 0 && (
        <Card p={p}>
          <Text style={{ color: p.ink2, fontSize: 14, textAlign: "center", padding: 12 }}>
            Nothing here yet — text the bot an expense.
          </Text>
        </Card>
      )}

      {groups.map(([date, rows]) => (
        <View key={date} style={{ gap: 6 }}>
          <View style={styles.groupLabel}>
            <Text style={[styles.groupText, { color: p.muted }]}>{prettyDate(date, today).toUpperCase()}</Text>
            <Text style={[styles.groupText, { color: p.muted }]}>
              {formatINR(rows.filter((e) => e.category !== "Investments").reduce((s, e) => s + Number(e.amount), 0))}
            </Text>
          </View>
          <Card p={p} style={{ paddingVertical: 4, paddingHorizontal: 14 }}>
            {rows.map((e, i) => {
              const catColor = seriesColor(colorByCategory[e.category] ?? FALLBACK_COLOR, dark);
              const mIdx = e.user_id !== null ? (memberIndex.get(e.user_id) ?? 0) : 0;
              const mName = e.user_id !== null ? (memberName.get(e.user_id) ?? "—") : "—";
              return (
                <Pressable
                  key={e.id}
                  onPress={() => onEdit(e)}
                  style={[styles.row, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: p.grid }]}
                >
                  {showMember ? (
                    <Avatar color={memberColor(mIdx, dark)} label={mName.slice(0, 1).toUpperCase()} />
                  ) : (
                    <View style={[styles.catDot, { backgroundColor: catColor }]} />
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: "500", color: p.ink }} numberOfLines={1}>
                      {e.merchant ?? e.category}
                    </Text>
                    <Text style={{ fontSize: 12, color: p.muted, marginTop: 1 }}>
                      {showMember ? `${mName} · ` : ""}
                      {e.category} · {SOURCE_ICON[e.source] ?? "💬"}
                      {e.split_id ? " · 🤝" : ""}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 14.5,
                      fontWeight: "700",
                      color: e.category === "Investments" ? p.good : p.ink,
                    }}
                  >
                    {e.category === "Investments" ? "↗ " : ""}
                    {formatINR(Number(e.amount))}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  groupLabel: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6 },
  groupText: { fontSize: 11.5, fontWeight: "600", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  catDot: { width: 12, height: 12, borderRadius: 4, marginHorizontal: 11 },
});
