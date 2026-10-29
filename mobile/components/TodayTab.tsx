import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiData, DailyStatus, Expense } from "../lib/api";
import { categoryIcon, clockTime, tint } from "../lib/categories";
import { useSettings } from "../lib/i18n";
import { formatINR, Palette } from "../lib/theme";
import SetupFlow from "./SetupFlow";
import { Text } from "./Text";
import {
  Card,
  CardHeader,
  HeroBackground,
  Icon,
  IconBubble,
  PressableScale,
  Ring,
  useCountUp,
} from "./ui";

/**
 * Today (v19, premium): a deep-teal hero with the one number in it, cards
 * lifted over its edge, and a guided setup when there's no plan yet.
 */
export default function TodayTab({
  p,
  dark,
  data,
  token,
  colorByCategory,
  greeting,
  dateLabel,
  unread,
  onBell,
  onProfile,
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
  greeting: string;
  dateLabel: string;
  unread: number;
  onBell: () => void;
  onProfile: () => void;
  onChanged: () => void;
  onSeeAll: () => void;
  onEdit: (e: Expense) => void;
  /** Setup and permission cards, shown under the hero until they're done. */
  top?: React.ReactNode;
  /** Goals and anything else below the day. */
  bottom?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { t, fs } = useSettings();
  const [setupOpen, setSetupOpen] = useState(false);
  const daily = data.daily;
  const ready = !!daily?.ready && !!daily.plan;
  const initial = (data.user.name || "?").slice(0, 1).toUpperCase();

  return (
    <View>
      <View
        style={[
          styles.hero,
          { paddingTop: insets.top + 14, backgroundColor: p.heroTo },
        ]}
      >
        <HeroBackground p={p} />
        <View style={styles.heroTop}>
          <Pressable
            onPress={onProfile}
            style={styles.glassBtn}
            accessibilityRole="button"
            accessibilityLabel={t("profile")}
          >
            <Text
              style={{ color: "#fff", fontWeight: "700", fontSize: fs(16) }}
            >
              {initial}
            </Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: "rgba(255,255,255,0.78)", fontSize: fs(12.5) }}
            >
              {dateLabel}
            </Text>
            <Text
              style={{ color: "#fff", fontSize: fs(17), fontWeight: "700" }}
              numberOfLines={1}
            >
              {greeting}
            </Text>
          </View>
          <Pressable
            onPress={onBell}
            style={[styles.glassBtn, { borderRadius: 14 }]}
            accessibilityRole="button"
            accessibilityLabel={`${t("inbox")}${unread ? `, ${unread} unread` : ""}`}
          >
            <Icon name="bell" size={20} color="#fff" />
            {unread > 0 && <View style={styles.dot} />}
          </Pressable>
        </View>

        {ready && daily ? (
          <HeroNumber d={daily} />
        ) : (
          <View style={styles.heroEmpty}>
            <Ring
              size={150}
              stroke={11}
              fraction={0}
              color="#fff"
              track="rgba(255,255,255,0.2)"
            >
              <Text
                style={{ color: "#fff", fontSize: fs(30), fontWeight: "800" }}
              >
                ₹
              </Text>
            </Ring>
            <Text
              style={{
                color: "#fff",
                fontSize: fs(20),
                fontWeight: "800",
                textAlign: "center",
              }}
            >
              {t("setUpTitle")}
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.82)",
                fontSize: fs(14),
                textAlign: "center",
                lineHeight: fs(20),
              }}
            >
              {t("dailyHint")}
            </Text>
            <PressableScale
              onPress={() => setSetupOpen(true)}
              style={styles.heroCta}
              accessibilityRole="button"
            >
              <Text
                style={{
                  color: p.heroFrom,
                  fontWeight: "800",
                  fontSize: fs(15),
                }}
              >
                {t("setupCta")}
              </Text>
            </PressableScale>
          </View>
        )}
      </View>

      <View style={styles.lift}>
        {top}
        {ready && daily && (
          <>
            <TodayList
              p={p}
              dark={dark}
              d={daily}
              expenses={data.expenses}
              colorByCategory={colorByCategory}
              onSeeAll={onSeeAll}
              onEdit={onEdit}
            />
            <Pace p={p} d={daily} />
          </>
        )}
        {bottom}
      </View>

      {setupOpen && (
        <SetupFlow
          p={p}
          token={token}
          onClose={() => setSetupOpen(false)}
          onDone={onChanged}
        />
      )}
    </View>
  );
}

function HeroNumber({ d }: { d: DailyStatus }) {
  const { t, fs } = useSettings();
  const over = d.todayLeft < 0;
  const left = d.todayBudget > 0 ? Math.max(0, d.todayLeft) / d.todayBudget : 0;
  const shown = useCountUp(Math.abs(d.todayLeft));

  return (
    <View style={styles.heroNumber}>
      <Ring
        size={204}
        stroke={13}
        fraction={left}
        color="#fff"
        track="rgba(255,255,255,0.18)"
      >
        <Text
          style={{
            color: "rgba(255,255,255,0.8)",
            fontSize: fs(13),
            fontWeight: "500",
          }}
        >
          {over ? t("overToday") : t("leftTodayCap")}
        </Text>
        <Text
          style={{
            color: over ? "#fdd0b1" : "#fff",
            fontSize: fs(46),
            fontWeight: "800",
            letterSpacing: -1.5,
          }}
          accessibilityLabel={`${formatINR(Math.abs(d.todayLeft))} ${over ? t("overToday") : t("leftTodayShort")}`}
        >
          {formatINR(shown)}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: fs(12.5) }}>
          {t("ofToday")} {formatINR(d.todayBudget)}
        </Text>
      </Ring>
      <View style={styles.pills}>
        <View style={styles.pill}>
          <Text style={[styles.pillText, { fontSize: fs(13) }]}>
            {t("tomorrow")}{" "}
            {d.tomorrowBudget !== null
              ? formatINR(d.tomorrowBudget)
              : t("newMonth")}
          </Text>
        </View>
        <View style={styles.pill}>
          <Text style={[styles.pillText, { fontSize: fs(13) }]}>
            {formatINR(d.poolLeft)} · {d.daysLeft} {t("daysWord")}
          </Text>
        </View>
      </View>
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
      <CardHeader
        p={p}
        title={t("today")}
        action={t("seeAll")}
        onAction={onSeeAll}
      />
      {everyday.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="coffee" size={22} color={p.muted} />
          <Text style={{ fontSize: fs(14), color: p.ink2 }}>
            {t("nothingToday")}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {everyday.map((s, i) => {
            const full = s.id ? byId.get(s.id) : undefined;
            const color = colorByCategory[s.category] ?? p.muted;
            const time = clockTime(full?.logged_at);
            return (
              <PressableScale
                key={s.id ?? i}
                style={styles.row}
                onPress={() => full && onEdit(full)}
                accessibilityRole="button"
                accessibilityLabel={`${s.merchant?.trim() || s.category}, ${formatINR(s.dailyAmount)}`}
              >
                <IconBubble
                  name={categoryIcon(s.category)}
                  color={color}
                  bg={tint(color, dark)}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontSize: fs(15),
                      fontWeight: "600",
                      color: p.ink,
                    }}
                    numberOfLines={1}
                  >
                    {s.merchant?.trim() || s.category}
                  </Text>
                  <Text
                    style={{ fontSize: fs(12.5), color: p.muted }}
                    numberOfLines={1}
                  >
                    {[time, s.category].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <Text
                  style={{ fontSize: fs(15), fontWeight: "700", color: p.ink }}
                >
                  −{formatINR(s.dailyAmount)}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      )}
      {aside.length > 0 && (
        <View style={[styles.aside, { borderTopColor: p.grid }]}>
          <Icon name="info" size={14} color={p.muted} />
          <Text
            style={{
              flex: 1,
              color: p.muted,
              fontSize: fs(12.5),
              lineHeight: fs(18),
            }}
          >
            {aside
              .map(
                (s) =>
                  `${s.merchant?.trim() || s.category} ${formatINR(s.amount)}`,
              )
              .join(", ")}{" "}
            {aside.length === 1 ? t("notCountedOne") : t("notCountedMany")}
          </Text>
        </View>
      )}
    </Card>
  );
}

/** "On track" or "off pace", with the last seven days as small bars. */
function Pace({ p, d }: { p: Palette; d: DailyStatus }) {
  const { t, fs } = useSettings();
  const ahead = d.projectedLeftover >= 0;
  const week = d.history.slice(-7);
  const max = Math.max(1, ...week.map((h) => Math.max(h.spent, h.budget)));
  return (
    <Card p={p} style={styles.pace}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={{
            color: ahead ? p.accent : p.warn,
            fontSize: fs(11.5),
            fontWeight: "800",
            letterSpacing: 0.6,
          }}
        >
          {(ahead ? t("paceOnTrack") : t("offPace")).toUpperCase()}
        </Text>
        <Text style={{ color: p.ink, fontSize: fs(15), fontWeight: "700" }}>
          {ahead
            ? `${formatINR(d.projectedLeftover)} ${t("aheadAtPace")}`
            : `${formatINR(-d.projectedLeftover)} ${t("shortAtPace")}`}
        </Text>
        {d.streak >= 2 && (
          <Text style={{ color: p.muted, fontSize: fs(12.5) }}>
            {d.streak} {t("streakDays")}
          </Text>
        )}
      </View>
      <View style={styles.bars} accessibilityLabel={t("last7")}>
        {week.map((h) => (
          <View
            key={h.date}
            style={{
              width: 7,
              height: Math.max(4, (h.spent / max) * 40),
              borderRadius: 3,
              backgroundColor: h.spent > h.budget ? p.warn : p.accent,
            }}
          />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 54,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
    gap: 18,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  glassBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fbbf8c",
  },
  heroNumber: { alignItems: "center", gap: 14 },
  heroEmpty: { alignItems: "center", gap: 12, paddingHorizontal: 8 },
  heroCta: {
    marginTop: 6,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 28,
  },
  pills: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  pill: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  pillText: { color: "#fff", fontWeight: "600" },
  lift: { marginTop: -30, paddingHorizontal: 16, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  empty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  aside: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 14,
  },
  pace: { flexDirection: "row", alignItems: "center", gap: 14 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 40 },
});
