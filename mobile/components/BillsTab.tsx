import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import {
  BillInput,
  BillKind,
  BillStatus,
  RecurringCharge,
  payBill,
  refreshBillFetch,
  unpayBill,
} from "../lib/api";
import { StringKey, useSettings } from "../lib/i18n";
import { formatINR, Palette } from "../lib/theme";
import { Card, SectionTitle } from "./ui";
import BillSheet from "./BillSheet";

const KIND_ICON: Record<BillKind, string> = {
  electricity: "⚡",
  water: "💧",
  gas: "🔥",
  credit_card: "💳",
  rent: "🏠",
  internet: "🌐",
  mobile: "📱",
  insurance: "🛡️",
  other: "🧾",
};
const KINDS = Object.keys(KIND_ICON) as BillKind[];
const KIND_CATEGORY: Record<BillKind, string> = {
  electricity: "Utilities & bills",
  water: "Utilities & bills",
  gas: "Utilities & bills",
  credit_card: "Loans & EMI",
  rent: "Utilities & bills",
  internet: "Utilities & bills",
  mobile: "Utilities & bills",
  insurance: "Utilities & bills",
  other: "Utilities & bills",
};

/** Popular UPI apps, for the no-UPI-ID fallback ("open the app, pay there"). */
const UPI_APPS = [
  { label: "Google Pay", pkg: "com.google.android.apps.nbu.paisa.user" },
  { label: "PhonePe", pkg: "com.phonepe.app" },
  { label: "Paytm", pkg: "net.one97.paytm" },
  { label: "Amazon", pkg: "in.amazon.mShop.android.shopping" },
  { label: "BHIM", pkg: "in.org.npci.upiapp" },
];

interface Props {
  p: Palette;
  token: string;
  bills: BillStatus[];
  recurring: RecurringCharge[];
  categories: Array<{ name: string; color: string | null }>;
  today: string;
  onChanged: () => void;
}

export default function BillsTab({
  p,
  token,
  bills,
  recurring,
  categories,
  today,
  onChanged,
}: Props) {
  const { t, fs } = useSettings();
  const [editing, setEditing] = useState<{
    bill?: BillStatus;
    prefill?: Partial<BillInput>;
  } | null>(null);
  const [paying, setPaying] = useState<BillStatus | null>(null); // mark-paid sheet
  const [pending, setPending] = useState<BillStatus | null>(null); // "did it go through?" banner
  const [chooser, setChooser] = useState<BillStatus | null>(null); // no-UPI-id fallback
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suggestions = recurring.filter(
    (r) =>
      !bills.some(
        (b) =>
          b.name.toLowerCase().includes(r.merchant.toLowerCase()) ||
          r.merchant.toLowerCase().includes(b.name.toLowerCase()),
      ),
  );

  const payNow = async (bill: BillStatus) => {
    setError(null);
    if (bill.upiLink) {
      try {
        await Linking.openURL(bill.upiLink);
        setPending(bill);
      } catch {
        setError("No UPI app could open that link — is a UPI app installed?");
      }
      return;
    }
    setChooser(bill);
  };

  const openApp = async (pkg: string, bill: BillStatus) => {
    setChooser(null);
    try {
      await IntentLauncher.startActivityAsync("android.intent.action.MAIN", {
        packageName: pkg,
        category: "android.intent.category.LAUNCHER",
      });
      setPending(bill);
    } catch {
      setError("That app doesn't seem to be installed.");
    }
  };

  const refreshOne = async (bill: BillStatus) => {
    if (busyId) return;
    setBusyId(bill.id);
    setError(null);
    const r = await refreshBillFetch(token, bill.id).catch(() => null);
    setBusyId(null);
    if (!r) setError(`${t("fetchFailed")} — try again in a minute.`);
    else if (!r.fetch.ok && r.fetch.code !== "no_dues")
      setError(`${t("fetchFailed")}: ${r.fetch.error}`);
    onChanged();
  };

  const ago = (iso: string) => {
    const h = (Date.now() - Date.parse(iso)) / 36e5;
    if (h < 1) return t("justNow");
    if (h < 48) return `${Math.round(h)}${t("hoursAgo")}`;
    return `${Math.round(h / 24)}${t("daysAgo")}`;
  };

  const undoPaid = async (bill: BillStatus) => {
    if (!bill.paidThisMonth || busyId) return;
    setBusyId(bill.id);
    const ok = await unpayBill(token, bill.paidThisMonth.id).catch(() => false);
    setBusyId(null);
    if (ok) onChanged();
    else setError("Couldn't undo that.");
  };

  const statusLine = (b: BillStatus) => {
    if (b.paidThisMonth)
      return {
        text: `✅ ${t("paid")} ${formatINR(b.paidThisMonth.amount)} · ${b.paidThisMonth.paid_on.slice(5)}`,
        color: p.good,
      };
    if (b.daysUntil < 0)
      return {
        text: `⏰ ${-b.daysUntil}${t("daysShort")} ${t("overdue")}`,
        color: "#d03b3b",
      };
    if (b.daysUntil === 0)
      return { text: `🔴 ${t("dueToday")}`, color: "#d03b3b" };
    if (b.daysUntil <= 3)
      return {
        text: `🟠 ${t("dueIn")} ${b.daysUntil}${t("daysShort")}`,
        color: "#c98500",
      };
    return {
      text: `${t("dueIn")} ${b.daysUntil}${t("daysShort")} · ${Number(b.dueDate.slice(8))}th`,
      color: p.ink2,
    };
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.headRow}>
        <Text style={{ fontSize: fs(16), fontWeight: "700", color: p.ink }}>
          🧾 {t("bills")}
        </Text>
        <Pressable
          style={[styles.addBtn, { backgroundColor: p.accent }]}
          onPress={() => setEditing({})}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: fs(13) }}>
            ＋ {t("addBill")}
          </Text>
        </Pressable>
      </View>

      {error && (
        <Text style={[styles.error, { fontSize: fs(13) }]}>{error}</Text>
      )}

      {pending && !pending.paidThisMonth && (
        <Card p={p} style={{ borderColor: p.accent }}>
          <Text style={{ fontSize: fs(14), fontWeight: "600", color: p.ink }}>
            {KIND_ICON[pending.kind]} {pending.name} — {t("didYouPay")}
          </Text>
          <View style={[styles.row, { marginTop: 10 }]}>
            <Pressable
              style={[styles.btn, { backgroundColor: p.accent, flex: 1 }]}
              onPress={() => {
                setPaying(pending);
                setPending(null);
              }}
            >
              <Text
                style={{ color: "#fff", fontWeight: "700", fontSize: fs(14) }}
              >
                {t("markPaid")}
                {pending.amount ? ` ${formatINR(pending.amount)}` : ""}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.btnGhost, { borderColor: p.border }]}
              onPress={() => setPending(null)}
            >
              <Text
                style={{ color: p.ink2, fontWeight: "600", fontSize: fs(14) }}
              >
                {t("notYet")}
              </Text>
            </Pressable>
          </View>
        </Card>
      )}

      {bills.length === 0 && (
        <Card p={p}>
          <Text style={{ fontSize: fs(14), lineHeight: 21, color: p.ink2 }}>
            {t("noBills")}
          </Text>
        </Card>
      )}

      {bills.map((b) => {
        const s = statusLine(b);
        return (
          <Card key={b.id} p={p} style={{ padding: 14 }}>
            <Pressable
              onPress={() => setEditing({ bill: b })}
              style={styles.billHead}
            >
              <Text style={{ fontSize: 22 }}>{KIND_ICON[b.kind]}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{ fontSize: fs(15), fontWeight: "600", color: p.ink }}
                  numberOfLines={1}
                >
                  {b.name}
                </Text>
                <Text
                  style={{
                    fontSize: fs(12.5),
                    color: s.color,
                    marginTop: 2,
                    fontWeight: b.daysUntil <= 3 ? "600" : "400",
                  }}
                >
                  {s.text}
                </Text>
              </View>
              <Text
                style={{ fontSize: fs(16), fontWeight: "700", color: p.ink }}
              >
                {b.amount ? formatINR(b.amount) : "—"}
              </Text>
            </Pressable>

            {b.linked && (
              <View style={[styles.row, { marginTop: 8 }]}>
                <Text
                  style={{ flex: 1, fontSize: fs(12), color: p.muted }}
                  numberOfLines={1}
                >
                  🔗 {t("linkedVia")}
                  {b.biller_name ? ` · ${b.biller_name}` : ""}
                  {b.fetched_at
                    ? ` · ${t("lastFetched")} ${ago(b.fetched_at)}`
                    : ""}
                  {b.fetch_error ? ` · ⚠️ ${t("fetchFailed")}` : ""}
                  {b.linked && b.amount === null && !b.fetch_error
                    ? ` · ${t("noDues")}`
                    : ""}
                </Text>
                <Pressable
                  onPress={() => refreshOne(b)}
                  disabled={busyId === b.id}
                  hitSlop={8}
                >
                  {busyId === b.id ? (
                    <ActivityIndicator size="small" color={p.accent} />
                  ) : (
                    <Text
                      style={{
                        fontSize: fs(12.5),
                        color: p.accent,
                        fontWeight: "600",
                      }}
                    >
                      ↻ {t("refresh")}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}

            {b.paidThisMonth ? (
              <View style={[styles.row, { marginTop: 10 }]}>
                <Pressable
                  style={[styles.btnGhost, { borderColor: p.border }]}
                  onPress={() => undoPaid(b)}
                  disabled={busyId === b.id}
                >
                  {busyId === b.id ? (
                    <ActivityIndicator color={p.accent} />
                  ) : (
                    <Text
                      style={{
                        color: p.ink2,
                        fontWeight: "600",
                        fontSize: fs(13),
                      }}
                    >
                      ↩ {t("undoPaid")}
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={[styles.row, { marginTop: 10 }]}>
                <Pressable
                  style={[styles.btn, { backgroundColor: p.accent, flex: 1 }]}
                  onPress={() => payNow(b)}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "700",
                      fontSize: fs(14),
                    }}
                  >
                    {b.upiLink ? "⚡ " : "↗ "}
                    {t("payNow")}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.btnGhost, { borderColor: p.border }]}
                  onPress={() => setPaying(b)}
                >
                  <Text
                    style={{
                      color: p.ink2,
                      fontWeight: "600",
                      fontSize: fs(13),
                    }}
                  >
                    ✓ {t("markPaid")}
                  </Text>
                </Pressable>
              </View>
            )}
          </Card>
        );
      })}

      {suggestions.length > 0 && (
        <Card p={p}>
          <SectionTitle p={p}>💡 {t("suggested")}</SectionTitle>
          <View style={{ gap: 10 }}>
            {suggestions.slice(0, 4).map((r) => (
              <View key={`${r.merchant}|${r.category}`} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: fs(14),
                      fontWeight: "500",
                      color: p.ink,
                    }}
                  >
                    {r.merchant}
                  </Text>
                  <Text style={{ fontSize: fs(12), color: p.muted }}>
                    ~{formatINR(r.amount)} · {t("dueAround")}{" "}
                    {Number(r.nextDate.slice(8))}
                  </Text>
                </View>
                <Pressable
                  style={[styles.btnGhost, { borderColor: p.accent }]}
                  onPress={() =>
                    setEditing({
                      prefill: {
                        name: r.merchant,
                        kind: "other",
                        category: r.category,
                        amount: r.amount,
                        due_day: Number(r.nextDate.slice(8)),
                      },
                    })
                  }
                >
                  <Text
                    style={{
                      color: p.accent,
                      fontWeight: "600",
                      fontSize: fs(13),
                    }}
                  >
                    {t("addAsBill")}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        </Card>
      )}

      {editing && (
        <BillSheet
          p={p}
          token={token}
          categories={categories}
          bill={editing.bill}
          prefill={editing.prefill}
          onClose={() => setEditing(null)}
          onChanged={onChanged}
        />
      )}

      {paying && (
        <MarkPaidSheet
          p={p}
          token={token}
          bill={paying}
          today={today}
          onClose={() => setPaying(null)}
          onChanged={onChanged}
        />
      )}

      {chooser && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setChooser(null)}
        >
          <Pressable style={styles.backdrop} onPress={() => setChooser(null)}>
            <View
              style={[
                styles.chooser,
                { backgroundColor: p.surface, borderColor: p.border },
              ]}
            >
              <Text
                style={{ fontSize: fs(14), color: p.ink2, marginBottom: 10 }}
              >
                {t("openUpiApp")}
              </Text>
              {UPI_APPS.map((a) => (
                <Pressable
                  key={a.pkg}
                  style={[
                    styles.chooserBtn,
                    { borderColor: p.border, backgroundColor: p.page },
                  ]}
                  onPress={() => openApp(a.pkg, chooser)}
                >
                  <Text
                    style={{
                      fontSize: fs(15),
                      fontWeight: "600",
                      color: p.ink,
                    }}
                  >
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

// ── Mark paid ────────────────────────────────────────────────────────────────

function MarkPaidSheet({
  p,
  token,
  bill,
  today,
  onClose,
  onChanged,
}: {
  p: Palette;
  token: string;
  bill: BillStatus;
  today: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, fs } = useSettings();
  const [amount, setAmount] = useState(
    bill.amount
      ? String(bill.amount)
      : bill.lastPaid
        ? String(bill.lastPaid.amount)
        : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const amt = parseFloat(amount.replace(/,/g, ""));
  const ready = Number.isFinite(amt) && amt > 0;

  const confirm = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const result = await payBill(token, bill.id, amt, today).catch(() => null);
    setBusy(false);
    if (result === "unauthorized")
      setError("Session expired — get a fresh /app code from the bot.");
    else if (!result) setError("Couldn't record that payment.");
    else {
      onChanged();
      if (result.alerts?.length) setAlerts(result.alerts);
      else onClose();
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdropCol}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: p.surface, borderColor: p.border, gap: 12 },
          ]}
        >
          <View style={[styles.grab, { backgroundColor: p.grid }]} />
          <Text style={{ fontSize: fs(18), fontWeight: "700", color: p.ink }}>
            {KIND_ICON[bill.kind]} {bill.name} — {t("markPaid")}
          </Text>
          {alerts.length > 0 ? (
            <>
              {alerts.map((a) => (
                <Text key={a} style={[styles.alert, { fontSize: fs(13) }]}>
                  {a}
                </Text>
              ))}
              <Pressable
                style={[styles.btn, { backgroundColor: p.accent }]}
                onPress={onClose}
              >
                <Text
                  style={{ color: "#fff", fontWeight: "700", fontSize: fs(15) }}
                >
                  {t("done")}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <View
                style={[
                  styles.amountBox,
                  { borderColor: p.grid, backgroundColor: p.page },
                ]}
              >
                <Text
                  style={{ fontSize: 22, fontWeight: "700", color: p.muted }}
                >
                  ₹
                </Text>
                <TextInput
                  style={[styles.amountInput, { color: p.ink }]}
                  placeholder={t("amountPaid")}
                  placeholderTextColor={p.muted}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  autoFocus
                />
              </View>
              {error && (
                <Text style={[styles.error, { fontSize: fs(13) }]}>
                  {error}
                </Text>
              )}
              <Pressable
                style={[
                  styles.btn,
                  {
                    backgroundColor: p.accent,
                    opacity: ready && !busy ? 1 : 0.5,
                  },
                ]}
                onPress={confirm}
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
                    ✓ {t("markPaid")} {ready ? formatINR(amt) : ""} →{" "}
                    {bill.category}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addBtn: { borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  billHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  btn: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    paddingHorizontal: 14,
  },
  btnGhost: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  btnDanger: { paddingVertical: 12, paddingHorizontal: 10 },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 24,
  },
  backdropCol: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  chooser: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 8,
  },
  chooserBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
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
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
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
    fontSize: 26,
    fontWeight: "700",
    paddingVertical: 12,
  },
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
