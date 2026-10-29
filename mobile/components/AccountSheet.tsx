import { useEffect, useState } from "react";
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
  Account,
  AccountKind,
  archiveAccount,
  createAccount,
  updateAccount,
} from "../lib/api";
import { Palette } from "../lib/theme";
import { useSettings } from "../lib/i18n";
import { KeyboardAware } from "./ui";

/**
 * Add or edit one account. "Balance today" is the opening balance — the app
 * counts forward from it, so getting it right once makes every later number
 * right.
 */

interface Props {
  /** null = closed; a partial object = new account; a full one = editing. */
  account: Account | "new" | null;
  onClose: () => void;
  onChanged: () => void;
  token: string;
  p: Palette;
}

const KINDS: AccountKind[] = ["bank", "cash", "wallet", "credit_card"];

export default function AccountSheet({
  account,
  onClose,
  onChanged,
  token,
  p,
}: Props) {
  const { t, fs } = useSettings();
  const editing = account !== "new" && account !== null ? account : null;

  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("bank");
  const [identifier, setIdentifier] = useState("");
  const [balance, setBalance] = useState("");
  const [limit, setLimit] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;
    setError(null);
    if (editing) {
      setName(editing.name);
      setKind(editing.kind);
      setIdentifier(editing.identifier ?? "");
      setBalance(String(editing.opening_balance ?? 0));
      setLimit(
        editing.credit_limit != null ? String(editing.credit_limit) : "",
      );
      setIsDefault(editing.is_default);
    } else {
      setName("");
      setKind("bank");
      setIdentifier("");
      setBalance("");
      setLimit("");
      setIsDefault(false);
    }
  }, [account, editing]);

  if (!account) return null;

  const kindLabel: Record<AccountKind, string> = {
    bank: t("bank"),
    cash: t("cash"),
    wallet: t("wallet"),
    credit_card: t("creditCard"),
  };

  const openingBalance = parseFloat(balance.replace(/,/g, "")) || 0;
  const creditLimit = limit.trim() ? parseFloat(limit.replace(/,/g, "")) : null;
  const ready = name.trim().length > 0;
  const inputBg = { backgroundColor: p.page, borderColor: p.border };

  async function save() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        kind,
        identifier: identifier.trim() || null,
        // A card's "balance today" is what you owe, held as a negative.
        opening_balance:
          kind === "credit_card" ? -Math.abs(openingBalance) : openingBalance,
        credit_limit: Number.isFinite(creditLimit as number)
          ? creditLimit
          : null,
        is_default: isDefault,
      };
      if (editing) await updateAccount(token, editing.id, body);
      else await createAccount(token, body);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!editing || busy) return;
    setBusy(true);
    try {
      await archiveAccount(token, editing.id);
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAware style={styles.backdrop}>
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
              {editing ? t("editAccount") : t("addAccount")}
            </Text>

            <View style={styles.chips}>
              {KINDS.map((k) => {
                const active = kind === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKind(k)}
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
                      {kindLabel[k]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              style={[
                styles.input,
                inputBg,
                { color: p.ink, fontSize: fs(14) },
              ]}
              placeholder={t("accountNamePlaceholder")}
              placeholderTextColor={p.muted}
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={[
                styles.input,
                inputBg,
                { color: p.ink, fontSize: fs(14) },
              ]}
              placeholder={t("lastDigits")}
              placeholderTextColor={p.muted}
              value={identifier}
              onChangeText={setIdentifier}
              maxLength={30}
            />

            <Text style={{ color: p.ink2, fontSize: fs(12.5) }}>
              {kind === "credit_card" ? t("outstanding") : t("openingBalance")}
            </Text>
            <View style={[styles.amountBox, inputBg]}>
              <Text style={{ fontSize: 22, fontWeight: "700", color: p.muted }}>
                ₹
              </Text>
              <TextInput
                style={[styles.amountInput, { color: p.ink }]}
                value={balance}
                onChangeText={setBalance}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={p.muted}
              />
            </View>

            {kind === "credit_card" && (
              <TextInput
                style={[
                  styles.input,
                  inputBg,
                  { color: p.ink, fontSize: fs(14) },
                ]}
                placeholder={t("creditLimit")}
                placeholderTextColor={p.muted}
                value={limit}
                onChangeText={setLimit}
                keyboardType="numeric"
              />
            )}

            <View style={styles.switchRow}>
              <Text style={{ color: p.ink2, fontSize: fs(13.5), flex: 1 }}>
                {t("makeDefault")}
              </Text>
              <Switch value={isDefault} onValueChange={setIsDefault} />
            </View>

            {error && (
              <Text style={[styles.error, { fontSize: fs(13) }]}>{error}</Text>
            )}

            <View style={styles.actionRow}>
              {editing && (
                <Pressable
                  style={styles.btnDanger}
                  onPress={archive}
                  disabled={busy}
                >
                  <Text
                    style={{
                      color: p.danger,
                      fontWeight: "600",
                      fontSize: fs(14),
                    }}
                  >
                    {t("archiveAccount")}
                  </Text>
                </Pressable>
              )}
              <Pressable
                style={[
                  styles.btn,
                  {
                    backgroundColor: p.accent,
                    opacity: ready && !busy ? 1 : 0.5,
                    flex: 1,
                  },
                ]}
                onPress={save}
                disabled={!ready || busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "700",
                      fontSize: fs(15),
                    }}
                  >
                    {t("save")}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAware>
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
  body: { gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
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
    fontSize: 24,
    fontWeight: "700",
    paddingVertical: 11,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  btn: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  btnDanger: { paddingVertical: 14, paddingHorizontal: 14 },
  error: { color: "#b91c1c", textAlign: "center" },
});
