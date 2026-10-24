import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchInbox, InboxItem, markInboxRead, patchExpense } from "../lib/api";
import { PushState, registerForPush } from "../lib/push";
import { Palette } from "../lib/theme";
import { useSettings } from "../lib/i18n";
import { Card, Icon } from "./ui";
import { NOTICE_KIND_ICON } from "../lib/categories";



/** Header bell with the unread count. */
export function InboxBell({
  p,
  unread,
  onPress,
}: {
  p: Palette;
  unread: number;
  onPress: () => void;
}) {
  const { fs, t } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${t("inbox")}${unread ? `, ${unread} unread` : ""}`}
      style={[styles.bell, { borderColor: p.border, backgroundColor: p.surface }]}
    >
      <Icon name="bell" size={20} color={p.ink} />
      {unread > 0 && (
        <View style={[styles.badge, { backgroundColor: p.danger }]}>
          <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

function ago(iso: string, justNow: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return justNow;
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days}d` : new Date(iso).toLocaleDateString();
}

/**
 * Everything the app has told you, newest first. Opening it marks it read.
 * A big spend keeps its "Paid from savings" button here, so the decision
 * doesn't have to happen on the lock screen.
 */
export function InboxSheet({
  p,
  token,
  onClose,
  onChanged,
}: {
  p: Palette;
  token: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, fs } = useSettings();
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [moved, setMoved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchInbox(token).catch(() => null);
      if (cancelled) return;
      setItems(res?.items ?? []);
      if (res?.unread) {
        await markInboxRead(token).catch(() => false);
        onChanged();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const fromSavings = async (expenseId: string) => {
    if (busy) return;
    setBusy(expenseId);
    const res = await patchExpense(token, expenseId, { budget_scope: "savings" }).catch(() => null);
    setBusy(null);
    if (res && res !== "unauthorized") {
      setMoved((m) => new Set(m).add(expenseId));
      onChanged();
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: p.surface, borderColor: p.border }]}>
          <View style={[styles.grab, { backgroundColor: p.grid }]} />
          <Text style={{ fontSize: fs(18), fontWeight: "700", color: p.ink, marginBottom: 12 }}>
            {t("inbox")}
          </Text>
          {items === null ? (
            <ActivityIndicator style={{ marginVertical: 30 }} />
          ) : items.length === 0 ? (
            <Text style={{ color: p.ink2, fontSize: fs(14), lineHeight: 20, marginBottom: 16 }}>
              {t("inboxEmpty")}
            </Text>
          ) : (
            <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
              {items.map((n) => {
                const expenseId = n.data?.expenseId;
                const offerSavings = n.data?.bigSpend === true && typeof expenseId === "string";
                return (
                  <View
                    key={n.id}
                    style={[styles.item, { borderColor: p.border, backgroundColor: n.read_at ? p.surface : p.accentSoft }]}
                  >
                    <View style={styles.itemHead}>
                      <Icon name={NOTICE_KIND_ICON[n.kind] ?? "bell"} size={16} color={n.kind === "alerts" ? p.warn : p.accent} />
                      <Text style={{ fontSize: fs(14), fontWeight: "600", color: p.ink, flex: 1 }}>{n.title}</Text>
                      <Text style={{ fontSize: fs(11.5), color: p.muted }}>{ago(n.created_at, t("justNow"))}</Text>
                    </View>
                    <Text style={{ fontSize: fs(13), color: p.ink2, lineHeight: 19 }}>{n.body}</Text>
                    {offerSavings &&
                      (moved.has(expenseId) ? (
                        <Text style={{ color: p.good, fontSize: fs(13), fontWeight: "600" }}>{t("movedToSavings")}</Text>
                      ) : (
                        <Pressable
                          onPress={() => fromSavings(expenseId)}
                          style={[styles.action, { borderColor: p.accent }]}
                        >
                          <Text style={{ color: p.accent, fontSize: fs(13), fontWeight: "600" }}>
                            {busy === expenseId ? "…" : `${t("fromSavings")}`}
                          </Text>
                        </Pressable>
                      ))}
                  </View>
                );
              })}
            </ScrollView>
          )}
          <Pressable style={[styles.done, { borderColor: p.border }]} onPress={onClose}>
            <Text style={{ color: p.ink2, fontWeight: "600", fontSize: fs(14) }}>{t("done")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Asks for notification permission with the reason first — the system prompt
 * appears only after the user taps. Hidden once granted or dismissed.
 */
export function PushPromptCard({
  p,
  state,
  token,
  onResult,
  onDismiss,
}: {
  p: Palette;
  state: PushState;
  token: string;
  onResult: (s: PushState) => void;
  onDismiss: () => void;
}) {
  const { t, fs } = useSettings();
  const [busy, setBusy] = useState(false);
  if (state === "granted" || state === "unavailable") return null;
  const blocked = state === "denied";

  return (
    <Card p={p} style={{ gap: 10 }}>
      <Text style={{ fontSize: fs(15), fontWeight: "700", color: p.ink }}>{t("pushTitle")}</Text>
      <Text style={{ fontSize: fs(13.5), color: p.ink2, lineHeight: 20 }}>
        {blocked ? t("pushBlocked") : t("pushHint")}
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          style={[styles.cta, { backgroundColor: p.accent, opacity: busy ? 0.6 : 1 }]}
          onPress={async () => {
            if (blocked) {
              Linking.openSettings();
              return;
            }
            setBusy(true);
            onResult(await registerForPush(token, { ask: true }));
            setBusy(false);
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: fs(13.5) }}>
            {blocked ? t("openSettings") : t("pushTurnOn")}
          </Text>
        </Pressable>
        <Pressable style={[styles.ghost, { borderColor: p.border }]} onPress={onDismiss}>
          <Text style={{ color: p.ink2, fontWeight: "600", fontSize: fs(13.5) }}>{t("notNow")}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  bell: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: "85%",
  },
  grab: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  item: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  itemHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  action: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, marginTop: 2 },
  done: { borderWidth: 1, borderRadius: 14, paddingVertical: 13, alignItems: "center", marginTop: 12 },
  cta: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  ghost: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
});
