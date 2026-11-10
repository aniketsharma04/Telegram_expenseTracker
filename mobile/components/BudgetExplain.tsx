import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { Sheet } from "./cards/parts";
import { Card, Icon } from "./ui";
import {
  addCommitment,
  DailyStatus,
  MatchToConfirm,
  patchExpense,
} from "../lib/api";
import { useSettings } from "../lib/i18n";
import { formatINR, Palette } from "../lib/theme";

const MONTHS = [
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
const short = (iso: string) =>
  `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

/**
 * "Why ₹1,111?" — the sum behind today's number, step by step, so a number
 * that looks wrong can be checked instead of distrusted.
 */
export function WhySheet({
  p,
  d,
  visible,
  onClose,
}: {
  p: Palette;
  d: DailyStatus;
  visible: boolean;
  onClose: () => void;
}) {
  const { t, fs } = useSettings();
  const spentBefore = d.poolSpent - d.todaySpent;
  const leftThisMorning = d.pool - spentBefore;
  const fixed = d.commitments ?? [];

  const Row = ({
    label,
    value,
    strong,
    note,
  }: {
    label: string;
    value: string;
    strong?: boolean;
    note?: string;
  }) => (
    <View style={{ gap: 2 }}>
      <View style={styles.row}>
        <Text
          style={{
            flex: 1,
            color: strong ? p.ink : p.ink2,
            fontSize: fs(14),
            fontWeight: strong ? "700" : "400",
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            color: p.ink,
            fontSize: fs(strong ? 16 : 14),
            fontWeight: strong ? "800" : "600",
          }}
        >
          {value}
        </Text>
      </View>
      {note ? (
        <Text style={{ color: p.muted, fontSize: fs(12) }}>{note}</Text>
      ) : null}
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} p={p} title={t("whyTitle")}>
      <View style={{ gap: 12, paddingBottom: 8 }}>
        <Row
          label={t("everydayMoney")}
          value={formatINR(d.pool)}
          note={
            d.countingFrom && d.fullPool
              ? `${t("countingFromNote")} ${short(d.countingFrom)}.`
              : `${t("whyPoolNote")}`
          }
        />
        <Row
          label={t("whySpentBefore")}
          value={`− ${formatINR(spentBefore)}`}
        />
        <View style={[styles.rule, { backgroundColor: p.grid }]} />
        <Row label={t("whyLeftMorning")} value={formatINR(leftThisMorning)} />
        <Row
          label={t("whyDaysLeft")}
          value={`÷ ${d.daysLeft}`}
          note={
            d.cycleEnd ? `${t("whyUntil")} ${short(d.cycleEnd)}` : undefined
          }
        />
        <View style={[styles.rule, { backgroundColor: p.grid }]} />
        <Row label={t("whyToday")} value={formatINR(d.todayBudget)} strong />
        {d.todaySpent > 0 && (
          <Row
            label={t("whySpentToday")}
            value={`− ${formatINR(d.todaySpent)}`}
            note={
              d.todayLeft >= 0
                ? `${formatINR(d.todayLeft)} ${t("leftTodayShort")}`
                : `${formatINR(-d.todayLeft)} ${t("overToday")}`
            }
          />
        )}

        <View style={[styles.tip, { backgroundColor: p.accentSoft }]}>
          <Icon name="info" size={14} color={p.accent} />
          <Text
            style={{
              flex: 1,
              color: p.ink,
              fontSize: fs(13),
              lineHeight: fs(19),
            }}
          >
            {t("whyRollover")}
          </Text>
        </View>

        {fixed.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={{ color: p.ink, fontSize: fs(14), fontWeight: "700" }}>
              {t("whyFixedTitle")}
            </Text>
            {fixed.map((c) => (
              <View key={c.id} style={styles.row}>
                <Text style={{ flex: 1, color: p.ink2, fontSize: fs(13.5) }}>
                  {c.name} {formatINR(c.amount)}
                </Text>
                <Text
                  style={{
                    fontSize: fs(12.5),
                    fontWeight: "600",
                    color: c.paid >= c.amount * 0.7 ? p.accent : p.muted,
                  }}
                >
                  {c.paid >= c.amount * 0.7
                    ? t("whyPaid")
                    : c.paid > 0
                      ? `${formatINR(c.paid)} ${t("whyPaidSoFar")}`
                      : t("whyNotYet")}
                </Text>
              </View>
            ))}
            <Text style={{ color: p.muted, fontSize: fs(12) }}>
              {t("whyFixedNote")}
            </Text>
          </View>
        )}
      </View>
    </Sheet>
  );
}

/**
 * One question per guessed fixed cost: "Is ₹20,000 to SHARMA PROPERTIES your
 * Rent?" Yes marks it fixed and learns the payee as the keyword, so next
 * month needs no guess; No counts it as everyday spending.
 */
export function ConfirmMatchCard({
  p,
  d,
  token,
  onChanged,
}: {
  p: Palette;
  d: DailyStatus;
  token: string;
  onChanged: () => void;
}) {
  const { t, fs } = useSettings();
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const [error, setError] = useState(false);
  const item: MatchToConfirm | undefined = d.toConfirm?.[0];
  if (!item) return null;
  const commitment = d.commitments.find((c) => c.id === item.commitmentId);

  const answer = async (yes: boolean) => {
    if (busy) return;
    setBusy(yes ? "yes" : "no");
    setError(false);
    try {
      const marked = await patchExpense(token, item.expenseId, {
        budget_scope: yes ? "fixed" : "daily",
      });
      if (!marked || marked === "unauthorized") throw new Error("patch");
      // Learn the payee so next month's payment matches without a guess.
      const payee = item.merchant?.trim();
      if (yes && commitment && payee && payee.length >= 3)
        await addCommitment(token, {
          name: commitment.name,
          amount: commitment.amount,
          match: payee,
        });
      onChanged();
    } catch {
      setError(true);
    }
    setBusy(null);
  };

  const who = item.merchant ? ` ${t("toWord")} ${item.merchant}` : "";
  return (
    <Card p={p}>
      <View style={{ gap: 12 }}>
        <View style={styles.row}>
          <Icon name="help-circle" size={18} color={p.accent} />
          <Text
            style={{
              flex: 1,
              color: p.ink,
              fontSize: fs(15),
              fontWeight: "700",
            }}
          >
            {formatINR(item.amount)}
            {who} {t("confirmIsYour")} {item.commitmentName}?
          </Text>
        </View>
        <Text style={{ color: p.ink2, fontSize: fs(13), lineHeight: fs(19) }}>
          {short(item.date)} · {t("confirmHint")}
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => answer(true)}
            disabled={!!busy}
            accessibilityRole="button"
            style={[styles.btn, { backgroundColor: p.accent }]}
          >
            {busy === "yes" ? (
              <ActivityIndicator color={p.onAccent} />
            ) : (
              <Text
                style={{
                  color: p.onAccent,
                  fontWeight: "700",
                  fontSize: fs(14),
                }}
              >
                {t("confirmYes")} {item.commitmentName}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => answer(false)}
            disabled={!!busy}
            accessibilityRole="button"
            style={[styles.btn, { borderWidth: 1, borderColor: p.border }]}
          >
            {busy === "no" ? (
              <ActivityIndicator color={p.ink} />
            ) : (
              <Text
                style={{ color: p.ink, fontWeight: "600", fontSize: fs(14) }}
              >
                {t("confirmNo")}
              </Text>
            )}
          </Pressable>
        </View>
        {error && (
          <Text style={{ color: p.warn, fontSize: fs(12.5) }}>
            {t("saveFailed")}
          </Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  rule: { height: 1 },
  tip: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 12,
    padding: 12,
    alignItems: "flex-start",
  },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
});
