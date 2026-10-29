import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  addCommitment,
  Commitment,
  fetchPlan,
  removeCommitment,
  savePlan,
} from "../lib/api";
import { parseAmount } from "../lib/amount";
import { useSettings } from "../lib/i18n";
import { formatINR, Palette } from "../lib/theme";
import { Text, TextInput } from "./Text";
import {
  KeyboardAware,
  HeroBackground,
  Icon,
  IconName,
  PressableScale,
  PrimaryButton,
} from "./ui";

/**
 * Guided setup (v19): three full screens — income and salary day, fixed
 * costs, savings — with the daily number previewed live. Everything is saved
 * once, at the end, so nothing typed can be lost between screens.
 */

const PRESETS: Array<{
  key: string;
  label: string;
  icon: IconName;
  category: string | null;
}> = [
  { key: "rent", label: "Rent", icon: "home", category: "Utilities & bills" },
  {
    key: "emi",
    label: "Loan EMI",
    icon: "credit-card",
    category: "Loans & EMI",
  },
  { key: "sip", label: "SIP", icon: "trending-up", category: "Investments" },
  {
    key: "bills",
    label: "Bills and recharges",
    icon: "zap",
    category: "Utilities & bills",
  },
  {
    key: "subs",
    label: "Subscriptions",
    icon: "tv",
    category: "Entertainment",
  },
  {
    key: "insurance",
    label: "Insurance",
    icon: "shield",
    category: "Utilities & bills",
  },
];

const INCOME_PICKS = [
  { label: "50k", value: 50_000 },
  { label: "75k", value: 75_000 },
  { label: "1 lakh", value: 100_000 },
  { label: "1.5 lakh", value: 150_000 },
  { label: "2 lakh", value: 200_000 },
];

const PAYDAYS: Array<{ label: string; value: number | null }> = [
  { label: "1st", value: 1 },
  { label: "7th", value: 7 },
  { label: "25th", value: 25 },
  { label: "30th", value: 30 },
  { label: "Last day", value: 31 },
];

interface Row {
  key: string;
  label: string;
  icon: IconName;
  category: string | null;
  amount: string;
  /** The saved commitment this row came from, if any. */
  existing: Commitment | null;
}

/** Days in the budget month containing today, salary day to salary day (mirrors the server). */
function cycleDays(payday: number | null): number {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const dim = (yy: number, mm: number) => new Date(yy, mm + 1, 0).getDate();
  if (!payday) return dim(y, m);
  const payIn = (yy: number, mm: number) =>
    new Date(yy, mm, Math.min(payday, dim(yy, mm)));
  const thisPay = payIn(y, m);
  const start = now >= thisPay ? thisPay : payIn(y, m - 1);
  const next = payIn(start.getFullYear(), start.getMonth() + 1);
  return Math.round((next.getTime() - start.getTime()) / 86_400_000);
}

export default function SetupFlow({
  p,
  token,
  onClose,
  onDone,
}: {
  p: Palette;
  token: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, fs } = useSettings();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [income, setIncome] = useState("");
  const [payday, setPayday] = useState<number | null>(null);
  const [otherDay, setOtherDay] = useState("");
  const [rows, setRows] = useState<Row[]>(
    PRESETS.map((x) => ({ ...x, amount: "", existing: null })),
  );
  const [open, setOpen] = useState<string | null>(null);
  const [savings, setSavings] = useState(0);
  const [extraName, setExtraName] = useState("");
  const [extraAmount, setExtraAmount] = useState("");

  // Pre-fill from whatever is already saved — a returning user edits, not restarts.
  useEffect(() => {
    (async () => {
      const res = await fetchPlan(token).catch(() => null);
      if (res) {
        if (res.plan?.monthly_income)
          setIncome(String(res.plan.monthly_income));
        if (res.plan?.payday) setPayday(res.plan.payday);
        if (res.plan?.savings_goal) setSavings(res.plan.savings_goal);
        const taken = new Set<string>();
        const matched = PRESETS.map((preset) => {
          const hit = res.commitments.find(
            (c) =>
              !taken.has(c.id) &&
              c.name.trim().toLowerCase() === preset.label.toLowerCase(),
          );
          if (hit) taken.add(hit.id);
          return {
            ...preset,
            amount: hit ? String(hit.amount) : "",
            existing: hit ?? null,
          };
        });
        const others = res.commitments
          .filter((c) => !taken.has(c.id))
          .map((c) => ({
            key: c.id,
            label: c.name,
            icon: "circle" as IconName,
            category: c.category,
            amount: String(c.amount),
            existing: c,
          }));
        setRows([...matched, ...others]);
      }
      setLoading(false);
    })();
  }, [token]);

  const incomeValue = parseAmount(income) ?? 0;
  const fixedTotal =
    rows.reduce((s, r) => s + (parseAmount(r.amount) ?? 0), 0) +
    (parseAmount(extraAmount) ?? 0);
  const maxSavings = Math.max(0, incomeValue - fixedTotal);
  const savingsClamped = Math.min(savings, maxSavings);
  const effectivePayday = payday === -1 ? Number(otherDay) || null : payday;
  const days = cycleDays(effectivePayday);
  const pool = Math.max(0, incomeValue - fixedTotal - savingsClamped);
  const perDay = days > 0 ? Math.round(pool / days) : 0;

  const canNext =
    step === 0
      ? incomeValue > 0 &&
        (payday !== -1 || (Number(otherDay) >= 1 && Number(otherDay) <= 31))
      : step === 1
        ? fixedTotal < incomeValue
        : pool > 0;

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const r of rows) {
        const amount = parseAmount(r.amount) ?? 0;
        if (amount > 0 && (!r.existing || r.existing.amount !== amount)) {
          if (
            !(await addCommitment(token, {
              name: r.label,
              amount,
              category: r.category,
            }))
          )
            throw new Error();
        } else if (amount === 0 && r.existing) {
          if (!(await removeCommitment(token, r.existing.id)))
            throw new Error();
        }
      }
      const extra = parseAmount(extraAmount);
      if (extraName.trim() && extra) {
        if (
          !(await addCommitment(token, {
            name: extraName.trim(),
            amount: extra,
          }))
        )
          throw new Error();
      }
      const ok = await savePlan(token, {
        monthly_income: incomeValue,
        savings_goal: savingsClamped,
        payday: effectivePayday,
      });
      if (!ok) throw new Error();
      onDone();
      onClose();
    } catch {
      setError(t("saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const next = () => (step < 2 ? setStep(step + 1) : finish());
  const back = () => (step > 0 ? setStep(step - 1) : onClose());

  const titles = [
    t("setupIncomeTitle"),
    t("setupFixedTitle"),
    t("setupSaveTitle"),
  ];
  const subtitles = [
    t("setupIncomeHint"),
    t("setupFixedHint"),
    t("setupSaveHint"),
  ];

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={back}
      statusBarTranslucent
    >
      <KeyboardAware style={{ flex: 1, backgroundColor: p.surface }}>
        <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
          <Pressable
            onPress={back}
            style={[styles.round, { borderColor: p.border }]}
            accessibilityRole="button"
            accessibilityLabel={step > 0 ? t("back") : t("close")}
          >
            <Icon
              name={step > 0 ? "chevron-left" : "x"}
              size={20}
              color={p.ink}
            />
          </Pressable>
          <View style={styles.progress}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.seg,
                  { backgroundColor: i <= step ? p.accent : p.grid },
                ]}
              />
            ))}
          </View>
          <Text style={{ color: p.muted, fontSize: fs(13), fontWeight: "600" }}>
            {step + 1} / 3
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={p.accent} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.title, { color: p.ink, fontSize: fs(28) }]}>
              {titles[step]}
            </Text>
            <Text
              style={{ color: p.ink2, fontSize: fs(15), lineHeight: fs(22) }}
            >
              {subtitles[step]}
            </Text>

            {step === 0 && (
              <View style={{ gap: 14, marginTop: 24 }}>
                <Text
                  style={[styles.label, { color: p.muted, fontSize: fs(13) }]}
                >
                  {t("monthlyIncome")}
                </Text>
                <View
                  style={[styles.bigField, { borderBottomColor: p.accent }]}
                >
                  <Text
                    style={{
                      fontSize: fs(38),
                      fontWeight: "700",
                      color: p.muted,
                    }}
                  >
                    ₹
                  </Text>
                  <TextInput
                    value={income}
                    onChangeText={setIncome}
                    onBlur={() => {
                      const v = parseAmount(income);
                      if (v) setIncome(formatINR(v).replace("₹", ""));
                    }}
                    keyboardType="numeric"
                    placeholder="1,00,000"
                    placeholderTextColor={p.grid}
                    style={{
                      flex: 1,
                      fontSize: fs(42),
                      fontWeight: "800",
                      color: p.ink,
                      paddingVertical: 4,
                    }}
                    accessibilityLabel={t("monthlyIncome")}
                  />
                </View>
                <View style={styles.chips}>
                  {INCOME_PICKS.map((c) => (
                    <Chip
                      key={c.label}
                      p={p}
                      label={c.label}
                      active={incomeValue === c.value}
                      onPress={() =>
                        setIncome(formatINR(c.value).replace("₹", ""))
                      }
                    />
                  ))}
                </View>

                <Text
                  style={[
                    styles.label,
                    { color: p.muted, fontSize: fs(13), marginTop: 14 },
                  ]}
                >
                  {t("salaryArrives")}
                </Text>
                <View style={styles.grid}>
                  {[...PAYDAYS, { label: t("other"), value: -1 }].map((d) => (
                    <PressableScale
                      key={d.label}
                      onPress={() => setPayday(d.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: payday === d.value }}
                      style={[
                        styles.dayBtn,
                        payday === d.value
                          ? {
                              borderColor: p.accent,
                              backgroundColor: p.accentSoft,
                              borderWidth: 1.5,
                            }
                          : { borderColor: p.border },
                      ]}
                    >
                      <Text
                        style={{
                          color: payday === d.value ? p.accent : p.ink,
                          fontWeight: payday === d.value ? "700" : "600",
                          fontSize: fs(15),
                        }}
                      >
                        {d.label}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
                {payday === -1 && (
                  <TextInput
                    value={otherDay}
                    onChangeText={setOtherDay}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="1 to 31"
                    placeholderTextColor={p.muted}
                    style={[
                      styles.small,
                      { borderColor: p.border, color: p.ink, fontSize: fs(16) },
                    ]}
                  />
                )}
                <Text style={{ color: p.muted, fontSize: fs(13) }}>
                  {t("paydayHint")}
                </Text>
              </View>
            )}

            {step === 1 && (
              <View style={{ gap: 10, marginTop: 22 }}>
                {rows.map((r) => {
                  const amount = parseAmount(r.amount) ?? 0;
                  const isOpen = open === r.key;
                  const on = amount > 0;
                  return (
                    <View
                      key={r.key}
                      style={[
                        styles.tile,
                        on || isOpen
                          ? {
                              borderColor: p.accent,
                              backgroundColor: p.accentSoft,
                              borderWidth: 1.5,
                            }
                          : { borderColor: p.border },
                      ]}
                    >
                      <Pressable
                        style={styles.tileHead}
                        onPress={() => setOpen(isOpen ? null : r.key)}
                        accessibilityRole="button"
                      >
                        <View
                          style={[
                            styles.tileIcon,
                            { backgroundColor: on ? p.surface : p.page },
                          ]}
                        >
                          <Icon
                            name={r.icon}
                            size={19}
                            color={on ? p.accent : p.ink2}
                          />
                        </View>
                        <Text
                          style={{
                            flex: 1,
                            color: p.ink,
                            fontSize: fs(15),
                            fontWeight: "600",
                          }}
                        >
                          {r.label}
                        </Text>
                        <Text
                          style={{
                            color: on ? p.ink : p.accent,
                            fontSize: fs(on ? 16 : 14),
                            fontWeight: "700",
                          }}
                        >
                          {on ? formatINR(amount) : `+ ${t("add")}`}
                        </Text>
                      </Pressable>
                      {isOpen && (
                        <TextInput
                          autoFocus
                          value={r.amount}
                          onChangeText={(v) =>
                            setRows((rs) =>
                              rs.map((x) =>
                                x.key === r.key ? { ...x, amount: v } : x,
                              ),
                            )
                          }
                          onSubmitEditing={() => setOpen(null)}
                          keyboardType="numeric"
                          placeholder={t("amountPerMonth")}
                          placeholderTextColor={p.muted}
                          style={[
                            styles.small,
                            {
                              borderColor: p.border,
                              backgroundColor: p.surface,
                              color: p.ink,
                              fontSize: fs(16),
                            },
                          ]}
                        />
                      )}
                    </View>
                  );
                })}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    value={extraName}
                    onChangeText={setExtraName}
                    placeholder={t("somethingElse")}
                    placeholderTextColor={p.muted}
                    style={[
                      styles.small,
                      {
                        flex: 1.4,
                        borderColor: p.border,
                        color: p.ink,
                        fontSize: fs(15),
                      },
                    ]}
                  />
                  <TextInput
                    value={extraAmount}
                    onChangeText={setExtraAmount}
                    keyboardType="numeric"
                    placeholder="₹"
                    placeholderTextColor={p.muted}
                    style={[
                      styles.small,
                      {
                        flex: 1,
                        borderColor: p.border,
                        color: p.ink,
                        fontSize: fs(15),
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={{ gap: 14, marginTop: 24 }}>
                <View style={styles.saveHead}>
                  <Text
                    style={{
                      color: p.ink,
                      fontSize: fs(34),
                      fontWeight: "800",
                    }}
                  >
                    {formatINR(savingsClamped)}
                  </Text>
                  <Text
                    style={{
                      color: p.accent,
                      fontSize: fs(14),
                      fontWeight: "700",
                    }}
                  >
                    {incomeValue > 0
                      ? Math.round((savingsClamped / incomeValue) * 100)
                      : 0}
                    % {t("ofIncome")}
                  </Text>
                </View>
                <Slider
                  p={p}
                  value={savingsClamped}
                  max={maxSavings}
                  step={500}
                  onChange={setSavings}
                />
                <View style={styles.chips}>
                  {[10, 20, 30].map((pct) => {
                    const v = Math.min(
                      maxSavings,
                      Math.round((incomeValue * pct) / 100 / 500) * 500,
                    );
                    return (
                      <Chip
                        key={pct}
                        p={p}
                        label={`${pct}%`}
                        active={savingsClamped === v}
                        onPress={() => setSavings(v)}
                      />
                    );
                  })}
                </View>

                <View style={[styles.preview, { overflow: "hidden" }]}>
                  <HeroBackground p={p} />
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.82)",
                      fontSize: fs(13),
                    }}
                  >
                    {t("thatLeaves")}
                  </Text>
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: fs(40),
                      fontWeight: "800",
                    }}
                  >
                    {formatINR(perDay)}
                    <Text
                      style={{
                        fontSize: fs(18),
                        fontWeight: "600",
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      {" "}
                      {t("aDay")}
                    </Text>
                  </Text>
                  <View style={{ gap: 7, marginTop: 8 }}>
                    <Line
                      label={t("monthlyIncome")}
                      value={formatINR(incomeValue)}
                      fs={fs}
                    />
                    <Line
                      label={t("fixedCosts")}
                      value={`− ${formatINR(fixedTotal)}`}
                      fs={fs}
                    />
                    <Line
                      label={t("savingsGoal")}
                      value={`− ${formatINR(savingsClamped)}`}
                      fs={fs}
                    />
                    <View
                      style={{
                        height: 1,
                        backgroundColor: "rgba(255,255,255,0.22)",
                      }}
                    />
                    <Line
                      label={`${t("everydayMoney")} · ${days} ${t("daysWord")}`}
                      value={formatINR(pool)}
                      fs={fs}
                      strong
                    />
                  </View>
                </View>
              </View>
            )}

            {error && (
              <Text
                style={{ color: p.danger, fontSize: fs(14), marginTop: 12 }}
              >
                {error}
              </Text>
            )}
          </ScrollView>
        )}

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {step === 1 && (
            <View style={styles.totalRow}>
              <Text style={{ color: p.ink2, fontSize: fs(14) }}>
                {t("fixedEachMonth")}
              </Text>
              <Text
                style={{ color: p.ink, fontSize: fs(18), fontWeight: "800" }}
              >
                {formatINR(fixedTotal)}
              </Text>
            </View>
          )}
          <PrimaryButton
            p={p}
            label={step < 2 ? t("continue") : t("startBudget")}
            onPress={next}
            disabled={!canNext || loading}
            busy={busy}
          />
        </View>
      </KeyboardAware>
    </Modal>
  );
}

function Chip({
  p,
  label,
  active,
  onPress,
}: {
  p: Palette;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { fs } = useSettings();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        active
          ? {
              borderColor: p.accent,
              backgroundColor: p.accentSoft,
              borderWidth: 1.5,
            }
          : { borderColor: p.border },
      ]}
    >
      <Text
        style={{
          color: active ? p.accent : p.ink,
          fontSize: fs(14),
          fontWeight: active ? "700" : "600",
        }}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

function Line({
  label,
  value,
  fs,
  strong,
}: {
  label: string;
  value: string;
  fs: (n: number) => number;
  strong?: boolean;
}) {
  return (
    <View
      style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}
    >
      <Text
        style={{
          color: strong ? "#fff" : "rgba(255,255,255,0.8)",
          fontSize: fs(14),
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: "#fff",
          fontSize: fs(14),
          fontWeight: strong ? "800" : "600",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/** A drag slider built on PanResponder (no native dependency, so it can ship over the air). */
function Slider({
  p,
  value,
  max,
  step,
  onChange,
}: {
  p: Palette;
  value: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const [width, setWidth] = useState(1);
  const widthRef = useRef(1);
  const maxRef = useRef(max);
  maxRef.current = max;
  const fraction = max > 0 ? Math.min(1, value / max) : 0;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => set(e.nativeEvent.locationX),
        onPanResponderMove: (e) => set(e.nativeEvent.locationX),
      }),
    [],
  );
  function set(x: number) {
    const f = Math.max(0, Math.min(1, x / widthRef.current));
    onChange(Math.round((f * maxRef.current) / step) * step);
  }

  return (
    <View
      {...responder.panHandlers}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        setWidth(e.nativeEvent.layout.width);
      }}
      style={{ height: 36, justifyContent: "center" }}
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 0, max, now: value }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) =>
        onChange(
          Math.max(
            0,
            Math.min(
              max,
              value +
                (e.nativeEvent.actionName === "increment"
                  ? step * 4
                  : -step * 4),
            ),
          ),
        )
      }
    >
      <View
        style={{ height: 6, borderRadius: 3, backgroundColor: p.grid }}
        pointerEvents="none"
      >
        <View
          style={{
            height: 6,
            borderRadius: 3,
            width: `${fraction * 100}%`,
            backgroundColor: p.accent,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            left: Math.max(0, fraction * width - 14),
            borderColor: p.accent,
            backgroundColor: p.surface,
            shadowColor: "#000",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  progress: { flex: 1, flexDirection: "row", gap: 6 },
  seg: { flex: 1, height: 5, borderRadius: 3 },
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  title: {
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 8,
    lineHeight: 34,
  },
  label: { fontWeight: "600" },
  bigField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderBottomWidth: 2,
    paddingBottom: 6,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 15,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayBtn: {
    width: "31.5%",
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  small: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  tile: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
  tileHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 40,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  preview: { borderRadius: 22, padding: 20, gap: 2, marginTop: 8 },
  footer: { paddingHorizontal: 24, paddingTop: 10, gap: 10 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 2,
  },
  thumb: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
