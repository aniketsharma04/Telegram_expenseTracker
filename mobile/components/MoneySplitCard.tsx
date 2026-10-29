import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { DailyStatus, savePlan } from "../lib/api";
import { useSettings } from "../lib/i18n";
import { emiCommitments, fill, salarySplit } from "../lib/money-rules";
import { formatINR, Palette } from "../lib/theme";
import { Card, CardHeader, TrackBar } from "./ui";

/**
 * The salary split (v18): the plan's own numbers laid against 50/30/20 (or
 * 60/20/20 when rent-heavy fixed costs pass half the income), with a one-tap
 * fix when saving falls short of 20%. Advice only — nothing changes unless
 * the user taps.
 */
export function MoneySplitCard({
  p,
  daily,
  token,
  onChanged,
}: {
  p: Palette;
  daily: DailyStatus | null | undefined;
  token: string;
  onChanged: () => void;
}) {
  const { t, fs } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!daily?.ready || !daily.plan) return null;

  const split = salarySplit({
    income: daily.income,
    fixed: daily.fixed,
    savingsGoal: daily.savingsGoal,
    goals: daily.goals ?? 0,
  });
  if (!split) return null;
  // Loans named in fixed costs: all EMIs together should stay under 40%.
  const emiPct = Math.round(
    (emiCommitments(daily.commitments ?? []) / daily.income) * 100,
  );

  const rows = [
    {
      label: t("splitNeeds"),
      hint: t("splitNeedsHint"),
      amount: split.amounts.needs,
      pct: split.pct.needs,
      target: split.target.needs,
      // Over the rule is the warning for needs and wants; under it, for saving.
      off: split.pct.needs > split.target.needs,
    },
    {
      label: t("splitWants"),
      hint: t("splitWantsHint"),
      amount: split.amounts.wants,
      pct: split.pct.wants,
      target: split.target.wants,
      off: split.pct.wants > split.target.wants,
    },
    {
      label: t("splitSave"),
      hint: t("splitSaveHint"),
      amount: split.amounts.save,
      pct: split.pct.save,
      target: split.target.save,
      off: split.pct.save < split.target.save,
    },
  ];

  const verdict =
    split.status === "high_needs"
      ? fill(t("splitHighNeeds"), { n: split.pct.needs })
      : split.status === "low_savings"
        ? fill(t("splitLow"), { n: split.pct.save })
        : fill(t("splitGood"), { n: split.pct.save });

  const apply = async () => {
    if (split.suggestSavingsGoal === null || busy) return;
    setBusy(true);
    setError(false);
    const ok = await savePlan(token, {
      savings_goal: split.suggestSavingsGoal,
    }).catch(() => false);
    setBusy(false);
    if (ok) onChanged();
    else setError(true);
  };

  return (
    <Card p={p}>
      <CardHeader p={p} title={`${t("moneySplit")} · ${split.rule}`} />
      <View style={{ gap: 12, marginTop: 4 }}>
        {rows.map((r) => (
          <View key={r.label} style={{ gap: 5 }}>
            <View style={styles.row}>
              <Text style={{ flex: 1, fontSize: fs(14), color: p.ink }}>
                {r.label}
                <Text style={{ fontSize: fs(12), color: p.muted }}>
                  {"  "}
                  {r.hint}
                </Text>
              </Text>
              <Text
                style={{
                  fontSize: fs(14),
                  fontWeight: "600",
                  color: r.off ? p.warn : p.ink,
                }}
              >
                {r.pct}%
              </Text>
            </View>
            <TrackBar
              p={p}
              fraction={Math.min(1, r.pct / 100)}
              color={r.off ? p.warn : p.accent}
            />
            <Text style={{ fontSize: fs(12), color: p.muted }}>
              {formatINR(r.amount)} ·{" "}
              {fill(t("splitRuleTarget"), { n: r.target })}
            </Text>
          </View>
        ))}

        <Text
          style={{
            fontSize: fs(13.5),
            color: split.status === "good" ? p.good : p.ink,
            fontWeight: "600",
          }}
        >
          {verdict}
        </Text>
        {emiPct > 40 && (
          <Text style={{ fontSize: fs(13), color: p.warn, lineHeight: 19 }}>
            {fill(t("splitEmiHigh"), { n: emiPct })}
          </Text>
        )}

        {split.suggestSavingsGoal !== null && (
          <Pressable
            style={[styles.btn, { borderColor: p.accent }]}
            onPress={apply}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={p.accent} />
            ) : (
              <Text
                style={{ color: p.accent, fontWeight: "700", fontSize: fs(14) }}
              >
                {fill(t("splitApply"), {
                  amount: formatINR(
                    split.suggestSavingsGoal + (daily.goals ?? 0),
                  ),
                })}
              </Text>
            )}
          </Pressable>
        )}
        {error && (
          <Text style={{ color: p.danger, fontSize: fs(13) }}>
            Couldn't save. Try again.
          </Text>
        )}

        <Text style={{ fontSize: fs(12.5), color: p.ink2, lineHeight: 18 }}>
          {split.rule === "60/20/20" ? t("rule602020") : t("rule503020")}
        </Text>
        <Text style={{ fontSize: fs(11.5), color: p.muted }}>
          {t("rulesNote")}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
});
