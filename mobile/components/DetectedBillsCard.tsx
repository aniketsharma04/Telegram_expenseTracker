import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  BillStatus,
  DetectedBill,
  confirmDetected,
  dismissDetected,
} from "../lib/api";
import { useSettings } from "../lib/i18n";
import { formatINR, Palette } from "../lib/theme";
import { Card } from "./ui";

const KIND_ICON: Record<string, string> = {
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

interface Props {
  p: Palette;
  token: string;
  detected: DetectedBill[];
  bills: BillStatus[];
  onChanged: () => void;
}

/**
 * The confirm/dismiss inbox for bills a detector found (email today, phone
 * notifications next). Nothing here has touched the user's bill list yet —
 * every row is a proposal, and dismissing one stops it coming back.
 */
export default function DetectedBillsCard({
  p,
  token,
  detected,
  bills,
  onChanged,
}: Props) {
  const { t, fs } = useSettings();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!detected.length) return null;

  /** An existing bill this detection probably belongs to, by name overlap. */
  const matchExisting = (d: DetectedBill): BillStatus | null => {
    const name = d.biller_name.toLowerCase();
    const words = name.split(/\s+/).filter((w) => w.length > 3);
    return (
      bills.find((b) => {
        const bn = b.name.toLowerCase();
        return (
          bn === name ||
          bn.includes(name) ||
          name.includes(bn) ||
          words.some((w) => bn.includes(w))
        );
      }) ?? null
    );
  };

  const confirm = async (d: DetectedBill, billId?: string) => {
    setBusyId(d.id);
    setError(null);
    const res = await confirmDetected(
      token,
      d.id,
      billId ? { bill_id: billId } : {},
    );
    setBusyId(null);
    if (!res) {
      setError("Couldn't add that. Try again.");
      return;
    }
    onChanged();
  };

  const dismiss = async (d: DetectedBill) => {
    setBusyId(d.id);
    setError(null);
    const ok = await dismissDetected(token, d.id);
    setBusyId(null);
    if (!ok) {
      setError("Couldn't dismiss that. Try again.");
      return;
    }
    onChanged();
  };

  return (
    <Card p={p} style={{ borderColor: p.accent }}>
      <Text style={{ fontSize: fs(14), fontWeight: "700", color: p.ink }}>
        📧 {t("foundInEmail")}
      </Text>
      <Text style={{ fontSize: fs(12), color: p.muted, marginTop: 2 }}>
        {t("detectedNote")}
      </Text>

      {error && (
        <Text style={{ fontSize: fs(12.5), color: "#d03b3b", marginTop: 8 }}>
          {error}
        </Text>
      )}

      {detected.map((d) => {
        const existing = matchExisting(d);
        const busy = busyId === d.id;
        // The due date and the low-confidence warning are independent facts —
        // show either, both, or neither, instead of letting a missing due date
        // masquerade as "check the amount" or printing that warning twice.
        const meta = [
          d.due_date
            ? `${t("dueOn")} ${d.due_date.slice(8)}/${d.due_date.slice(5, 7)}`
            : null,
          d.confidence === "low" ? t("unsureAmount") : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <View key={d.id} style={[styles.item, { borderTopColor: p.border }]}>
            <View style={styles.head}>
              <Text style={{ fontSize: 20 }}>{KIND_ICON[d.kind] ?? "🧾"}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: fs(14.5),
                    fontWeight: "600",
                    color: p.ink,
                  }}
                  numberOfLines={1}
                >
                  {d.biller_name}
                  {d.account_hint ? ` ${d.account_hint}` : ""}
                </Text>
                {meta ? (
                  <Text
                    style={{ fontSize: fs(12), color: p.ink2, marginTop: 2 }}
                  >
                    {meta}
                  </Text>
                ) : null}
              </View>
              <Text
                style={{ fontSize: fs(15), fontWeight: "700", color: p.ink }}
              >
                {d.amount != null ? formatINR(d.amount) : "—"}
              </Text>
            </View>

            {d.subject ? (
              <Text
                style={{ fontSize: fs(11.5), color: p.muted, marginTop: 4 }}
                numberOfLines={1}
              >
                {d.subject}
              </Text>
            ) : null}

            <View style={styles.row}>
              {busy ? (
                <ActivityIndicator color={p.accent} style={{ marginTop: 8 }} />
              ) : (
                <>
                  <Pressable
                    style={[styles.btn, { backgroundColor: p.accent, flex: 1 }]}
                    onPress={() => confirm(d, existing?.id)}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontWeight: "700",
                        fontSize: fs(13),
                      }}
                      numberOfLines={1}
                    >
                      {existing
                        ? `${t("updateExisting")} ${existing.name}`
                        : t("confirmAdd")}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btnGhost, { borderColor: p.border }]}
                    onPress={() => dismiss(d)}
                  >
                    <Text
                      style={{
                        color: p.ink2,
                        fontWeight: "600",
                        fontSize: fs(13),
                      }}
                    >
                      {t("dismiss")}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  btn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  btnGhost: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: "center",
  },
});
