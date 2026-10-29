import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Text, TextInput } from "./Text";
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
import { parseAmount } from "../lib/amount";
import { useSettings } from "../lib/i18n";
import { KeyboardAware, Card, CardHeader } from "./ui";
import SetupFlow from "./SetupFlow";

const RED = "#b91c1c";

/**
 * The plan behind the daily number (Plan tab): income minus fixed costs,
 * savings and goals, the budget month, and the last two weeks of budget vs
 * spend. Editing opens PlanSheet.
 */
export function PlanSummaryCard({
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
  const [setupOpen, setSetupOpen] = useState(false);
  const ready = !!daily?.ready && !!daily.plan;
  // No plan yet: the guided setup. A plan already: the quick editor.
  const open = () => (ready ? setEditing(true) : setSetupOpen(true));

  return (
    <Card p={p}>
      <CardHeader
        p={p}
        title={t("dailyBudget")}
        action={ready ? t("editPlan") : t("setUpDaily")}
        onAction={open}
      />
      {!ready || !daily ? (
        <View style={{ gap: 14 }}>
          <Text style={{ color: p.ink2, fontSize: fs(14), lineHeight: 21 }}>
            {t("dailyHint")}
          </Text>
          <Pressable
            style={[styles.btn, { backgroundColor: p.accent }]}
            onPress={open}
          >
            <Text
              style={{ color: p.onAccent, fontWeight: "700", fontSize: fs(14) }}
            >
              {t("setUpDaily")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Line
            p={p}
            label={t("monthlyIncome")}
            value={formatINR(daily.income)}
          />
          <Line
            p={p}
            label={t("fixedCosts")}
            value={`− ${formatINR(daily.fixed)}`}
          />
          <Line
            p={p}
            label={t("savingsGoal")}
            value={`− ${formatINR(daily.savingsGoal)}`}
          />
          {!!daily.goals && (
            <Line
              p={p}
              label={t("goals")}
              value={`− ${formatINR(daily.goals)}`}
            />
          )}
          <View style={[styles.rule, { backgroundColor: p.border }]} />
          <Line
            p={p}
            label={t("everydayMoney")}
            value={formatINR(daily.pool)}
            strong
          />
          <Text style={{ color: p.muted, fontSize: fs(12.5) }}>
            ≈ {formatINR(daily.baseDaily)}
            {t("perDay")}
            {daily.cycleStart && daily.cycleEnd
              ? ` · ${shortDate(daily.cycleStart)} – ${shortDate(daily.cycleEnd)}`
              : ""}
          </Text>
          <History p={p} history={daily.history.slice(-14)} />
          {daily.history.length >= 2 && (
            <Text style={{ color: p.muted, fontSize: fs(12) }}>
              {t("last14")}
            </Text>
          )}
        </View>
      )}
      {setupOpen && (
        <SetupFlow
          p={p}
          token={token}
          onClose={() => setSetupOpen(false)}
          onDone={onChanged}
        />
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
const shortDate = (iso: string) =>
  `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

function Line({
  p,
  label,
  value,
  strong,
}: {
  p: Palette;
  label: string;
  value: string;
  strong?: boolean;
}) {
  const { fs } = useSettings();
  return (
    <View style={styles.line}>
      <Text
        style={{
          flex: 1,
          color: strong ? p.ink : p.ink2,
          fontSize: fs(14),
          fontWeight: strong ? "600" : "400",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: p.ink,
          fontSize: fs(strong ? 16 : 14),
          fontWeight: strong ? "700" : "500",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/** Columns of spend per day, with a tick at that day's budget. */
function History({
  p,
  history,
}: {
  p: Palette;
  history: DailyStatus["history"];
}) {
  if (history.length < 2) return null;
  const max = Math.max(1, ...history.map((h) => Math.max(h.budget, h.spent)));
  const H = 56;
  return (
    <View
      style={[styles.chart, { height: H, marginTop: 8 }]}
      accessibilityLabel="Spend per day against that day's budget, last 14 days"
    >
      {history.map((h) => {
        const over = h.spent > h.budget;
        return (
          <View key={h.date} style={styles.col}>
            <View
              style={{
                height: Math.max(2, (h.spent / max) * H),
                backgroundColor: over ? p.warn : p.accent,
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

export function PlanSheet({
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
  // Once the user types, server reloads must never overwrite their input.
  const edited = useRef(false);
  const edit = (set: (v: string) => void) => (v: string) => {
    edited.current = true;
    set(v);
  };

  const load = async () => {
    const res = await fetchPlan(token).catch(() => null);
    if (!res) {
      setError("Couldn't load your plan. Check your connection.");
    } else {
      setPlan(res.plan);
      setDaily(res.daily);
      setCommitments(res.commitments);
      setSuggestions(res.suggestions);
      if (!edited.current) {
        setIncome(
          res.plan?.monthly_income ? String(res.plan.monthly_income) : "",
        );
        setSavings(res.plan?.savings_goal ? String(res.plan.savings_goal) : "");
        setPayday(res.plan?.payday ? String(res.plan.payday) : "");
      }
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
    if (!ok) setError(t("saveFailed"));
    await load();
    onChanged();
    setBusy(false);
  };

  /** Read and check the three plan fields; null (with an error shown) when invalid. */
  const readFields = () => {
    const i = parseAmount(income);
    const sv = savings.trim() ? parseAmount(savings) : 0;
    const d = payday.trim() ? Number(payday.trim()) : null;
    if (!i || i <= 0) {
      setError(t("incomeNeeded"));
      return null;
    }
    if (sv === null || sv >= i) {
      setError(t("savingsInvalid"));
      return null;
    }
    if (d !== null && !(Number.isInteger(d) && d >= 1 && d <= 31)) {
      setError(t("paydayInvalid"));
      return null;
    }
    return { monthly_income: i, savings_goal: sv, payday: d };
  };

  const addOne = () => {
    const a = parseAmount(newAmount);
    if (!newName.trim() || !a) {
      setError(t("fixedNeeded"));
      return;
    }
    run(async () => {
      const ok = await addCommitment(token, {
        name: newName.trim(),
        amount: a,
      });
      if (ok) {
        setNewName("");
        setNewAmount("");
      }
      return ok;
    });
  };

  /**
   * The one save: plan fields, plus a fixed cost typed but not yet added.
   * Closing the sheet with changes runs this too, so nothing is silently lost.
   */
  const saveAll = async () => {
    if (busy) return;
    const fields = readFields();
    if (!fields) return;
    setBusy(true);
    setError(null);
    try {
      const pendingAmount = parseAmount(newAmount);
      if (newName.trim() && pendingAmount) {
        if (
          !(await addCommitment(token, {
            name: newName.trim(),
            amount: pendingAmount,
          }))
        )
          throw new Error("fixed");
      }
      if (!(await savePlan(token, fields))) throw new Error("plan");
      edited.current = false;
      onChanged();
      onClose();
    } catch {
      setError(t("saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (edited.current || (newName.trim() && newAmount.trim())) saveAll();
    else onClose();
  };

  const toggle = (
    key: "morning_brief" | "evening_report" | "live_updates",
    value: boolean,
  ) => run(() => savePlan(token, { [key]: value }));

  const inputBox = [
    styles.inputBox,
    { borderColor: p.grid, backgroundColor: p.page },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <KeyboardAware style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={close} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: p.surface, borderColor: p.border },
          ]}
        >
          <View style={[styles.grab, { backgroundColor: p.grid }]} />
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 30 }} />
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 14 }}
            >
              <Text
                style={{ fontSize: fs(18), fontWeight: "700", color: p.ink }}
              >
                {t("dailyBudget")}
              </Text>

              <Field p={p} label={t("monthlyIncome")}>
                <View style={inputBox}>
                  <Text style={[styles.rupee, { color: p.muted }]}>₹</Text>
                  <TextInput
                    style={[styles.input, { color: p.ink }]}
                    value={income}
                    onChangeText={edit(setIncome)}
                    keyboardType="numeric"
                    placeholder="1,00,000 or 1 lakh"
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
                    onChangeText={edit(setSavings)}
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
                    onChangeText={edit(setPayday)}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="30"
                    placeholderTextColor={p.muted}
                  />
                </View>
                <Text style={{ color: p.muted, fontSize: fs(12) }}>
                  {t("paydayHint")}
                </Text>
              </Field>

              <View style={{ gap: 8 }}>
                <Text
                  style={{ color: p.ink, fontWeight: "600", fontSize: fs(14) }}
                >
                  {t("fixedCosts")}
                </Text>
                <Text style={{ color: p.ink2, fontSize: fs(12.5) }}>
                  {t("fixedHint")}
                </Text>
                {commitments.map((c) => (
                  <View key={c.id} style={styles.spendRow}>
                    <Text style={{ color: p.ink, fontSize: fs(14), flex: 1 }}>
                      {c.name}
                    </Text>
                    <Text
                      style={{
                        color: p.ink,
                        fontSize: fs(14),
                        fontWeight: "600",
                      }}
                    >
                      {formatINR(c.amount)}
                    </Text>
                    <Pressable
                      onPress={() => run(() => removeCommitment(token, c.id))}
                      hitSlop={8}
                    >
                      <Text
                        style={{
                          color: RED,
                          fontSize: fs(13),
                          fontWeight: "600",
                        }}
                      >
                        ✕
                      </Text>
                    </Pressable>
                  </View>
                ))}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={[
                      ...inputBox,
                      styles.smallInput,
                      { flex: 1.4, color: p.ink },
                    ]}
                    value={newName}
                    onChangeText={edit(setNewName)}
                    placeholder={t("costName")}
                    placeholderTextColor={p.muted}
                  />
                  <TextInput
                    style={[
                      ...inputBox,
                      styles.smallInput,
                      { flex: 1, color: p.ink },
                    ]}
                    value={newAmount}
                    onChangeText={edit(setNewAmount)}
                    keyboardType="numeric"
                    placeholder="₹"
                    placeholderTextColor={p.muted}
                  />
                  <Pressable
                    style={[styles.addBtn, { borderColor: p.accent }]}
                    onPress={addOne}
                  >
                    <Text
                      style={{
                        color: p.accent,
                        fontWeight: "700",
                        fontSize: fs(13),
                      }}
                    >
                      {t("add")}
                    </Text>
                  </Pressable>
                </View>
                {suggestions.length > 0 && (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: p.muted, fontSize: fs(12) }}>
                      {t("suggestedFixed")}
                    </Text>
                    <View style={styles.chips}>
                      {suggestions.map((s) => (
                        <Pressable
                          key={s.name}
                          style={[
                            styles.chip,
                            { borderColor: p.border, backgroundColor: p.page },
                          ]}
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
                <Text
                  style={{ color: p.ink2, fontSize: fs(13), lineHeight: 19 }}
                >
                  {formatINR(daily.income)} − {formatINR(daily.fixed)} −{" "}
                  {formatINR(daily.savingsGoal)}
                  {daily.goals
                    ? ` − ${formatINR(daily.goals)} (${t("goals").toLowerCase()})`
                    : ""}{" "}
                  ={" "}
                  <Text style={{ color: p.ink, fontWeight: "700" }}>
                    {formatINR(daily.pool)}
                  </Text>{" "}
                  · ≈{formatINR(daily.baseDaily)}
                  {t("perDay")}
                </Text>
              )}

              {
                <View style={{ gap: 4 }}>
                  <ToggleRow
                    p={p}
                    label={t("morningMsg")}
                    value={plan?.morning_brief ?? true}
                    onChange={(v) => toggle("morning_brief", v)}
                  />
                  <ToggleRow
                    p={p}
                    label={t("eveningMsg")}
                    value={plan?.evening_report ?? true}
                    onChange={(v) => toggle("evening_report", v)}
                  />
                  <ToggleRow
                    p={p}
                    label={t("liveMsg")}
                    value={plan?.live_updates ?? true}
                    onChange={(v) => toggle("live_updates", v)}
                  />
                  <Text style={{ color: p.muted, fontSize: fs(12) }}>
                    {t("messagesVia")}
                  </Text>
                </View>
              }

              {error && (
                <Text style={{ color: RED, fontSize: fs(13) }}>{error}</Text>
              )}

              <Pressable
                style={[
                  styles.btn,
                  { backgroundColor: p.accent, opacity: busy ? 0.6 : 1 },
                ]}
                onPress={saveAll}
                disabled={busy}
                accessibilityRole="button"
              >
                {busy ? (
                  <ActivityIndicator color={p.onAccent} />
                ) : (
                  <Text
                    style={{
                      color: p.onAccent,
                      fontWeight: "700",
                      fontSize: fs(15),
                    }}
                  >
                    {t("savePlan")}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAware>
    </Modal>
  );
}

function Field({
  p,
  label,
  children,
}: {
  p: Palette;
  label: string;
  children: React.ReactNode;
}) {
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
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: p.accent }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: 12 },
  rule: { height: 1, marginVertical: 2 },
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  hero: { fontWeight: "800", letterSpacing: -0.5 },
  spendRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  footer: { flexDirection: "row", flexWrap: "wrap", columnGap: 24, rowGap: 10 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  col: { flex: 1, justifyContent: "flex-end", height: "100%" },
  tick: {
    position: "absolute",
    left: -1,
    right: -1,
    height: 2,
    borderRadius: 1,
    opacity: 0.6,
  },
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
    maxHeight: "88%",
  },
  grab: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  rupee: { fontSize: 18, fontWeight: "700" },
  input: { flex: 1, fontSize: 18, fontWeight: "700", paddingVertical: 11 },
  smallInput: { paddingVertical: 10, fontSize: 14 },
  addBtn: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  btn: { borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  btnGhost: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
});
