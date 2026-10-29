import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "./Text";
import { deleteGoal, GoalView, saveGoal } from "../lib/api";
import { StringKey, useSettings } from "../lib/i18n";
import {
  fill,
  goalAdvice,
  GOAL_KINDS,
  guessGoalKind,
  LOAN_RATE,
  type GoalAdvice,
  type GoalKind,
} from "../lib/money-rules";
import { formatINR, Palette } from "../lib/theme";
import { KeyboardAware, Card, SectionTitle, TrackBar } from "./ui";

/**
 * Goals (v17): what you're saving toward, how far along it is, and when it
 * lands at the current pace. Each goal's monthly share is already off the top
 * of the daily number, and gets credited when the budget month closes.
 *
 * v18: each goal is checked against the matching rule of thumb (20/4/10 for
 * vehicles, 20/30/40 for a home, six months for an emergency fund), and an
 * emergency fund is suggested first when there isn't one.
 */
export function GoalsCard({
  p,
  goals,
  token,
  income = 0,
  monthlySpend = 0,
  existingEmi = 0,
  onChanged,
}: {
  p: Palette;
  goals: GoalView[];
  token: string;
  /** Monthly take-home from the plan; 0 when not set up. */
  income?: number;
  /** Monthly needs + wants, for sizing the emergency fund. */
  monthlySpend?: number;
  /** EMIs already in fixed costs, for the 40% all-EMI limit. */
  existingEmi?: number;
  onChanged: () => void;
}) {
  const { t, fs } = useSettings();
  const [editing, setEditing] = useState<
    GoalView | { name: string; target: number } | "new" | null
  >(null);
  const emergencyTarget =
    monthlySpend > 0 &&
    !goals.some((g) => (g.kind ?? guessGoalKind(g.name)) === "emergency")
      ? Math.ceil((monthlySpend * 6) / 1000) * 1000
      : null;

  return (
    <Card p={p}>
      <View style={styles.head}>
        <SectionTitle p={p}>{t("goals")}</SectionTitle>
        <Pressable onPress={() => setEditing("new")} hitSlop={8}>
          <Text
            style={{ color: p.accent, fontSize: fs(13), fontWeight: "600" }}
          >
            + {t("addGoal")}
          </Text>
        </Pressable>
      </View>

      {emergencyTarget !== null && (
        <View
          style={[
            styles.nudge,
            { borderColor: p.border, backgroundColor: p.page },
          ]}
        >
          <Text
            style={{ flex: 1, color: p.ink2, fontSize: fs(13), lineHeight: 19 }}
          >
            {fill(t("emergencyNudge"), { amount: formatINR(emergencyTarget) })}
          </Text>
          <Pressable
            hitSlop={8}
            onPress={() =>
              setEditing({
                name: t("emergencyFundName"),
                target: emergencyTarget,
              })
            }
          >
            <Text
              style={{ color: p.accent, fontWeight: "700", fontSize: fs(13) }}
            >
              + {t("add")}
            </Text>
          </Pressable>
        </View>
      )}

      {goals.length === 0 ? (
        <Text style={{ color: p.ink2, fontSize: fs(13.5), lineHeight: 20 }}>
          {t("goalsHint")}
        </Text>
      ) : (
        <View style={{ gap: 14 }}>
          {goals.map((g) => {
            const done = g.saved >= g.target_amount;
            const color = done
              ? p.good
              : g.onTrack === false
                ? p.warn
                : p.accent;
            return (
              <Pressable
                key={g.id}
                onPress={() => setEditing(g)}
                style={{ gap: 5 }}
              >
                <View style={styles.row}>
                  <Text
                    style={{
                      fontSize: fs(14),
                      fontWeight: "600",
                      color: p.ink,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {g.name}
                  </Text>
                  <Text style={{ fontSize: fs(13), color: p.ink2 }}>
                    {formatINR(g.saved)} / {formatINR(g.target_amount)}
                  </Text>
                </View>
                <TrackBar p={p} fraction={g.pct / 100} color={color} />
                <Text style={{ fontSize: fs(12), color: p.muted }}>
                  {done
                    ? t("reached")
                    : [
                        `${formatINR(g.monthly)}${t("perMonth")}`,
                        g.monthsLeft !== null
                          ? `${g.monthsLeft} ${t("monthsToGo")}`
                          : null,
                        g.onTrack === null
                          ? null
                          : g.onTrack
                            ? `✓ ${t("onTrack")}`
                            : `${t("behind")}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {editing && (
        <GoalSheet
          p={p}
          token={token}
          goal={editing === "new" || !("id" in editing) ? null : editing}
          prefill={editing !== "new" && !("id" in editing) ? editing : null}
          income={income}
          monthlySpend={monthlySpend}
          existingEmi={existingEmi}
          onClose={() => setEditing(null)}
          onChanged={onChanged}
        />
      )}
    </Card>
  );
}

function GoalSheet({
  p,
  token,
  goal,
  prefill,
  income,
  monthlySpend,
  existingEmi,
  onClose,
  onChanged,
}: {
  p: Palette;
  token: string;
  goal: GoalView | null;
  prefill: { name: string; target: number } | null;
  income: number;
  monthlySpend: number;
  existingEmi: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, fs } = useSettings();
  const [name, setName] = useState(goal?.name ?? prefill?.name ?? "");
  const [target, setTarget] = useState(
    goal ? String(goal.target_amount) : prefill ? String(prefill.target) : "",
  );
  // The kind follows the name until the user picks one.
  const [pickedKind, setPickedKind] = useState<GoalKind | null>(
    goal?.kind ?? null,
  );
  const kind = pickedKind ?? guessGoalKind(name);
  const [by, setBy] = useState(goal?.target_date?.slice(0, 7) ?? "");
  const [monthly, setMonthly] = useState(
    goal && !goal.target_date ? String(goal.monthly) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = (s: string) => parseFloat(s.replace(/,/g, ""));
  const advice = useMemo(
    () =>
      goalAdvice({
        kind,
        target: num(target) || 0,
        income,
        monthlySpend,
        existingEmi,
      }),
    [kind, target, income, monthlySpend, existingEmi],
  );

  const save = async () => {
    const amount = num(target);
    const month = by.trim();
    const perMonth = monthly.trim() ? num(monthly) : null;
    if (!name.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Give it a name and an amount.");
      return;
    }
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      setError("Date as YYYY-MM, e.g. 2027-03.");
      return;
    }
    if (!month && (perMonth === null || !Number.isFinite(perMonth))) {
      setError("Add a date or a monthly amount.");
      return;
    }
    // A month means "by the end of that month".
    const date = month
      ? new Date(
          Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
        )
          .toISOString()
          .slice(0, 10)
      : null;
    setBusy(true);
    setError(null);
    const res = await saveGoal(token, {
      id: goal?.id,
      name: name.trim(),
      target_amount: Math.round(amount),
      target_date: date,
      monthly: date ? null : Math.round(perMonth ?? 0),
      kind,
    }).catch(() => ({
      ok: false as const,
      error: "Couldn't reach the server.",
    }));
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onChanged();
    onClose();
  };

  const stop = async () => {
    if (!goal || busy) return;
    setBusy(true);
    await deleteGoal(token, goal.id).catch(() => false);
    setBusy(false);
    onChanged();
    onClose();
  };

  const box = [
    styles.box,
    { borderColor: p.grid, backgroundColor: p.page, color: p.ink },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAware style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: p.surface, borderColor: p.border },
          ]}
        >
          <View style={[styles.grab, { backgroundColor: p.grid }]} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 12 }}
          >
            <Text style={{ fontSize: fs(18), fontWeight: "700", color: p.ink }}>
              {goal ? goal.name : t("addGoal")}
            </Text>
            <TextInput
              style={box}
              value={name}
              onChangeText={setName}
              placeholder={t("goalName")}
              placeholderTextColor={p.muted}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 8 }}
            >
              {GOAL_KINDS.map((k) => {
                const active = kind === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setPickedKind(k)}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? p.accent : p.border,
                        backgroundColor: active ? p.accentSoft : p.page,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: fs(13),
                        color: active ? p.ink : p.ink2,
                        fontWeight: active ? "600" : "400",
                      }}
                    >
                      {t(`kind_goal_${k}` as StringKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <TextInput
              style={box}
              value={target}
              onChangeText={setTarget}
              keyboardType="numeric"
              placeholder={`₹ ${t("goalTarget")}`}
              placeholderTextColor={p.muted}
            />
            <RuleAdvice
              p={p}
              kind={kind}
              advice={advice}
              hasIncome={income > 0}
              onUseTarget={(n) => setTarget(String(n))}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                style={[...box, { flex: 1 }]}
                value={by}
                onChangeText={(v) => {
                  setBy(v);
                  if (v) setMonthly("");
                }}
                placeholder={t("goalBy")}
                placeholderTextColor={p.muted}
                maxLength={7}
              />
              <TextInput
                style={[...box, { flex: 1 }]}
                value={monthly}
                onChangeText={(v) => {
                  setMonthly(v);
                  if (v) setBy("");
                }}
                keyboardType="numeric"
                placeholder={t("goalMonthly")}
                placeholderTextColor={p.muted}
              />
            </View>
            {error && (
              <Text style={{ color: p.danger, fontSize: fs(13) }}>{error}</Text>
            )}
            <Pressable
              style={[
                styles.btn,
                { backgroundColor: p.accent, opacity: busy ? 0.6 : 1 },
              ]}
              onPress={save}
            >
              <Text
                style={{ color: "#fff", fontWeight: "700", fontSize: fs(14) }}
              >
                {t("save")}
              </Text>
            </Pressable>
            {goal && (
              <Pressable
                style={[styles.ghost, { borderColor: p.border }]}
                onPress={stop}
              >
                <Text
                  style={{
                    color: p.danger,
                    fontWeight: "600",
                    fontSize: fs(14),
                  }}
                >
                  {t("stopGoal")}
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </KeyboardAware>
    </Modal>
  );
}

/** The 40% all-EMI check, once the user already pays other EMIs. */
function allEmiLine(
  t: (k: StringKey) => string,
  a: { existingEmi: number; allEmiPct: number; limitedByOtherEmis: boolean },
): string {
  return fill(t(a.allEmiPct > 40 ? "ruleAllEmiOver" : "ruleAllEmiOk"), {
    existing: formatINR(a.existingEmi),
    n: a.allEmiPct,
  });
}

/** The matching rule of thumb for a goal, with a one-tap fix when there is one. */
function RuleAdvice({
  p,
  kind,
  advice,
  hasIncome,
  onUseTarget,
}: {
  p: Palette;
  kind: GoalKind;
  advice: GoalAdvice | null;
  hasIncome: boolean;
  onUseTarget: (amount: number) => void;
}) {
  const { t, fs } = useSettings();
  if (kind === "other") return null;
  if (!advice) {
    // Without an income there's nothing to check the price against.
    return !hasIncome ? (
      <Text style={{ fontSize: fs(12.5), color: p.muted, lineHeight: 18 }}>
        {t("ruleNeedIncome")}
      </Text>
    ) : null;
  }

  let title = "";
  const lines: string[] = [];
  let action: { label: string; amount: number } | null = null;
  let good = false;

  if (advice.kind === "car" || advice.kind === "bike") {
    title = t("ruleVehicleTitle");
    if (advice.cashOk) {
      // emiCap is 10% of income, so income = emiCap × 10.
      lines.push(
        fill(t("ruleBikeCash"), {
          n: Math.max(1, Math.round(advice.price / (advice.emiCap * 10))),
        }),
      );
      good = true;
    } else {
      lines.push(
        fill(t("ruleVehicleBody"), {
          down: formatINR(advice.down),
          cap: formatINR(advice.emiCap),
        }),
        fill(t("ruleEmiLine"), {
          rate: LOAN_RATE[advice.kind],
          years: advice.months / 12,
          emi: formatINR(advice.emi),
        }),
        advice.fits
          ? t("ruleFits")
          : fill(t("ruleVehicleOver"), { max: formatINR(advice.maxPrice) }),
        t("ruleRunningCosts"),
      );
      if (advice.existingEmi > 0) lines.push(allEmiLine(t, advice));
      good = advice.fits;
      action = {
        label: fill(t("ruleSaveDown"), {
          amount: formatINR(advice.suggestTarget),
        }),
        amount: advice.suggestTarget,
      };
    }
  } else if (advice.kind === "home") {
    title = t("ruleHomeTitle");
    lines.push(
      fill(t("ruleHomeBody"), {
        down: formatINR(advice.down),
        cap: formatINR(advice.emiCap),
      }),
      fill(t("ruleEmiLine"), {
        rate: LOAN_RATE.home,
        years: advice.months / 12,
        emi: formatINR(advice.emi),
      }),
      advice.fits
        ? t("ruleFits")
        : fill(t("ruleHomeOver"), { max: formatINR(advice.maxPrice) }),
    );
    if (advice.incomeYears > 5)
      lines.push(fill(t("ruleHomeYears"), { n: advice.incomeYears }));
    if (advice.existingEmi > 0) lines.push(allEmiLine(t, advice));
    good = advice.fits;
    action = {
      label: fill(t("ruleSaveDown"), {
        amount: formatINR(advice.suggestTarget),
      }),
      amount: advice.suggestTarget,
    };
  } else if (advice.kind === "emergency") {
    title = t("ruleEmergencyTitle");
    lines.push(
      fill(t("ruleEmergencyBody"), {
        monthly: formatINR(advice.monthlySpend),
      }),
    );
    action = {
      label: fill(t("ruleUseAmount"), {
        amount: formatINR(advice.suggestTarget),
      }),
      amount: advice.suggestTarget,
    };
  } else if (advice.kind === "gadget" || advice.kind === "trip") {
    title = t("ruleSaveFirstTitle");
    lines.push(
      fill(t(advice.kind === "gadget" ? "ruleGadgetBody" : "ruleTripBody"), {
        n: advice.monthsOfIncome,
      }),
    );
  }

  return (
    <View
      style={[
        styles.advice,
        { borderColor: good ? p.good : p.border, backgroundColor: p.page },
      ]}
    >
      <Text style={{ fontSize: fs(13.5), fontWeight: "700", color: p.ink }}>
        {title}
      </Text>
      {lines.map((l) => (
        <Text
          key={l}
          style={{ fontSize: fs(12.5), color: p.ink2, lineHeight: 18 }}
        >
          {l}
        </Text>
      ))}
      {action && (
        <Pressable
          style={[styles.adviceBtn, { borderColor: p.accent }]}
          onPress={() => onUseTarget(action.amount)}
        >
          <Text
            style={{ color: p.accent, fontWeight: "700", fontSize: fs(13) }}
          >
            {action.label}
          </Text>
        </Pressable>
      )}
      <Text style={{ fontSize: fs(11), color: p.muted }}>{t("rulesNote")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  nudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  advice: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  adviceBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    marginTop: 2,
  },

  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: "85%",
  },
  grab: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  box: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  btn: { borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  ghost: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
});
