import { useState } from "react";
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
import { addExpense, AddBody, deleteExpense, LoggedExpense } from "../lib/api";
import { formatINR, Palette, seriesColor } from "../lib/theme";

interface Props {
  visible: boolean;
  onClose: () => void;
  token: string;
  categories: Array<{ name: string; color: string | null }>;
  today: string; // YYYY-MM-DD from the API — server truth for IST
  p: Palette;
  dark: boolean;
  onLogged: () => void; // refresh the dashboard data
}

function yesterdayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

type Day = "today" | "yesterday";

export default function AddExpenseSheet({
  visible,
  onClose,
  token,
  categories,
  today,
  p,
  dark,
  onLogged,
}: Props) {
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [merchant, setMerchant] = useState("");
  const [day, setDay] = useState<Day>("today");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logged, setLogged] = useState<{ expense: LoggedExpense; nudge: boolean } | null>(null);
  const [undone, setUndone] = useState(false);

  const chips = categories.filter((c) => c.name !== "Uncategorized");

  const resetForm = () => {
    setText("");
    setAmount("");
    setCategory(null);
    setMerchant("");
    setDay("today");
    setError(null);
    setLogged(null);
    setUndone(false);
  };

  const close = () => {
    resetForm();
    onClose();
  };

  const submit = async (body: AddBody) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await addExpense(token, body);
      if (result === "unauthorized") {
        setError("Session expired — log in again from the bot's /app code.");
      } else if (result.status === "need_amount") {
        setError(
          result.question ??
            "I couldn't find an amount in that — include a number, like \"250 groceries\".",
        );
      } else {
        setLogged({ expense: result.expense, nudge: result.nudge });
        onLogged();
      }
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    }
    setBusy(false);
  };

  const submitText = () => {
    if (!text.trim()) return;
    submit({ text: text.trim() });
  };

  const parsedAmount = parseFloat(amount.replace(/,/g, ""));
  const formReady = Number.isFinite(parsedAmount) && parsedAmount > 0 && !!category;

  const submitForm = () => {
    if (!formReady) return;
    submit({
      amount: parsedAmount,
      category: category!,
      merchant: merchant.trim() || undefined,
      expense_date: day === "today" ? today : yesterdayOf(today),
    });
  };

  const undo = async () => {
    if (!logged || busy) return;
    setBusy(true);
    const ok = await deleteExpense(token, logged.expense.id).catch(() => false);
    setBusy(false);
    if (ok) {
      setUndone(true);
      onLogged();
    } else {
      setError("Couldn't undo — you can remove it from Telegram with /undo.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdropTouch} onPress={close} />
        <View style={[styles.sheet, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={[styles.grab, { backgroundColor: p.grid }]} />

          {logged ? (
            <View style={styles.done}>
              <Text style={{ fontSize: 40 }}>{undone ? "↩️" : "✅"}</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: p.ink }}>
                {undone
                  ? "Removed"
                  : `Logged ${formatINR(logged.expense.amount)} · ${logged.expense.category}`}
              </Text>
              {!undone && logged.expense.merchant && (
                <Text style={{ fontSize: 14, color: p.ink2 }}>{logged.expense.merchant}</Text>
              )}
              {!undone && logged.nudge && (
                <Text style={[styles.nudge, { color: p.ink2, backgroundColor: p.accentSoft }]}>
                  🤔 Not fully sure about the category — long-term you can fix it via the bot's
                  /category command.
                </Text>
              )}
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.doneRow}>
                {!undone && (
                  <Pressable
                    style={[styles.btnGhost, { borderColor: p.border }]}
                    onPress={undo}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color={p.accent} />
                    ) : (
                      <Text style={{ color: p.ink2, fontWeight: "600" }}>Undo</Text>
                    )}
                  </Pressable>
                )}
                <Pressable style={[styles.btnGhost, { borderColor: p.border }]} onPress={resetForm}>
                  <Text style={{ color: p.ink2, fontWeight: "600" }}>Add another</Text>
                </Pressable>
                <Pressable style={[styles.btn, { backgroundColor: p.accent }]} onPress={close}>
                  <Text style={styles.btnText}>Done</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: p.ink }}>Add expense</Text>

              <View style={[styles.smartBox, { borderColor: p.grid, backgroundColor: p.page }]}>
                <TextInput
                  style={[styles.smartInput, { color: p.ink }]}
                  placeholder='Type it like a text — "250 groceries at More"'
                  placeholderTextColor={p.muted}
                  value={text}
                  onChangeText={setText}
                  onSubmitEditing={submitText}
                  returnKeyType="send"
                />
                <Pressable
                  style={[styles.sendBtn, { backgroundColor: text.trim() ? p.accent : p.grid }]}
                  onPress={submitText}
                  disabled={!text.trim() || busy}
                >
                  {busy && text.trim() ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>↑</Text>
                  )}
                </Pressable>
              </View>

              <View style={styles.orRow}>
                <View style={[styles.orLine, { backgroundColor: p.grid }]} />
                <Text style={{ fontSize: 12, color: p.muted }}>or fill it in</Text>
                <View style={[styles.orLine, { backgroundColor: p.grid }]} />
              </View>

              <View style={[styles.amountBox, { borderColor: p.grid, backgroundColor: p.page }]}>
                <Text style={{ fontSize: 24, fontWeight: "700", color: p.muted }}>₹</Text>
                <TextInput
                  style={[styles.amountInput, { color: p.ink }]}
                  placeholder="0"
                  placeholderTextColor={p.muted}
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
                      onPress={() => setCategory(active ? null : c.name)}
                      style={[
                        styles.chip,
                        {
                          borderColor: active ? p.accent : p.border,
                          backgroundColor: active ? p.accentSoft : p.page,
                        },
                      ]}
                    >
                      <View
                        style={[styles.dot, { backgroundColor: seriesColor(c.color, dark) }]}
                      />
                      <Text
                        style={{
                          fontSize: 13,
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
                style={[styles.merchantInput, { borderColor: p.grid, color: p.ink, backgroundColor: p.page }]}
                placeholder="Where / what for? (optional)"
                placeholderTextColor={p.muted}
                value={merchant}
                onChangeText={setMerchant}
              />

              <View style={styles.dayRow}>
                {(["today", "yesterday"] as Day[]).map((d) => (
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
                        fontSize: 13,
                        color: day === d ? p.ink : p.ink2,
                        fontWeight: day === d ? "600" : "400",
                      }}
                    >
                      {d === "today" ? "Today" : "Yesterday"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                style={[
                  styles.btn,
                  { backgroundColor: p.accent, opacity: formReady && !busy ? 1 : 0.5 },
                ]}
                onPress={submitForm}
                disabled={!formReady || busy}
              >
                {busy && !text.trim() ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>
                    {formReady ? `Save ${formatINR(parsedAmount)}` : "Save"}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          )}
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
    maxHeight: "88%",
  },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  body: { gap: 14 },
  smartBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  smartInput: { flex: 1, fontSize: 14, paddingVertical: 8 },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  orLine: { flex: 1, height: 1 },
  amountBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
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
  merchantInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  dayRow: { flexDirection: "row", gap: 8 },
  dayBtn: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 18 },
  btn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnGhost: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  done: { alignItems: "center", gap: 10, paddingVertical: 16 },
  doneRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  nudge: { fontSize: 13, borderRadius: 10, padding: 10, textAlign: "center" },
  error: { color: "#d03b3b", fontSize: 13, textAlign: "center" },
});
