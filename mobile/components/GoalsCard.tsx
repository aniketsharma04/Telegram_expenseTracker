import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { deleteGoal, GoalView, saveGoal } from "../lib/api";
import { useSettings } from "../lib/i18n";
import { formatINR, Palette } from "../lib/theme";
import { Card, SectionTitle, TrackBar } from "./ui";

/**
 * Goals (v17): what you're saving toward, how far along it is, and when it
 * lands at the current pace. Each goal's monthly share is already off the top
 * of the daily number, and gets credited when the budget month closes.
 */
export function GoalsCard({
  p,
  goals,
  token,
  onChanged,
}: {
  p: Palette;
  goals: GoalView[];
  token: string;
  onChanged: () => void;
}) {
  const { t, fs } = useSettings();
  const [editing, setEditing] = useState<GoalView | "new" | null>(null);

  return (
    <Card p={p}>
      <View style={styles.head}>
        <SectionTitle p={p}>{t("goals")}</SectionTitle>
        <Pressable onPress={() => setEditing("new")} hitSlop={8}>
          <Text style={{ color: p.accent, fontSize: fs(13), fontWeight: "600" }}>+ {t("addGoal")}</Text>
        </Pressable>
      </View>

      {goals.length === 0 ? (
        <Text style={{ color: p.ink2, fontSize: fs(13.5), lineHeight: 20 }}>{t("goalsHint")}</Text>
      ) : (
        <View style={{ gap: 14 }}>
          {goals.map((g) => {
            const done = g.saved >= g.target_amount;
            const color = done ? p.good : g.onTrack === false ? p.warn : p.accent;
            return (
              <Pressable key={g.id} onPress={() => setEditing(g)} style={{ gap: 5 }}>
                <View style={styles.row}>
                  <Text style={{ fontSize: fs(14), fontWeight: "600", color: p.ink, flex: 1 }} numberOfLines={1}>
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
                        g.monthsLeft !== null ? `${g.monthsLeft} ${t("monthsToGo")}` : null,
                        g.onTrack === null ? null : g.onTrack ? `✓ ${t("onTrack")}` : `${t("behind")}`,
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
          goal={editing === "new" ? null : editing}
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
  onClose,
  onChanged,
}: {
  p: Palette;
  token: string;
  goal: GoalView | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, fs } = useSettings();
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? String(goal.target_amount) : "");
  const [by, setBy] = useState(goal?.target_date?.slice(0, 7) ?? "");
  const [monthly, setMonthly] = useState(goal && !goal.target_date ? String(goal.monthly) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = (s: string) => parseFloat(s.replace(/,/g, ""));

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
      ? new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10)
      : null;
    setBusy(true);
    setError(null);
    const res = await saveGoal(token, {
      id: goal?.id,
      name: name.trim(),
      target_amount: Math.round(amount),
      target_date: date,
      monthly: date ? null : Math.round(perMonth ?? 0),
    }).catch(() => ({ ok: false as const, error: "Couldn't reach the server." }));
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

  const box = [styles.box, { borderColor: p.grid, backgroundColor: p.page, color: p.ink }];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={[styles.grab, { backgroundColor: p.grid }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
            <Text style={{ fontSize: fs(18), fontWeight: "700", color: p.ink }}>{goal ? goal.name : t("addGoal")}</Text>
            <TextInput style={box} value={name} onChangeText={setName} placeholder={t("goalName")} placeholderTextColor={p.muted} />
            <TextInput
              style={box}
              value={target}
              onChangeText={setTarget}
              keyboardType="numeric"
              placeholder={`₹ ${t("goalTarget")}`}
              placeholderTextColor={p.muted}
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
            {error && <Text style={{ color: p.danger, fontSize: fs(13) }}>{error}</Text>}
            <Pressable style={[styles.btn, { backgroundColor: p.accent, opacity: busy ? 0.6 : 1 }]} onPress={save}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: fs(14) }}>{t("save")}</Text>
            </Pressable>
            {goal && (
              <Pressable style={[styles.ghost, { borderColor: p.border }]} onPress={stop}>
                <Text style={{ color: p.danger, fontWeight: "600", fontSize: fs(14) }}>{t("stopGoal")}</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: "85%",
  },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  box: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  btn: { borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  ghost: { borderWidth: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
});
