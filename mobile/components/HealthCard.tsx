import { useEffect, useState } from "react";
import { AppState, Linking, Pressable, StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { Card } from "./ui";
import { useSettings } from "../lib/i18n";
import { Palette } from "../lib/theme";
import {
  gmailConnectUrl,
  type CaptureHealth,
  type GmailStatus,
} from "../lib/api";
import { captureStatus, connectCapture, syncCaptures } from "../lib/capture";
import {
  captureDiagnostics,
  openAppSettings,
  openCaptureSettings,
} from "../modules/notification-capture";
import { explainCapture } from "../lib/capture-diag";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Something that feeds Aaj has stopped, and the user can fix it.
 *
 * Both failures are silent otherwise: Android can stop passing bank alerts
 * (after a reinstall or update) while still reporting access as granted, and
 * Google drops the Gmail connection every 7 days while the OAuth app is
 * unpublished. The server tells us when alerts last arrived (`capture.quiet`)
 * and whether Gmail needs reconnecting; this card stays on Home until fixed.
 * Missing access entirely is CaptureSetupCard's job, not this one's.
 */
export function HealthCard({
  p,
  token,
  capture,
  gmail,
  onChanged,
}: {
  p: Palette;
  token: string;
  capture?: CaptureHealth | null;
  gmail?: GmailStatus;
  onChanged: () => void;
}) {
  const { fs } = useSettings();
  const [status, setStatus] = useState(captureStatus);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Back from a settings screen: re-link the listener and re-check.
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") return;
      const next = captureStatus();
      setStatus(next);
      if (next.granted) connectCapture(token);
    });
    return () => sub.remove();
  }, [token]);

  // Two witnesses: the server (nothing arrived for 2 days) and, on v22+
  // builds, the phone itself (reader stopped, uploads failing, silence).
  // Missing access is CaptureSetupCard's job, so that verdict is skipped.
  const verdict =
    status.supported && status.granted
      ? explainCapture(captureDiagnostics(), true)
      : null;
  const phoneSaysDown = Boolean(verdict && !verdict.ok);
  const captureDown =
    status.supported &&
    status.granted &&
    (Boolean(capture?.quiet) || phoneSaysDown);
  const gmailDown = Boolean(gmail?.needs_reauth);
  if (!captureDown && !gmailDown) return null;

  const sendWaiting = async () => {
    setBusy(true);
    const r = await syncCaptures(token);
    setBusy(false);
    setStatus(captureStatus());
    if (r.error)
      setNote(
        `Couldn't send them (${r.error}). Check your internet and try again.`,
      );
    else {
      setNote(`Sent ${r.sent}. ${r.logged} logged.`);
      onChanged();
    }
  };

  const reconnectGmail = async () => {
    setNote(null);
    const url = await gmailConnectUrl(token);
    if (!url) {
      setNote("Couldn't start the Gmail connection. Try again in a minute.");
      return;
    }
    Linking.openURL(url).catch(() => setNote("Couldn't open the browser."));
  };

  const title = { fontSize: fs(15), fontWeight: "700" as const, color: p.ink };
  const body = { fontSize: fs(13), color: p.ink2, lineHeight: 19 };

  return (
    <Card p={p} style={{ gap: 12, borderColor: p.warn, borderWidth: 1 }}>
      {captureDown && (
        <View style={{ gap: 8 }}>
          <Text style={title}>
            {capture?.quiet && capture.last_at
              ? `No bank alerts since ${shortDate(capture.last_at)}`
              : (verdict?.title ?? "Bank alerts aren't reaching Aaj")}
          </Text>
          {phoneSaysDown && verdict && (
            <Text style={{ ...body, color: p.warn }}>
              On this phone: {verdict.detail}
            </Text>
          )}
          <Text style={body}>
            Android has stopped passing your bank and UPI alerts to Aaj, so new
            spends aren't being logged. This usually happens after installing a
            new version of the app.
          </Text>
          <Text style={body}>
            {
              "1. Tap Open notification access.\n2. Turn Aaj off, then on again.\n3. Switch greyed out? Tap Open app info → ⋮ → Allow restricted settings, then try again."
            }
          </Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.cta, { backgroundColor: p.accent }]}
              onPress={openCaptureSettings}
            >
              <Text
                style={{ color: "#fff", fontWeight: "700", fontSize: fs(13.5) }}
              >
                Open notification access
              </Text>
            </Pressable>
            <Pressable
              style={[styles.small, { borderColor: p.accent }]}
              onPress={openAppSettings}
            >
              <Text
                style={{ color: p.accent, fontWeight: "600", fontSize: fs(13) }}
              >
                Open app info
              </Text>
            </Pressable>
          </View>
          {status.pending > 0 && (
            <Pressable
              disabled={busy}
              style={[
                styles.small,
                { borderColor: p.accent, alignSelf: "flex-start" },
              ]}
              onPress={sendWaiting}
            >
              <Text
                style={{ color: p.accent, fontWeight: "600", fontSize: fs(13) }}
              >
                {busy
                  ? "Sending…"
                  : `Send ${status.pending} waiting alert${status.pending > 1 ? "s" : ""}`}
              </Text>
            </Pressable>
          )}
          <Text style={{ fontSize: fs(12), color: p.muted }}>
            This card goes away when the next bank alert reaches Aaj.
          </Text>
        </View>
      )}

      {gmailDown && (
        <View style={{ gap: 8 }}>
          <Text style={title}>Gmail is disconnected</Text>
          <Text style={body}>
            Google ended the connection, so bills and payments in your email
            aren't being read. Reconnect to pick up where it stopped.
          </Text>
          <Pressable
            style={[
              styles.cta,
              { backgroundColor: p.accent, alignSelf: "flex-start" },
            ]}
            onPress={reconnectGmail}
          >
            <Text
              style={{ color: "#fff", fontWeight: "700", fontSize: fs(13.5) }}
            >
              Reconnect Gmail
            </Text>
          </Pressable>
        </View>
      )}

      {note && (
        <Text style={{ fontSize: fs(12.5), color: p.ink2 }}>{note}</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
  cta: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  small: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
});
