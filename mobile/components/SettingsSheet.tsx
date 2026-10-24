import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  API_BASE,
  deleteMyAccount,
  exportMyData,
  GmailStatus,
  gmailConnectUrl,
  gmailDisconnect,
  gmailSync,
} from "../lib/api";
import { captureStatus, syncCaptures } from "../lib/capture";
import { openCaptureSettings } from "../modules/notification-capture";
import { Palette } from "../lib/theme";
import { Lang, useSettings } from "../lib/i18n";

/** Language + text-size settings — the "parent mode" knobs — plus Gmail linking. */
export default function SettingsSheet({
  visible,
  onClose,
  p,
  token,
  gmail,
  onChanged,
  onAccountDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  p: Palette;
  token?: string;
  gmail?: GmailStatus;
  onChanged?: () => void;
  /** Called once the account is gone — the app signs out. */
  onAccountDeleted?: () => void;
}) {
  const { t, fs, lang, scale, setLang, setLarge } = useSettings();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // v9: notification capture. Permission is granted in a system screen, so
  // the status is re-read every time this sheet opens.
  const [capture, setCapture] = useState(captureStatus);
  const [capturing, setCapturing] = useState(false);
  const [captureNote, setCaptureNote] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setCapture(captureStatus());
    if (!visible) setConfirmDelete(false);
  }, [visible]);

  // Your data: export, privacy policy, delete (Play requires in-app deletion).
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dataBusy, setDataBusy] = useState(false);
  const [dataNote, setDataNote] = useState<string | null>(null);

  const exportData = async () => {
    if (!token || dataBusy) return;
    setDataBusy(true);
    setDataNote(null);
    const data = await exportMyData(token);
    setDataBusy(false);
    if (!data) {
      setDataNote(t("exportFailed"));
      return;
    }
    await Share.share({ title: "expense-tracker-export.json", message: JSON.stringify(data, null, 2) }).catch(() => {});
  };

  const deleteAccount = async () => {
    if (!token || dataBusy) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDataBusy(true);
    const ok = await deleteMyAccount(token);
    setDataBusy(false);
    if (!ok) {
      setDataNote(t("deleteFailed"));
      return;
    }
    onClose();
    onAccountDeleted?.();
  };

  const grantCapture = () => {
    openCaptureSettings();
    setCaptureNote(t("grantHint"));
  };

  const syncNow = async () => {
    if (!token) return;
    setCapturing(true);
    setCaptureNote(null);
    const result = await syncCaptures(token);
    setCapture(captureStatus());
    setCapturing(false);
    setCaptureNote(
      result.error
        ? t("captureFailed")
        : result.sent === 0
          ? t("captureNothing")
          : `${result.logged} ${t("captureLogged")}${
              result.duplicates
                ? ` · ${result.duplicates} ${t("captureSkipped")}`
                : ""
            }`,
    );
    if (!result.error && result.logged > 0) onChanged?.();
  };

  // Consent runs in the system browser; coming back, "Scan now" picks it up.
  const connect = async () => {
    if (!token) return;
    setBusy(true);
    setNote(null);
    const url = await gmailConnectUrl(token);
    setBusy(false);
    if (!url) {
      setNote("Gmail isn't set up on the server yet.");
      return;
    }
    Linking.openURL(url).catch(() => setNote("Couldn't open the browser."));
  };

  const scan = async () => {
    if (!token) return;
    setBusy(true);
    setNote(null);
    const res = await gmailSync(token);
    setBusy(false);
    if (!res) {
      // An expired consent fails here too, so refresh either way: /api/data
      // comes back with needs_reauth and this card turns into "Reconnect".
      setNote("Scan failed. Try again.");
      onChanged?.();
      return;
    }
    setNote(res.detected > 0 ? null : t("scanFoundNone"));
    onChanged?.();
  };

  const disconnect = async () => {
    if (!token) return;
    setBusy(true);
    await gmailDisconnect(token);
    setBusy(false);
    onChanged?.();
  };

  const seg = (
    options: Array<{
      key: string;
      label: string;
      active: boolean;
      onPress: () => void;
    }>,
  ) => (
    <View
      style={[styles.seg, { backgroundColor: p.page, borderColor: p.border }]}
    >
      {options.map((o) => (
        <Pressable
          key={o.key}
          style={[styles.segBtn, o.active && { backgroundColor: p.accent }]}
          onPress={o.onPress}
        >
          <Text
            style={{
              fontSize: fs(13.5),
              fontWeight: o.active ? "600" : "400",
              color: o.active ? "#fff" : p.ink2,
            }}
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: p.surface, borderColor: p.border },
          ]}
        >
          <View style={[styles.grab, { backgroundColor: p.grid }]} />
          <ScrollView contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontSize: fs(18), fontWeight: "700", color: p.ink }}>
            ⚙️ {t("settings")}
          </Text>

          <View style={styles.row}>
            <Text style={{ fontSize: fs(14), color: p.ink2, flex: 1 }}>
              {t("language")}
            </Text>
            {seg(
              (
                [
                  { key: "en", label: "English" },
                  { key: "hi", label: "हिंदी" },
                ] as Array<{ key: Lang; label: string }>
              ).map((o) => ({
                ...o,
                active: lang === o.key,
                onPress: () => setLang(o.key),
              })),
            )}
          </View>

          <View style={styles.row}>
            <Text style={{ fontSize: fs(14), color: p.ink2, flex: 1 }}>
              {t("textSize")}
            </Text>
            {seg([
              {
                key: "normal",
                label: t("normal"),
                active: scale === 1,
                onPress: () => setLarge(false),
              },
              {
                key: "large",
                label: t("large"),
                active: scale > 1,
                onPress: () => setLarge(true),
              },
            ])}
          </View>

          {token && (
            <View style={[styles.block, { borderTopColor: p.border }]}>
              <Text
                style={{ fontSize: fs(14), fontWeight: "600", color: p.ink }}
              >
                📧{" "}
                {gmail?.needs_reauth
                  ? t("reconnectGmail")
                  : gmail?.connected
                    ? t("gmailConnected")
                    : t("connectGmail")}
              </Text>
              <Text
                style={{
                  fontSize: fs(12),
                  color: gmail?.needs_reauth ? "#c98500" : p.muted,
                  marginTop: 3,
                  lineHeight: 17,
                }}
              >
                {gmail?.needs_reauth
                  ? t("reauthNeeded")
                  : gmail?.connected
                    ? gmail.email
                    : t("gmailBlurb")}
              </Text>
              {note && (
                <Text
                  style={{ fontSize: fs(12.5), color: p.ink2, marginTop: 6 }}
                >
                  {note}
                </Text>
              )}
              {busy ? (
                <ActivityIndicator color={p.accent} style={{ marginTop: 10 }} />
              ) : (
                <View style={[styles.row, { marginTop: 10 }]}>
                  {gmail?.connected && !gmail.needs_reauth ? (
                    <>
                      <Pressable
                        style={[
                          styles.smallBtn,
                          { backgroundColor: p.accent, flex: 1 },
                        ]}
                        onPress={scan}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontWeight: "700",
                            fontSize: fs(13),
                          }}
                        >
                          {t("scanNow")}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.smallGhost, { borderColor: p.border }]}
                        onPress={disconnect}
                      >
                        <Text
                          style={{
                            color: p.ink2,
                            fontWeight: "600",
                            fontSize: fs(13),
                          }}
                        >
                          {t("disconnectGmail")}
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      style={[
                        styles.smallBtn,
                        { backgroundColor: p.accent, flex: 1 },
                      ]}
                      onPress={connect}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "700",
                          fontSize: fs(13),
                        }}
                      >
                        {gmail?.needs_reauth
                          ? t("reconnectGmail")
                          : t("connectGmail")}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          )}

          {/* v9: auto-capture from bank notifications (Android only). */}
          {token && capture.supported && (
            <View style={[styles.block, { borderTopColor: p.border }]}>
              <Text
                style={{ fontSize: fs(14), fontWeight: "600", color: p.ink }}
              >
                🔔 {t("autoCapture")}
              </Text>
              <Text
                style={{
                  fontSize: fs(12),
                  color: p.muted,
                  marginTop: 3,
                  lineHeight: 17,
                }}
              >
                {capture.granted ? t("captureOn") : t("captureBlurb")}
              </Text>
              {capture.granted && capture.pending > 0 && (
                <Text
                  style={{ fontSize: fs(12.5), color: p.ink2, marginTop: 6 }}
                >
                  {capture.pending} {t("capturePending")}
                </Text>
              )}
              {captureNote && (
                <Text
                  style={{ fontSize: fs(12.5), color: p.ink2, marginTop: 6 }}
                >
                  {captureNote}
                </Text>
              )}
              {capturing ? (
                <ActivityIndicator color={p.accent} style={{ marginTop: 10 }} />
              ) : (
                <View style={[styles.row, { marginTop: 10 }]}>
                  {capture.granted ? (
                    <Pressable
                      style={[
                        styles.smallBtn,
                        { backgroundColor: p.accent, flex: 1 },
                      ]}
                      onPress={syncNow}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "700",
                          fontSize: fs(13),
                        }}
                      >
                        {t("syncNow")}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[
                        styles.smallBtn,
                        { backgroundColor: p.accent, flex: 1 },
                      ]}
                      onPress={grantCapture}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "700",
                          fontSize: fs(13),
                        }}
                      >
                        {t("grantAccess")}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          )}

          {token && (
            <View style={[styles.block, { borderColor: p.grid, gap: 10 }]}>
              <Text style={{ fontSize: fs(14), fontWeight: "600", color: p.ink }}>
                🔒 {t("yourData")}
              </Text>
              <View style={styles.row}>
                <Pressable
                  style={[styles.smallBtn, { borderWidth: 1, borderColor: p.border, flex: 1 }]}
                  onPress={exportData}
                >
                  <Text style={{ color: p.ink, fontWeight: "600", fontSize: fs(13) }}>{t("exportData")}</Text>
                </Pressable>
                <Pressable
                  style={[styles.smallBtn, { borderWidth: 1, borderColor: p.border, flex: 1 }]}
                  onPress={() => Linking.openURL(`${API_BASE}/privacy`)}
                >
                  <Text style={{ color: p.ink, fontWeight: "600", fontSize: fs(13) }}>{t("privacyPolicy")}</Text>
                </Pressable>
              </View>
              {confirmDelete && (
                <Text style={{ fontSize: fs(12.5), color: "#d03b3b", lineHeight: 18 }}>
                  {t("deleteWarning")}
                </Text>
              )}
              <Pressable
                style={[
                  styles.smallBtn,
                  { borderWidth: 1, borderColor: "#d03b3b", backgroundColor: confirmDelete ? "#d03b3b" : "transparent" },
                ]}
                onPress={deleteAccount}
              >
                {dataBusy ? (
                  <ActivityIndicator color={confirmDelete ? "#fff" : "#d03b3b"} />
                ) : (
                  <Text style={{ color: confirmDelete ? "#fff" : "#d03b3b", fontWeight: "700", fontSize: fs(13) }}>
                    {confirmDelete ? t("deleteConfirm") : t("deleteAccount")}
                  </Text>
                )}
              </Pressable>
              {dataNote && <Text style={{ fontSize: fs(12.5), color: p.ink2 }}>{dataNote}</Text>}
            </View>
          )}

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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 16,
    maxHeight: "90%",
  },
  grab: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  seg: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 999 },
  btn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  block: { borderTopWidth: 1, paddingTop: 14 },
  smallBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  smallGhost: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: "center",
  },
});
