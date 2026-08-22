import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { deleteExpense, Expense, patchExpense } from "../lib/api";
import { formatINR, Palette, seriesColor } from "../lib/theme";
import { useSettings } from "../lib/i18n";

interface Props {
  expense: Expense | null; // null = closed
  onClose: () => void;
  token: string;
  categories: Array<{ name: string; color: string | null }>;
  today: string;
  p: Palette;
  dark: boolean;
  onChanged: () => void;
}

function yesterdayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

type DayPick = "keep" | "today" | "yesterday";

export default function EditExpenseSheet({
  expense,
  onClose,
  token,
  categories,
  today,
  p,
  dark,
  onChanged,
}: Props) {
  const { t, fs } = useSettings();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("");
  const [merchant, setMerchant] = useState("");
  const [day, setDay] = useState<DayPick>("keep");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (expense) {
      setAmount(String(expense.amount));
      setCategory(expense.category);
      setMerchant(expense.merchant ?? "");
      setDay("keep");
      setError(null);
    }
  }, [expense]);

  if (!expense) return null;

  const chips = categories.filter((c) => c.name !== "Uncategorized");
  const parsedAmount = parseFloat(amount.replace(/,/g, ""));
  const ready = Number.isFinite(parsedAmount) && parsedAmount > 0 && !!category;
  const isSplit = !!expense.split_id;

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const patch: Parameters<typeof patchExpense>[2] = {};
      if (parsedAmount !== Number(expense.amount)) patch.amount = parsedAmount;
      if (category !== expense.category) patch.category = category;
      if ((merchant.trim() || null) !== expense.merchant) patch.merchant = merchant.trim() || null;
      if (day !== "keep") patch.expense_date = day === "today" ? today : yesterdayOf(today);

      if (Object.keys(patch).length === 0) {
        onClose();
      } else {
        const result = await patchExpense(token, expense.id, patch);
        if (result === "unauthorized") {
          setError("Session expired — get a fresh /app code from the bot.");
        } else if (!result) {
          setError("Couldn't save the changes — try again.");
        } else {
          onChanged();
          onClose();
        }
      }
    } catch {
      setError("Couldn't reach the server — check your connection.");
    }
    setBusy(false);
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await deleteExpense(token, expense.id);
      if (ok) {
        onChanged();
        onClose();
      } else {
        setError("Couldn't delete that entry.");
      }
    } catch {
      setError("Couldn't reach the server — check your connection.");
    }
    setBusy(false);
  };

  const inputBg = { borderColor: p.grid, backgroundColor: p.page };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={[styles.grab, { backgroundColor: p.grid }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <Text style={{ fontSize: fs(18), fontWeight: "700", color: p.ink }}>
              {t("editExpense")}
            </Text>
            {isSplit && (
              <Text style={[styles.splitNote, { color: p.ink2, backgroundColor: p.accentSoft, fontSize: fs(12.5) }]}>
                🤝 {t("partOfSplit")}
              </Text>
            )}

            <View style={[styles.amountBox, inputBg]}>
              <Text style={{ fontSize: 24, fontWeight: "700", color: p.muted }}>₹</Text>
              <TextInput
                style={[styles.amountInput, { color: p.ink }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.chips}>
              {chips.map((c) => {
                const active = category === c.name;
                return (
                  <Pressable
                    key={c.name}
                    onPress={() => setCategory(c.name)}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? p.accent : p.border,
                        backgroundColor: active ? p.accentSoft : p.page,
                      },
                    ]}
                  >
                    <View style={[styles.dot, { backgroundColor: seriesColor(c.color, dark) }]} />
                    <Text
                      style={{
                        fontSize: fs(13),
                        color: active ? p.ink : p.ink2,
                        fontWeight: active ? "600" : "400",
                      }}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              style={[styles.merchantInput, inputBg, { color: p.ink, fontSize: fs(14) }]}
              placeholder={t("wherePlaceholder")}
              placeholderTextColor={p.muted}
              value={merchant}
              onChangeText={setMerchant}
            />

            <View style={styles.dayRow}>
              {(["keep", "today", "yesterday"] as DayPick[]).map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setDay(d)}
                  style={[
                    styles.dayBtn,
                    {
                      borderColor: day === d ? p.accent : p.border,
                      backgroundColor: day === d ? p.accentSoft : p.page,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: fs(13),
                      color: day === d ? p.ink : p.ink2,
                      fontWeight: day === d ? "600" : "400",
                    }}
                  >
                    {d === "keep"
                      ? `${t("keepDate")} (${expense.expense_date.slice(5)})`
                      : d === "today"
                        ? t("today")
                        : t("yesterday")}
                  </Text>
                </Pressable>
              ))}
            </View>

            {error && <Text style={[styles.error, { fontSize: fs(13) }]}>{error}</Text>}

            <View style={styles.actionRow}>
              <Pressable style={[styles.btnDanger]} onPress={remove} disabled={busy}>
                <Text style={{ color: "#d03b3b", fontWeight: "600", fontSize: fs(14) }}>
                  🗑️ {t("delete")}
                </Text>
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
                    {t("save")} {ready ? formatINR(parsedAmount) : ""}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  backdropTouch: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: "90%",
  },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  body: { gap: 13 },
  splitNote: { borderRadius: 10, padding: 8, textAlign: "center", overflow: "hidden" },
  amountBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, gap: 8 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: "700", paddingVertical: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  merchantInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  dayRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayBtn: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  btn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  btnDanger: { paddingVertical: 14, paddingHorizontal: 14 },
  error: { color: "#d03b3b", textAlign: "center" },
});
