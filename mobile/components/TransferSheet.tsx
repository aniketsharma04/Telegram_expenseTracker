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
import { Account, createTransfer } from "../lib/api";
import { formatINR, Palette } from "../lib/theme";
import { useSettings } from "../lib/i18n";

/**
 * Record money moving between two of your own pockets — a wallet top-up, an
 * ATM withdrawal, a card bill payment. None of it is spending, and saying so
 * explicitly is what keeps the month's totals honest.
 */

interface Props {
  visible: boolean;
  accounts: Account[];
  onClose: () => void;
  onDone: () => void;
  token: string;
  today: string;
  p: Palette;
}

export default function TransferSheet({
  visible,
  accounts,
  onClose,
  onDone,
  token,
  today,
  p,
}: Props) {
  const { t, fs } = useSettings();
  const live = accounts.filter((a) => !a.archived);

  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setAmount("");
    setError(null);
    setFrom(
      live.find((a) => a.is_default && a.kind !== "credit_card")?.id ??
        live[0]?.id ??
        null,
    );
    setTo(null);
    // `live` is derived from props each render; keying off `visible` is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const parsed = parseFloat(amount.replace(/,/g, ""));
  const ready =
    Number.isFinite(parsed) && parsed > 0 && !!from && !!to && from !== to;
  const inputBg = { backgroundColor: p.page, borderColor: p.border };
  const target = live.find((a) => a.id === to);
  const isCardPayment = target?.kind === "credit_card";

  async function save() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createTransfer(token, {
        from_account_id: from,
        to_account_id: to,
        amount: parsed,
        transfer_date: today,
        kind: isCardPayment ? "card_payment" : "transfer",
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const picker = (
    label: string,
    selected: string | null,
    onPick: (id: string) => void,
    exclude: string | null,
  ) => (
    <View style={{ gap: 8 }}>
      <Text style={{ color: p.ink2, fontSize: fs(12.5) }}>{label}</Text>
      <View style={styles.chips}>
        {live
          .filter((a) => a.id !== exclude)
          .map((a) => {
            const active = selected === a.id;
            return (
              <Pressable
                key={a.id}
                onPress={() => onPick(a.id)}
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
                  {a.name}
                </Text>
              </Pressable>
            );
          })}
      </View>
    </View>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: p.surface, borderColor: p.border },
          ]}
        >
          <View style={[styles.grab, { backgroundColor: p.grid }]} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
          >
            <Text style={{ fontSize: fs(18), fontWeight: "700", color: p.ink }}>
              {t("moveMoney")}
            </Text>
            <Text
              style={{ color: p.ink2, fontSize: fs(12.5), lineHeight: fs(18) }}
            >
              {t("transferNote")}
            </Text>

            <View style={[styles.amountBox, inputBg]}>
              <Text style={{ fontSize: 24, fontWeight: "700", color: p.muted }}>
                ₹
              </Text>
              <TextInput
                style={[styles.amountInput, { color: p.ink }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={p.muted}
                autoFocus
              />
            </View>

            {picker(t("fromAccount"), from, setFrom, to)}
            {picker(t("toAccount"), to, setTo, from)}

            {isCardPayment && (
              <Text
                style={[
                  styles.note,
                  {
                    color: p.ink2,
                    backgroundColor: p.accentSoft,
                    fontSize: fs(12.5),
                  },
                ]}
              >
                {t("cardPayment")}
              </Text>
            )}

            {error && (
              <Text style={[styles.error, { fontSize: fs(13) }]}>{error}</Text>
            )}

            <Pressable
              style={[
                styles.btn,
                {
                  backgroundColor: p.accent,
                  opacity: ready && !busy ? 1 : 0.5,
                },
              ]}
              onPress={save}
              disabled={!ready || busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{ color: "#fff", fontWeight: "700", fontSize: fs(15) }}
                >
                  {t("recordTransfer")} {ready ? formatINR(parsed) : ""}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
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
  grab: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  body: { gap: 13 },
  amountBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 26,
    fontWeight: "700",
    paddingVertical: 12,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  note: {
    borderRadius: 10,
    padding: 9,
    textAlign: "center",
    overflow: "hidden",
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  error: { color: "#b91c1c", textAlign: "center" },
});
