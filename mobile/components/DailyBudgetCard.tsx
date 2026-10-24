import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  addCommitment,
  Commitment,
  CommitmentSuggestion,
  DailyPlan,
  DailyStatus,
  fetchPlan,
  removeCommitment,
  savePlan,
} from "../lib/api";
import { formatINR, Palette } from "../lib/theme";
import { useSettings } from "../lib/i18n";
import { Card, SectionTitle, TrackBar } from "./ui";

const RED = "#d03b3b";
const AMBER = "#c98500";

/**
 * The daily budget (v14): one number for today, what's eaten into it, and
 * the last two weeks of budget vs spend. The plan editor sits behind "Plan".
 */
export function DailyBudgetCard({
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
  const [editing, setEditing] = useState(false);
  const ready = !!daily?.ready && !!daily.plan;

  return (
    <Card p={p}>
      <View style={styles.headRow}>
        <SectionTitle p={p}>📅 {t("dailyBudget")}</SectionTitle>
        <Pressable onPress={() => setEditing(true)} hitSlop={8}>
          <Text style={{ color: p.accent, fontSize: fs(13), fontWeight: "600" }}>
            {ready ? t("editPlan") : t("setUpDaily")}
          </Text>
        </Pressable>
      </View>

      {!ready || !daily ? (
        <Text style={{ color: p.ink2, fontSize: fs(13.5), lineHeight: 20 }}>
          {t("dailyHint")}
        </Text>
      ) : (
        <TodayView p={p} d={daily} />
      )}

      {editing && (
        <PlanSheet
          p={p}
          token={token}
          onClose={() => setEditing(false)}
          onChanged={onChanged}
        />
      )}
    </Card>
  );
}

function TodayView({ p, d }: { p: Palette; d: DailyStatus }) {
  const { t, fs } = useSettings();
  const over = d.todayLeft < 0;
  const fraction = d.todayBudget > 0 ? d.todaySpent / d.todayBudget : over ? 1 : 0;
  const barColor = over ? RED : fraction >= 0.8 ? AMBER : p.good;
  const everyday = d.today.filter((e) => e.dailyAmount > 0);
  const aside = d.today.filter((e) => e.dailyAmount === 0);

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={[styles.hero, { color: over ? RED : p.ink, fontSize: fs(34) }]}>
          {formatINR(Math.abs(d.todayLeft))}
        </Text>
        <Text style={{ color: p.ink2, fontSize: fs(13) }}>
          {over ? t("overToday") : t("leftToday")} · {formatINR(d.todaySpent)} {t("ofToday")}{" "}
          {formatINR(d.todayBudget)}
        </Text>
      </View>
      <TrackBar p={p} fraction={Math.min(1, fraction)} color={barColor} />

      {everyday.length > 0 && (
        <View style={{ gap: 6 }}>
          {everyday.map((e, i) => (
            <View key={e.id ?? i} style={styles.spendRow}>
              <Text style={{ color: p.ink, fontSize: fs(13.5), flex: 1 }} numberOfLines={1}>
                {e.merchant?.trim() || e.category}
              </Text>
              <Text style={{ color: p.ink, fontSize: fs(13.5), fontWeight: "600" }}>
                −{formatINR(e.dailyAmount)}
              </Text>
            </View>
          ))}
        </View>
      )}
      {aside.length > 0 && (
        <Text style={{ color: p.muted, fontSize: fs(12.5) }}>
          {t("notCounted")}:{" "}
          {aside.map((e) => `${e.merchant?.trim() || e.category} ${formatINR(e.amount)}`).join(", ")}
        </Text>
      )}

      <History p={p} history={d.history.slice(-14)} />

      <View style={styles.footer}>
        <Stat p={p} label={t("everydayMoney")} value={formatINR(d.poolLeft)} sub={`${d.daysLeft} ${t("daysToGo")}`} />
        {d.tomorrowBudget !== null && (
          <Stat p={p} label={t("tomorrow")} value={formatINR(d.tomorrowBudget)} />
        )}
        {d.streak >= 2 && (
          <Stat p={p} label={`🔥 ${t("streakDays")}`} value={String(d.streak)} />
        )}
      </View>
    </View>
  );
}

function Stat({ p, label, value, sub }: { p: Palette; label: string; value: string; sub?: string }) {
  const { fs } = useSettings();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: p.muted, fontSize: fs(11.5) }}>{label}</Text>
      <Text style={{ color: p.ink, fontSize: fs(15), fontWeight: "700" }}>{value}</Text>
      {sub && <Text style={{ color: p.ink2, fontSize: fs(11.5) }}>{sub}</Text>}
    </View>
  );
}

/** Columns of spend per day, with a tick at that day's budget. */
function History({ p, history }: { p: Palette; history: DailyStatus["history"] }) {
  if (history.length < 2) return null;
  const max = Math.max(1, ...history.map((h) => Math.max(h.budget, h.spent)));
  const H = 56;
  return (
    <View style={[styles.chart, { height: H }]}>
      {history.map((h) => {
        const over = h.spent > h.budget;
        return (
          <View key={h.date} style={styles.col}>
            <View
              style={{
                height: Math.max(2, (h.spent / max) * H),
                backgroundColor: over ? RED : p.accent,
                opacity: over ? 0.85 : 0.7,
                borderRadius: 3,
              }}
            />
            <View
              style={[
                styles.tick,
                { bottom: (h.budget / max) * H, backgroundColor: p.ink2 },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

// ── Plan editor ─────────────────────────────────────────────────────────────

function PlanSheet({
  p,
  token,
  onClose,
  onChanged,
}: {
  p: Palette;
  token: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, fs } = useSettings();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [suggestions, setSuggestions] = useState<CommitmentSuggestion[]>([]);
  const [income, setIncome] = useState("");
  const [savings, setSavings] = useState("");
  const [payday, setPayday] = useState("");
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const load = async () => {
    const res = await fetchPlan(token).catch(() => null);
    if (!res) {
      setError("Couldn't load your plan — check your connection.");
    } else {
      setPlan(res.plan);
      setDaily(res.daily);
      setCommitments(res.commitments);
      setSuggestions(res.suggestions);
      setIncome(res.plan?.monthly_income ? String(res.plan.monthly_income) : "");
      setSavings(res.plan?.savings_goal ? String(res.plan.savings_goal) : "");
      setPayday(res.plan?.payday ? String(res.plan.payday) : "");
    }
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const num = (s: string) => parseFloat(s.replace(/,/g, ""));

  const run = async (work: () => Promise<boolean>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const ok = await work().catch(() => false);
    if (!ok) setError("Couldn't save — try again.");
    await load();
    onChanged();
    setBusy(false);
  };

  const saveMoney = () => {
    const i = num(income);
    const s = savings.trim() ? num(savings) : 0;
    const d = payday.trim() ? Number(payday.trim()) : null;
    if (!Number.isFinite(i) || i <= 0 || !Number.isFinite(s) || s < 0) {
      setError("Enter your monthly income as a number.");
      return;
    }
    if (d !== null && !(Number.isInteger(d) && d >= 1 && d <= 31)) {
      setError("Salary day is a date from 1 to 31.");
      return;
    }
    run(() =>
      savePlan(token, { monthly_income: Math.round(i), savings_goal: Math.round(s), payday: d }),
    );
  };

  const addOne = () => {
    const a = num(newAmount);
    if (!newName.trim() || !Number.isFinite(a) || a <= 0) return;
    run(async () => {
      const ok = await addCommitment(token, { name: newName.trim(), amount: Math.round(a) });
      if (ok) {
        setNewName("");
        setNewAmount("");
      }
      return ok;
    });
  };

  const toggle = (key: "morning_brief" | "evening_report" | "live_updates", value: boolean) =>
    run(() => savePlan(token, { [key]: value }));

  const inputBox = [styles.inputBox, { borderColor: p.grid, backgroundColor: p.page }];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={[styles.grab, { backgroundColor: p.grid }]} />
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 30 }} />
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
              <Text style={{ fontSize: fs(18), fontWeight: "700", color: p.ink }}>
                📅 {t("dailyBudget")}
              </Text>

              <Field p={p} label={t("monthlyIncome")}>
                <View style={inputBox}>
                  <Text style={[styles.rupee, { color: p.muted }]}>₹</Text>
                  <TextInput
                    style={[styles.input, { color: p.ink }]}
                    value={income}
                    onChangeText={setIncome}
                    keyboardType="numeric"
                    placeholder="100000"
                    placeholderTextColor={p.muted}
                  />
                </View>
              </Field>
              <Field p={p} label={t("savingsGoal")}>
                <View style={inputBox}>
                  <Text style={[styles.rupee, { color: p.muted }]}>₹</Text>
                  <TextInput
                    style={[styles.input, { color: p.ink }]}
                    value={savings}
                    onChangeText={setSavings}
                    keyboardType="numeric"
                    placeholder="15000"
                    placeholderTextColor={p.muted}
                  />
                </View>
              </Field>
              <Field p={p} label={t("payday")}>
                <View style={inputBox}>
                  <TextInput
                    style={[styles.input, { color: p.ink }]}
                    value={payday}
                    onChangeText={setPayday}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="30"
                    placeholderTextColor={p.muted}
                  />
                </View>
                <Text style={{ color: p.muted, fontSize: fs(12) }}>{t("paydayHint")}</Text>
              </Field>
              <Pressable
                style={[styles.btn, { backgroundColor: p.accent, opacity: busy ? 0.6 : 1 }]}
                onPress={saveMoney}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: fs(14) }}>{t("save")}</Text>
              </Pressable>

              <View style={{ gap: 8 }}>
                <Text style={{ color: p.ink, fontWeight: "600", fontSize: fs(14) }}>{t("fixedCosts")}</Text>
                <Text style={{ color: p.ink2, fontSize: fs(12.5) }}>{t("fixedHint")}</Text>
                {commitments.map((c) => (
                  <View key={c.id} style={styles.spendRow}>
                    <Text style={{ color: p.ink, fontSize: fs(14), flex: 1 }}>{c.name}</Text>
                    <Text style={{ color: p.ink, fontSize: fs(14), fontWeight: "600" }}>
                      {formatINR(c.amount)}
                    </Text>
                    <Pressable onPress={() => run(() => removeCommitment(token, c.id))} hitSlop={8}>
                      <Text style={{ color: RED, fontSize: fs(13), fontWeight: "600" }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={[...inputBox, styles.smallInput, { flex: 1.4, color: p.ink }]}
                    value={newName}
                    onChangeText={setNewName}
                    placeholder={t("costName")}
                    placeholderTextColor={p.muted}
                  />
                  <TextInput
                    style={[...inputBox, styles.smallInput, { flex: 1, color: p.ink }]}
                    value={newAmount}
                    onChangeText={setNewAmount}
                    keyboardType="numeric"
                    placeholder="₹"
                    placeholderTextColor={p.muted}
                  />
                  <Pressable style={[styles.addBtn, { borderColor: p.accent }]} onPress={addOne}>
                    <Text style={{ color: p.accent, fontWeight: "700", fontSize: fs(13) }}>{t("add")}</Text>
                  </Pressable>
                </View>
                {suggestions.length > 0 && (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: p.muted, fontSize: fs(12) }}>{t("suggestedFixed")}</Text>
                    <View style={styles.chips}>
                      {suggestions.map((s) => (
                        <Pressable
                          key={s.name}
                          style={[styles.chip, { borderColor: p.border, backgroundColor: p.page }]}
                          onPress={() =>
                            run(() =>
                              addCommitment(token, {
                                name: s.name,
                                amount: s.amount,
                                category: s.category,
                                match: s.match,
                              }),
                            )
                          }
                        >
                          <Text style={{ color: p.ink2, fontSize: fs(12.5) }}>
                            + {s.name} {formatINR(s.amount)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {daily?.ready && (
                <Text style={{ color: p.ink2, fontSize: fs(13), lineHeight: 19 }}>
                  {formatINR(daily.income)} − {formatINR(daily.fixed)} − {formatINR(daily.savingsGoal)} ={" "}
                  <Text style={{ color: p.ink, fontWeight: "700" }}>{formatINR(daily.pool)}</Text> · ≈
                  {formatINR(daily.baseDaily)}
                  {t("perDay")}
                </Text>
              )}

              {plan && (
                <View style={{ gap: 4 }}>
                  <ToggleRow p={p} label={t("morningMsg")} value={plan.morning_brief} onChange={(v) => toggle("morning_brief", v)} />
                  <ToggleRow p={p} label={t("eveningMsg")} value={plan.evening_report} onChange={(v) => toggle("evening_report", v)} />
                  <ToggleRow p={p} label={t("liveMsg")} value={plan.live_updates} onChange={(v) => toggle("live_updates", v)} />
                  <Text style={{ color: p.muted, fontSize: fs(12) }}>{t("messagesVia")}</Text>
                </View>
              )}

              {error && <Text style={{ color: RED, fontSize: fs(13) }}>{error}</Text>}

              <Pressable style={[styles.btnGhost, { borderColor: p.border }]} onPress={onClose}>
                <Text style={{ color: p.ink2, fontWeight: "600", fontSize: fs(14) }}>{t("done")}</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Field({ p, label, children }: { p: Palette; label: string; children: React.ReactNode }) {
  const { fs } = useSettings();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: p.ink2, fontSize: fs(13) }}>{label}</Text>
      {children}
    </View>
  );
}

function ToggleRow({
  p,
  label,
  value,
  onChange,
}: {
  p: Palette;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { fs } = useSettings();
  return (
    <View style={styles.toggleRow}>
      <Text style={{ color: p.ink, fontSize: fs(14) }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: p.accent }} />
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  hero: { fontWeight: "800", letterSpacing: -0.5 },
  spendRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  footer: { flexDirection: "row", flexWrap: "wrap", columnGap: 24, rowGap: 10 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  col: { flex: 1, justifyContent: "flex-end", height: "100%" },
  tick: { position: "absolute", left: -1, right: -1, height: 2, borderRadius: 1, opacity: 0.6 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: "88%",
  },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  inputBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, gap: 8 },
  rupee: { fontSize: 18, fontWeight: "700" },
  input: { flex: 1, fontSize: 18, fontWeight: "700", paddingVertical: 11 },
  smallInput: { paddingVertical: 10, fontSize: 14 },
  addBtn: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  btn: { borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  btnGhost: { borderWidth: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
});
