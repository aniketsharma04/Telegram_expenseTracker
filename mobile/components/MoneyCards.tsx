import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Anomaly,
  BudgetProgress,
  IncomeEntry,
  RecurringCharge,
  removeBudget,
  saveBudget,
} from "../lib/api";
import { formatINR, Palette } from "../lib/theme";
import { useSettings } from "../lib/i18n";
import { Card, SectionTitle, TrackBar } from "./ui";

/** Budgets with progress bars + an inline editor sheet. */
export function BudgetsCard({
  p,
  budgets,
  categories,
  token,
  onChanged,
}: {
  p: Palette;
  budgets: BudgetProgress[];
  categories: Array<{ name: string; color: string | null }>;
  token: string;
  onChanged: () => void;
}) {
  const { t, fs } = useSettings();
  const [editing, setEditing] = useState(false);

  return (
    <Card p={p}>
      <View style={styles.headRow}>
        <SectionTitle p={p}>🎯 {t("budgets")}</SectionTitle>
        <Pressable onPress={() => setEditing(true)}>
          <Text style={{ color: p.accent, fontSize: fs(13), fontWeight: "600" }}>
            {budgets.length === 0 ? t("setBudgets") : t("editBudgets")}
          </Text>
        </Pressable>
      </View>

      {budgets.length === 0 ? (
        <Text style={{ color: p.ink2, fontSize: fs(13.5), lineHeight: 20 }}>{t("budgetHint")}</Text>
      ) : (
        <View style={{ gap: 12 }}>
          {[...budgets]
            .sort((a, b) => (a.category === null ? -1 : b.category === null ? 1 : b.pct - a.pct))
            .map((b) => {
              const pct = Math.min(1, b.pct);
              const color = b.pct >= 1 ? "#d03b3b" : b.pct >= 0.8 ? "#c98500" : p.good;
              return (
                <View key={b.id} style={{ gap: 5 }}>
                  <View style={styles.budgetMeta}>
                    <Text style={{ fontSize: fs(13), fontWeight: "500", color: p.ink }}>
                      {b.category ?? t("overall")}
                    </Text>
                    <Text style={{ fontSize: fs(13), color: p.ink2 }}>
                      {formatINR(b.spent)} / {formatINR(b.monthly_cap)}
                      <Text style={{ color, fontWeight: "700" }}> · {Math.round(b.pct * 100)}%</Text>
                    </Text>
                  </View>
                  <TrackBar p={p} fraction={pct} color={color} />
                </View>
              );
            })}
        </View>
      )}

      {editing && (
        <BudgetEditor
          p={p}
          budgets={budgets}
          categories={categories}
          token={token}
          onClose={() => setEditing(false)}
          onChanged={onChanged}
        />
      )}
    </Card>
  );
}

function BudgetEditor({
  p,
  budgets,
  categories,
  token,
  onClose,
  onChanged,
}: {
  p: Palette;
  budgets: BudgetProgress[];
  categories: Array<{ name: string; color: string | null }>;
  token: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, fs } = useSettings();
  const [target, setTarget] = useState<string | null>(null); // null = overall
  const [cap, setCap] = useState("");
  const [busy, setBusy] = useState(false);

  const options: Array<string | null> = [
    null,
    ...categories.filter((c) => c.name !== "Uncategorized").map((c) => c.name),
  ];
  const capNum = parseFloat(cap.replace(/,/g, ""));
  const ready = Number.isFinite(capNum) && capNum > 0;

  const existingFor = (o: string | null) => budgets.find((b) => b.category === o);

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const ok = await saveBudget(token, target, capNum).catch(() => false);
    setBusy(false);
    if (ok) {
      setCap("");
      onChanged();
    }
  };

  const removeOne = async (o: string | null) => {
    if (busy) return;
    setBusy(true);
    await removeBudget(token, o).catch(() => false);
    setBusy(false);
    onChanged();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={[styles.grab, { backgroundColor: p.grid }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 13 }}>
            <Text style={{ fontSize: fs(18), fontWeight: "700", color: p.ink }}>🎯 {t("budgets")}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {options.map((o) => {
                const active = target === o;
                const has = existingFor(o);
                return (
                  <Pressable
                    key={o ?? "__overall"}
                    onPress={() => {
                      setTarget(o);
                      setCap(has ? String(has.monthly_cap) : "");
                    }}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? p.accent : p.border,
                        backgroundColor: active ? p.accentSoft : p.page,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: fs(13), color: active ? p.ink : p.ink2, fontWeight: active ? "600" : "400" }}>
                      {o ?? t("overall")}
                      {has ? " ✓" : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={[styles.amountBox, { borderColor: p.grid, backgroundColor: p.page }]}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: p.muted }}>₹</Text>
              <TextInput
                style={[styles.amountInput, { color: p.ink }]}
                placeholder={t("monthlyCap")}
                placeholderTextColor={p.muted}
                value={cap}
                onChangeText={setCap}
                keyboardType="numeric"
              />
              {existingFor(target) && (
                <Pressable onPress={() => removeOne(target)}>
                  <Text style={{ color: "#d03b3b", fontSize: fs(13), fontWeight: "600" }}>{t("remove")}</Text>
                </Pressable>
              )}
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable style={[styles.btnGhost, { borderColor: p.border }]} onPress={onClose}>
                <Text style={{ color: p.ink2, fontWeight: "600", fontSize: fs(14) }}>{t("done")}</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, { backgroundColor: p.accent, opacity: ready && !busy ? 1 : 0.5, flex: 1 }]}
                onPress={save}
                disabled={!ready || busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: fs(15) }}>
                    {t("save")} {ready ? formatINR(capNum) : ""}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Earned / spent / kept this month — only shown when income is logged. */
export function SavingsCard({
  p,
  incomes,
  spent,
  invested,
  monthPrefix,
}: {
  p: Palette;
  incomes: IncomeEntry[];
  spent: number;
  invested: number;
  monthPrefix: string; // YYYY-MM
}) {
  const { t, fs } = useSettings();
  const earned = incomes
    .filter((i) => i.income_date.startsWith(monthPrefix))
    .reduce((s, i) => s + Number(i.amount), 0);
  if (earned <= 0) return null;
  const kept = earned - spent - invested;
  const rate = Math.round((Math.max(kept, 0) / earned) * 100);

  return (
    <Card p={p}>
      <SectionTitle p={p}>💵 {t("savedThisMonth")}</SectionTitle>
      <View style={styles.savingsRow}>
        <View style={styles.savingsCol}>
          <Text style={{ fontSize: fs(12), color: p.muted }}>{t("earned")}</Text>
          <Text style={{ fontSize: fs(16), fontWeight: "700", color: p.ink }}>{formatINR(earned)}</Text>
        </View>
        <View style={styles.savingsCol}>
          <Text style={{ fontSize: fs(12), color: p.muted }}>{t("spent")} + {t("invested").toLowerCase()}</Text>
          <Text style={{ fontSize: fs(16), fontWeight: "700", color: p.ink }}>{formatINR(spent + invested)}</Text>
        </View>
        <View style={styles.savingsCol}>
          <Text style={{ fontSize: fs(12), color: p.muted }}>{t("kept")}</Text>
          <Text style={{ fontSize: fs(16), fontWeight: "800", color: kept >= 0 ? p.good : "#d03b3b" }}>
            {formatINR(kept)} <Text style={{ fontSize: fs(12) }}>({rate}%)</Text>
          </Text>
        </View>
      </View>
    </Card>
  );
}

/** Upcoming recurring charges + spending anomalies. Renders nothing when quiet. */
export function InsightsCards({
  p,
  recurring,
  anomalies,
}: {
  p: Palette;
  recurring: RecurringCharge[];
  anomalies: Anomaly[];
}) {
  const { t, fs } = useSettings();
  if (recurring.length === 0 && anomalies.length === 0) return null;

  return (
    <>
      {recurring.length > 0 && (
        <Card p={p}>
          <SectionTitle p={p}>🔁 {t("upcoming")}</SectionTitle>
          <View style={{ gap: 10 }}>
            {recurring.slice(0, 4).map((r) => (
              <View key={`${r.merchant}|${r.category}`} style={styles.insightRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: fs(14), fontWeight: "500", color: p.ink }} numberOfLines={1}>
                    {r.merchant}
                  </Text>
                  <Text style={{ fontSize: fs(12), color: p.muted }}>
                    {r.category} · {t("dueAround")} {Number(r.nextDate.slice(8))} ({t("inDays")}{" "}
                    {r.daysUntil} {t("days")})
                  </Text>
                </View>
                <Text style={{ fontSize: fs(14), fontWeight: "700", color: p.ink }}>
                  ~{formatINR(r.amount)}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}
      {anomalies.length > 0 && (
        <Card p={p}>
          <SectionTitle p={p}>⚡ {t("headsUp")}</SectionTitle>
          <View style={{ gap: 10 }}>
            {anomalies.slice(0, 3).map((a) => (
              <View key={a.category} style={styles.insightRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fs(14), fontWeight: "500", color: p.ink }}>{a.category}</Text>
                  <Text style={{ fontSize: fs(12), color: p.muted }}>
                    {t("usualPace")}: ~{formatINR(a.expected)}
                  </Text>
                </View>
                <Text style={{ fontSize: fs(14), fontWeight: "700", color: "#c98500" }}>
                  {formatINR(a.mtd)}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  budgetMeta: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: "80%",
  },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  amountBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, gap: 8 },
  amountInput: { flex: 1, fontSize: 20, fontWeight: "700", paddingVertical: 12 },
  btn: { borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  btnGhost: { borderWidth: 1, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignItems: "center" },
  savingsRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  savingsCol: { gap: 3 },
  insightRow: { flexDirection: "row", alignItems: "center", gap: 12 },
});
