import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ApiData, DailyStatus, Expense } from "../lib/api";
import { categoryIcon, clockTime, tint } from "../lib/categories";
import { useSettings } from "../lib/i18n";
import { formatINR, Palette } from "../lib/theme";
import { PlanSheet } from "./DailyBudgetCard";
import { Card, CardHeader, IconBubble, Ring } from "./ui";

/**
 * Today (v18, "Calm"): the one number, what has eaten into it, and what
 * didn't count. Everything else lives on the other tabs.
 */
export default function TodayTab({
  p,
  dark,
  data,
  token,
  colorByCategory,
  onChanged,
  onSeeAll,
  onEdit,
  top,
  bottom,
}: {
  p: Palette;
  dark: boolean;
  data: ApiData;
  token: string;
  colorByCategory: Record<string, string>;
  onChanged: () => void;
  onSeeAll: () => void;
  onEdit: (e: Expense) => void;
  /** Setup and permission cards, shown above the number until they're done. */
  top?: React.ReactNode;
  /** Goals and anything else below the day. */
  bottom?: React.ReactNode;
}) {
  const daily = data.daily;
  const ready = !!daily?.ready && !!daily.plan;

  return (
    <View style={{ gap: 14 }}>
      {top}
      {ready && daily ? (
        <>
          <Hero p={p} d={daily} />
          <TodayList
            p={p}
            dark={dark}
            d={daily}
            expenses={data.expenses}
            colorByCategory={colorByCategory}
            onSeeAll={onSeeAll}
            onEdit={onEdit}
          />
        </>
      ) : (
        <SetUp p={p} token={token} onChanged={onChanged} />
      )}
      {bottom}
    </View>
  );
}

function Hero({ p, d }: { p: Palette; d: DailyStatus }) {
  const { t, fs } = useSettings();
  const over = d.todayLeft < 0;
  const left = d.todayBudget > 0 ? Math.max(0, d.todayLeft) / d.todayBudget : 0;

  return (
    <Card p={p} style={{ alignItems: "center", gap: 14, paddingVertical: 24 }}>
      <Ring size={176} stroke={13} fraction={left} color={p.accent} track={p.grid}>
        <Text
          style={{ fontSize: fs(34), fontWeight: "700", letterSpacing: -0.8, color: over ? p.warn : p.ink }}
          accessibilityLabel={`${formatINR(Math.abs(d.todayLeft))} ${over ? t("overToday") : t("leftToday")}`}
        >
          {formatINR(Math.abs(d.todayLeft))}
        </Text>
        <Text style={{ fontSize: fs(13), color: over ? p.warn : p.ink2 }}>
          {over ? t("overToday") : t("leftTodayShort")}
        </Text>
      </Ring>
      <Text style={{ fontSize: fs(14), color: p.ink2 }}>
        {formatINR(d.todaySpent)} {t("spentOf")} {formatINR(d.todayBudget)}
      </Text>
      <View style={styles.tiles}>
        <Tile
          p={p}
          label={t("tomorrow")}
          value={d.tomorrowBudget !== null ? formatINR(d.tomorrowBudget) : t("newMonth")}
        />
        <Tile p={p} label={t("leftThisMonth")} value={formatINR(d.poolLeft)} sub={`${d.daysLeft} ${t("daysWord")}`} />
      </View>
      {d.streak >= 2 && (
        <Text style={{ fontSize: fs(13), color: p.accent, fontWeight: "600" }}>
          {d.streak} {t("streakDays")}
        </Text>
      )}
    </Card>
  );
}

function Tile({ p, label, value, sub }: { p: Palette; label: string; value: string; sub?: string }) {
  const { fs } = useSettings();
  return (
    <View style={[styles.tile, { backgroundColor: p.page }]}>
      <Text style={{ fontSize: fs(12), color: p.muted }}>{label}</Text>
      <Text style={{ fontSize: fs(17), fontWeight: "600", color: p.ink }}>
        {value}
        {sub ? <Text style={{ fontSize: fs(12), fontWeight: "500", color: p.muted }}> · {sub}</Text> : null}
      </Text>
    </View>
  );
}

function TodayList({
  p,
  dark,
  d,
  expenses,
  colorByCategory,
  onSeeAll,
  onEdit,
}: {
  p: Palette;
  dark: boolean;
  d: DailyStatus;
  expenses: Expense[];
  colorByCategory: Record<string, string>;
  onSeeAll: () => void;
  onEdit: (e: Expense) => void;
}) {
  const { t, fs } = useSettings();
  const byId = new Map(expenses.map((e) => [e.id, e]));
  const everyday = d.today.filter((e) => e.dailyAmount > 0);
  const aside = d.today.filter((e) => e.dailyAmount === 0);

  return (
    <Card p={p}>
      <CardHeader p={p} title={t("today")} action={t("seeAll")} onAction={onSeeAll} />
      {everyday.length === 0 ? (
        <Text style={{ fontSize: fs(14), color: p.ink2 }}>{t("nothingToday")}</Text>
      ) : (
        <View style={{ gap: 14 }}>
          {everyday.map((s, i) => {
            const full = s.id ? byId.get(s.id) : undefined;
            const color = colorByCategory[s.category] ?? p.muted;
            const time = clockTime(full?.logged_at);
            return (
              <Pressable
                key={s.id ?? i}
                style={styles.row}
                onPress={() => full && onEdit(full)}
                accessibilityRole="button"
                accessibilityLabel={`${s.merchant?.trim() || s.category}, ${formatINR(s.dailyAmount)}`}
              >
                <IconBubble name={categoryIcon(s.category)} color={color} bg={tint(color, dark)} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: fs(15), fontWeight: "500", color: p.ink }} numberOfLines={1}>
                    {s.merchant?.trim() || s.category}
                  </Text>
                  <Text style={{ fontSize: fs(12.5), color: p.muted }} numberOfLines={1}>
                    {[time, s.category].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <Text style={{ fontSize: fs(15), fontWeight: "600", color: p.ink }}>−{formatINR(s.dailyAmount)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {aside.length > 0 && (
        <Text style={[styles.aside, { borderTopColor: p.grid, color: p.muted, fontSize: fs(13) }]}>
          {aside.map((s) => `${s.merchant?.trim() || s.category} ${formatINR(s.amount)}`).join(", ")}{" "}
          {aside.length === 1 ? t("notCountedOne") : t("notCountedMany")}
        </Text>
      )}
    </Card>
  );
}

function SetUp({ p, token, onChanged }: { p: Palette; token: string; onChanged: () => void }) {
  const { t, fs } = useSettings();
  const [open, setOpen] = useState(false);
  return (
    <Card p={p} style={{ gap: 14, alignItems: "center", paddingVertical: 28 }}>
      <Ring size={120} stroke={10} fraction={0} color={p.accent} track={p.grid}>
        <Text style={{ fontSize: fs(26), fontWeight: "700", color: p.muted }}>₹</Text>
      </Ring>
      <Text style={{ fontSize: fs(18), fontWeight: "600", color: p.ink, textAlign: "center" }}>{t("setUpTitle")}</Text>
      <Text style={{ fontSize: fs(14), color: p.ink2, textAlign: "center", lineHeight: 21 }}>{t("dailyHint")}</Text>
      <Pressable style={[styles.cta, { backgroundColor: p.accent }]} onPress={() => setOpen(true)}>
        <Text style={{ color: p.onAccent, fontWeight: "700", fontSize: fs(15) }}>{t("setUpDaily")}</Text>
      </Pressable>
      {open && <PlanSheet p={p} token={token} onClose={() => setOpen(false)} onChanged={onChanged} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
  tile: { flex: 1, borderRadius: 14, padding: 12, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  aside: { borderTopWidth: 1, paddingTop: 12, marginTop: 14, lineHeight: 19 },
  cta: { alignSelf: "stretch", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
});
