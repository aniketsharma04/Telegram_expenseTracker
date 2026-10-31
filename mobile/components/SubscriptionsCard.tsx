import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text } from "./Text";
import { SubscriptionView, decideSubscription } from "../lib/api";
import { useSettings } from "../lib/i18n";
import { formatINR, Palette } from "../lib/theme";
import { Card, IconBubble } from "./ui";

interface Props {
  p: Palette;
  token: string;
  subscriptions: SubscriptionView[];
  onChanged: () => void;
}

/**
 * Repeat charges found in the user's spending (v19). Each one gets a single
 * decision — keep it or cancel it. A planned cancel shows where to do it; the
 * server marks it cancelled once a renewal passes with no charge, and that's
 * the money this card counts as saved.
 */
export default function SubscriptionsCard({
  p,
  token,
  subscriptions,
  onChanged,
}: Props) {
  const { t, fs } = useSettings();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!subscriptions.length) return null;

  const paying = subscriptions.filter((s) => s.status !== "cancelled");
  const monthly = paying.reduce((sum, s) => sum + s.amount, 0);
  const saved = subscriptions
    .filter((s) => s.status === "cancelled")
    .reduce((sum, s) => sum + s.amount * 12, 0);

  const decide = async (s: SubscriptionView, decision: "keep" | "cancel") => {
    setBusy(s.merchant_key);
    setError(null);
    const ok = await decideSubscription(token, s, decision).catch(() => false);
    setBusy(null);
    if (!ok) {
      setError("Couldn't save that. Try again.");
      return;
    }
    onChanged();
  };

  const openCancel = (url: string) =>
    Linking.openURL(url).catch(() => setError("Couldn't open that link."));

  return (
    <Card p={p}>
      <View style={styles.header}>
        <Text style={{ fontSize: fs(14), fontWeight: "700", color: p.ink }}>
          {t("subscriptions")}
        </Text>
        <Text style={{ fontSize: fs(14), fontWeight: "700", color: p.ink }}>
          {formatINR(monthly)}{" "}
          <Text style={{ fontSize: fs(12), fontWeight: "400", color: p.ink2 }}>
            {t("subsPerMonth")}
          </Text>
        </Text>
      </View>
      <Text style={{ fontSize: fs(12), color: p.muted, marginTop: 2 }}>
        {formatINR(monthly * 12)} {t("subsPerYear")} · {t("subsNote")}
      </Text>
      {saved > 0 && (
        <Text
          style={{
            fontSize: fs(12.5),
            color: p.good,
            fontWeight: "600",
            marginTop: 6,
          }}
        >
          {t("subsSaved")} {formatINR(saved)} {t("subsPerYear")} 🎉
        </Text>
      )}

      {error && (
        <Text style={{ fontSize: fs(12.5), color: p.danger, marginTop: 8 }}>
          {error}
        </Text>
      )}

      {subscriptions.map((s) => {
        const loading = busy === s.merchant_key;
        const next = s.next_date
          ? `${t("subsNext")} ${s.next_date.slice(8)}/${s.next_date.slice(5, 7)}`
          : null;
        const statusLabel =
          s.status === "keep"
            ? t("subsKeeping")
            : s.status === "cancel"
              ? t("subsCancelling")
              : s.status === "cancelled"
                ? t("subsCancelled")
                : null;
        return (
          <View
            key={s.merchant_key}
            style={[styles.item, { borderTopColor: p.border }]}
            accessibilityLabel={`${s.merchant}, ${formatINR(s.amount)} ${t("subsPerMonth")}`}
          >
            <View style={styles.head}>
              <IconBubble
                name="repeat"
                color={s.status === "cancelled" ? p.good : p.accent}
                bg={p.accentSoft}
                size={36}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: fs(14.5),
                    fontWeight: "600",
                    color: p.ink,
                    textDecorationLine:
                      s.status === "cancelled" ? "line-through" : "none",
                  }}
                  numberOfLines={1}
                >
                  {s.merchant}
                </Text>
                <Text style={{ fontSize: fs(12), color: p.ink2, marginTop: 2 }}>
                  {[statusLabel, s.status !== "cancelled" ? next : null]
                    .filter(Boolean)
                    .join(" · ") || s.category}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: fs(15),
                  fontWeight: "700",
                  color: s.status === "cancelled" ? p.good : p.ink,
                }}
              >
                {formatINR(s.amount)}
              </Text>
            </View>

            {loading ? (
              <ActivityIndicator color={p.accent} style={{ marginTop: 10 }} />
            ) : s.status === "new" ? (
              <View style={styles.row}>
                <Pressable
                  style={[styles.btnGhost, { borderColor: p.border, flex: 1 }]}
                  onPress={() => decide(s, "keep")}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      color: p.ink,
                      fontWeight: "600",
                      fontSize: fs(13),
                    }}
                  >
                    {t("subsKeep")}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, { backgroundColor: p.accent, flex: 1 }]}
                  onPress={() => decide(s, "cancel")}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "700",
                      fontSize: fs(13),
                    }}
                  >
                    {t("subsCancel")}
                  </Text>
                </Pressable>
              </View>
            ) : s.status === "cancel" ? (
              <>
                <Text
                  style={{ fontSize: fs(12), color: p.muted, marginTop: 8 }}
                >
                  {s.cancel_url
                    ? t("subsCancelHint")
                    : `${t("subsCancelInApp")} ${t("subsCancelHint")}`}
                </Text>
                <View style={styles.row}>
                  {s.cancel_url && (
                    <Pressable
                      style={[
                        styles.btn,
                        { backgroundColor: p.accent, flex: 1 },
                      ]}
                      onPress={() => openCancel(s.cancel_url!)}
                      accessibilityRole="link"
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "700",
                          fontSize: fs(13),
                        }}
                      >
                        {t("subsHowTo")}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[styles.btnGhost, { borderColor: p.border }]}
                    onPress={() => decide(s, "keep")}
                    accessibilityRole="button"
                  >
                    <Text
                      style={{
                        color: p.ink2,
                        fontWeight: "600",
                        fontSize: fs(13),
                      }}
                    >
                      {t("subsUndo")}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : s.status === "keep" ? (
              <Pressable
                onPress={() => decide(s, "cancel")}
                accessibilityRole="button"
              >
                <Text
                  style={{
                    fontSize: fs(12.5),
                    color: p.accent,
                    fontWeight: "600",
                    marginTop: 8,
                  }}
                >
                  {t("subsCancel")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
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
