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
import * as ImagePicker from "expo-image-picker";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import {
  addExpense,
  AddBody,
  AddResult,
  addIncome,
  deleteExpense,
  deleteIncome,
  LoggedExpense,
  uploadMedia,
} from "../lib/api";
import { formatINR, Palette, seriesColor } from "../lib/theme";
import { useSettings } from "../lib/i18n";

interface Props {
  visible: boolean;
  onClose: () => void;
  token: string;
  categories: Array<{ name: string; color: string | null }>;
  today: string; // YYYY-MM-DD from the API — server truth for IST
  hasFamily: boolean;
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
type Mode = "expense" | "income";

interface Success {
  kind: "expense" | "income";
  id: string;
  title: string;
  subtitle: string | null;
  nudge: boolean;
  alerts: string[];
  transcript?: string;
}

export default function AddExpenseSheet({
  visible,
  onClose,
  token,
  categories,
  today,
  hasFamily,
  p,
  dark,
  onLogged,
}: Props) {
  const { t, fs } = useSettings();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [mode, setMode] = useState<Mode>("expense");
  const [text, setText] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [merchant, setMerchant] = useState("");
  const [day, setDay] = useState<Day>("today");
  const [split, setSplit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);
  const [undone, setUndone] = useState(false);

  const chips = categories.filter((c) => c.name !== "Uncategorized");

  const resetForm = () => {
    setText("");
    setAmount("");
    setCategory(null);
    setMerchant("");
    setDay("today");
    setSplit(false);
    setError(null);
    setSuccess(null);
    setUndone(false);
    setRecording(false);
  };

  const close = () => {
    resetForm();
    setMode("expense");
    onClose();
  };

  const applyResult = (result: AddResult | "unauthorized", transcript?: string) => {
    if (result === "unauthorized") {
      setError("Session expired — log in again with a fresh /app code from the bot.");
      return;
    }
    if (result.status === "need_amount") {
      setError(
        result.question ??
          'I couldn\'t find an amount in that — include a number, like "250 groceries".',
      );
      return;
    }
    const e: LoggedExpense = result.expense;
    const splitNote = result.split
      ? ` · ${formatINR(result.split.perHead)} × ${result.split.count}`
      : "";
    setSuccess({
      kind: "expense",
      id: e.id,
      title: `${t("logged")} ${formatINR(result.split ? result.split.total : e.amount)} · ${e.category}${splitNote}`,
      subtitle: e.merchant,
      nudge: result.nudge,
      alerts: result.alerts ?? [],
      transcript: transcript ?? result.transcript,
    });
    onLogged();
  };

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    }
    setBusy(false);
  };

  const submitText = () =>
    run(async () => {
      if (!text.trim()) return;
      applyResult(await addExpense(token, { text: text.trim() }));
    });

  const parsedAmount = parseFloat(amount.replace(/,/g, ""));
  const amountOk = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const formReady = mode === "income" ? amountOk : amountOk && !!category;

  const submitForm = () =>
    run(async () => {
      if (!formReady) return;
      const expense_date = day === "today" ? today : yesterdayOf(today);
      if (mode === "income") {
        const result = await addIncome(token, {
          amount: parsedAmount,
          source: merchant.trim() || undefined,
          income_date: expense_date,
        });
        if (result === "unauthorized") {
          setError("Session expired — log in again with a fresh /app code from the bot.");
        } else if (!result) {
          setError("Couldn't save that — income tracking may not be enabled yet.");
        } else {
          setSuccess({
            kind: "income",
            id: result.income.id,
            title: `${t("logged")} ${formatINR(result.income.amount)} · ${t("income")}`,
            subtitle: result.income.source,
            nudge: false,
            alerts: [],
          });
          onLogged();
        }
        return;
      }
      const body: AddBody = {
        amount: parsedAmount,
        category: category!,
        merchant: merchant.trim() || undefined,
        expense_date,
        split: split || undefined,
      };
      applyResult(await addExpense(token, body));
    });

  const toggleRecord = () =>
    run(async () => {
      if (!recording) {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          setError("Microphone permission is needed for voice logging.");
          return;
        }
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        setRecording(true);
        return;
      }
      setRecording(false);
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        setError("Recording failed — try again.");
        return;
      }
      const result = await uploadMedia(token, "voice", {
        uri,
        name: "voice.m4a",
        type: "audio/m4a",
      });
      applyResult(result);
    });

  const pickReceipt = (fromCamera: boolean) =>
    run(async () => {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError("Camera permission is needed to snap receipts.");
          return;
        }
      }
      const picked = fromCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
      if (picked.canceled || picked.assets.length === 0) return;
      const asset = picked.assets[0];
      const result = await uploadMedia(token, "receipt", {
        uri: asset.uri,
        name: asset.fileName ?? "receipt.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
      applyResult(result);
    });

  const undo = () =>
    run(async () => {
      if (!success) return;
      const ok =
        success.kind === "income"
          ? await deleteIncome(token, success.id)
          : await deleteExpense(token, success.id);
      if (ok) {
        setUndone(true);
        onLogged();
      } else {
        setError("Couldn't undo — you can remove it from Telegram with /undo.");
      }
    });

  const inputBg = { borderColor: p.grid, backgroundColor: p.page };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdropTouch} onPress={close} />
        <View style={[styles.sheet, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={[styles.grab, { backgroundColor: p.grid }]} />

          {success ? (
            <View style={styles.done}>
              <Text style={{ fontSize: 40 }}>{undone ? "↩️" : "✅"}</Text>
              <Text style={{ fontSize: fs(18), fontWeight: "700", color: p.ink, textAlign: "center" }}>
                {undone ? t("removed") : success.title}
              </Text>
              {!undone && success.subtitle && (
                <Text style={{ fontSize: fs(14), color: p.ink2 }}>{success.subtitle}</Text>
              )}
              {!undone && success.transcript && (
                <Text style={{ fontSize: fs(13), color: p.muted, fontStyle: "italic" }}>
                  🎤 “{success.transcript}”
                </Text>
              )}
              {!undone && success.nudge && (
                <Text style={[styles.nudge, { color: p.ink2, backgroundColor: p.accentSoft, fontSize: fs(13) }]}>
                  🤔 Not fully sure about the category — tap the entry in Transactions to fix it.
                </Text>
              )}
              {!undone &&
                success.alerts.map((a) => (
                  <Text
                    key={a}
                    style={[styles.alert, { fontSize: fs(13) }]}
                  >
                    {a}
                  </Text>
                ))}
              {error && <Text style={[styles.error, { fontSize: fs(13) }]}>{error}</Text>}
              <View style={styles.doneRow}>
                {!undone && (
                  <Pressable style={[styles.btnGhost, { borderColor: p.border }]} onPress={undo} disabled={busy}>
                    {busy ? (
                      <ActivityIndicator color={p.accent} />
                    ) : (
                      <Text style={{ color: p.ink2, fontWeight: "600", fontSize: fs(14) }}>{t("undo")}</Text>
                    )}
                  </Pressable>
                )}
                <Pressable style={[styles.btnGhost, { borderColor: p.border }]} onPress={resetForm}>
                  <Text style={{ color: p.ink2, fontWeight: "600", fontSize: fs(14) }}>{t("addAnother")}</Text>
                </Pressable>
                <Pressable style={[styles.btn, { backgroundColor: p.accent }]} onPress={close}>
                  <Text style={[styles.btnText, { fontSize: fs(15) }]}>{t("done")}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              <View style={styles.headRow}>
                <Text style={{ fontSize: fs(18), fontWeight: "700", color: p.ink }}>
                  {mode === "income" ? t("addIncome") : t("addExpense")}
                </Text>
                <View style={[styles.modeSeg, { backgroundColor: p.page, borderColor: p.border }]}>
                  {(["expense", "income"] as Mode[]).map((m) => (
                    <Pressable
                      key={m}
                      style={[styles.modeBtn, mode === m && { backgroundColor: p.accent }]}
                      onPress={() => {
                        setMode(m);
                        setError(null);
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fs(12.5),
                          fontWeight: mode === m ? "600" : "400",
                          color: mode === m ? "#fff" : p.ink2,
                        }}
                      >
                        {m === "expense" ? t("expense") : t("income")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {mode === "expense" && (
                <>
                  <View style={[styles.smartBox, inputBg]}>
                    <TextInput
                      style={[styles.smartInput, { color: p.ink, fontSize: fs(14) }]}
                      placeholder={t("smartPlaceholder")}
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

                  <View style={styles.mediaRow}>
                    <Pressable
                      style={[
                        styles.mediaBtn,
                        recording
                          ? { backgroundColor: "#d03b3b", borderColor: "#d03b3b", flex: 2.2 }
                          : [inputBg, { borderColor: p.border }],
                      ]}
                      onPress={toggleRecord}
                      disabled={busy && !recording}
                    >
                      <Text style={{ fontSize: fs(13), color: recording ? "#fff" : p.ink2, fontWeight: "600" }}>
                        {recording ? `⏺ ${t("recording")}` : `🎤 ${t("holdToRecord")}`}
                      </Text>
                    </Pressable>
                    {!recording && (
                      <>
                        <Pressable
                          style={[styles.mediaBtn, inputBg, { borderColor: p.border }]}
                          onPress={() => pickReceipt(true)}
                          disabled={busy}
                        >
                          <Text style={{ fontSize: fs(13), color: p.ink2, fontWeight: "600" }}>
                            📷 {t("receipt")}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.mediaBtn, inputBg, { borderColor: p.border }]}
                          onPress={() => pickReceipt(false)}
                          disabled={busy}
                        >
                          <Text style={{ fontSize: fs(13), color: p.ink2, fontWeight: "600" }}>
                            🖼️ {t("gallery")}
                          </Text>
                        </Pressable>
                      </>
                    )}
                  </View>

                  <View style={styles.orRow}>
                    <View style={[styles.orLine, { backgroundColor: p.grid }]} />
                    <Text style={{ fontSize: fs(12), color: p.muted }}>{t("orFillIn")}</Text>
                    <View style={[styles.orLine, { backgroundColor: p.grid }]} />
                  </View>
                </>
              )}

              <View style={[styles.amountBox, inputBg]}>
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

              {mode === "expense" && (
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
              )}

              <TextInput
                style={[styles.merchantInput, inputBg, { color: p.ink, fontSize: fs(14) }]}
                placeholder={mode === "income" ? t("sourcePlaceholder") : t("wherePlaceholder")}
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
                        fontSize: fs(13),
                        color: day === d ? p.ink : p.ink2,
                        fontWeight: day === d ? "600" : "400",
                      }}
                    >
                      {d === "today" ? t("today") : t("yesterday")}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {mode === "expense" && hasFamily && (
                <Pressable style={styles.splitRow} onPress={() => setSplit(!split)}>
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: split ? p.accent : p.border, backgroundColor: split ? p.accent : "transparent" },
                    ]}
                  >
                    {split && <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>✓</Text>}
                  </View>
                  <Text style={{ fontSize: fs(13.5), color: p.ink2 }}>🤝 {t("splitWithFamily")}</Text>
                </Pressable>
              )}

              {error && <Text style={[styles.error, { fontSize: fs(13) }]}>{error}</Text>}

              <Pressable
                style={[styles.btn, { backgroundColor: p.accent, opacity: formReady && !busy ? 1 : 0.5 }]}
                onPress={submitForm}
                disabled={!formReady || busy}
              >
                {busy && !text.trim() && !recording ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.btnText, { fontSize: fs(15) }]}>
                    {formReady ? `${t("save")} ${formatINR(parsedAmount)}` : t("save")}
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
    maxHeight: "90%",
  },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  body: { gap: 13 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modeSeg: { flexDirection: "row", borderRadius: 999, borderWidth: 1, padding: 3, gap: 3 },
  modeBtn: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 999 },
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
  smartInput: { flex: 1, paddingVertical: 8 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  mediaRow: { flexDirection: "row", gap: 8 },
  mediaBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  orLine: { flex: 1, height: 1 },
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
  dayRow: { flexDirection: "row", gap: 8 },
  dayBtn: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 18 },
  splitRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  btn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  btnGhost: { borderWidth: 1, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignItems: "center" },
  done: { alignItems: "center", gap: 10, paddingVertical: 16 },
  doneRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  nudge: { borderRadius: 10, padding: 10, textAlign: "center" },
  alert: {
    color: "#a04d00",
    backgroundColor: "rgba(237,161,0,0.15)",
    borderRadius: 10,
    padding: 10,
    textAlign: "center",
    overflow: "hidden",
  },
  error: { color: "#d03b3b", textAlign: "center" },
});
