import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { fetchReceipt, Receipt } from "../lib/api";
import { formatINR, Palette } from "../lib/theme";
import { useSettings } from "../lib/i18n";

/**
 * The bill behind an expense: every line as printed, then the tax, tip and
 * discount that explain the gap to the total.
 *
 * Renders nothing at all when the expense has no stored bill, which is the
 * common case — only photographed receipts have one.
 */

interface Props {
  expenseId: string;
  token: string;
  p: Palette;
}

export default function ReceiptLines({ expenseId, token, p }: Props) {
  const { t, fs } = useSettings();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchReceipt(token, expenseId).then((r) => {
      if (cancelled) return;
      setReceipt(r);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [expenseId, token]);

  if (loading) {
    return <ActivityIndicator color={p.muted} style={{ marginVertical: 8 }} />;
  }
  if (!receipt || (!receipt.items.length && receipt.tax == null)) return null;

  const row = (label: string, value: number | null, muted = true) =>
    value == null ? null : (
      <View style={styles.totalRow} key={label}>
        <Text style={{ color: muted ? p.muted : p.ink, fontSize: fs(12.5) }}>
          {label}
        </Text>
        <Text
          style={{
            color: muted ? p.ink2 : p.ink,
            fontSize: fs(12.5),
            fontWeight: muted ? "400" : "700",
          }}
        >
          {formatINR(value)}
        </Text>
      </View>
    );

  return (
    <View
      style={[styles.wrap, { borderColor: p.border, backgroundColor: p.page }]}
    >
      <Text style={{ color: p.ink2, fontSize: fs(12), fontWeight: "600" }}>
        {t("billItems")}
        {receipt.items.length ? ` · ${receipt.items.length}` : ""}
      </Text>

      {receipt.items.map((item) => (
        <View key={item.line_no} style={styles.itemRow}>
          <Text
            style={{ color: p.ink, fontSize: fs(13), flex: 1 }}
            numberOfLines={2}
          >
            {item.quantity && item.quantity !== 1 ? `${item.quantity}× ` : ""}
            {item.name}
          </Text>
          <Text style={{ color: p.ink2, fontSize: fs(13) }}>
            {formatINR(item.amount)}
          </Text>
        </View>
      ))}

      <View style={[styles.divider, { backgroundColor: p.grid }]} />

      {row(t("billSubtotal"), receipt.subtotal)}
      {row(t("billTax"), receipt.tax)}
      {row(t("billDiscount"), receipt.discount)}
      {row(t("billTip"), receipt.tip)}
      {row(t("billTotal"), receipt.total, false)}

      {!receipt.reconciled && receipt.items.length > 0 && (
        <Text style={{ color: "#b0740f", fontSize: fs(11.5), marginTop: 6 }}>
          {t("billPartial")}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  divider: { height: 1, marginVertical: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
});
