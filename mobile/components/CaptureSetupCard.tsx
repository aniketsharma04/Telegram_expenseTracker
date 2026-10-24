import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { captureStatus, connectCapture } from "../lib/capture";
import { useSettings } from "../lib/i18n";
import { Palette } from "../lib/theme";
import {
  openAppSettings,
  openBatterySettings,
  openCaptureSettings,
} from "../modules/notification-capture";
import { Card } from "./ui";

const AUTOSTART_DONE_KEY = "et_autostart_done";

/** Phones known to kill background apps unless "Autostart" is on. */
const AGGRESSIVE_OEMS = /xiaomi|redmi|poco|oppo|realme|vivo|iqoo|oneplus|honor|huawei/i;

function manufacturer(): string {
  // Autostart only exists on Android phones; elsewhere the constants differ or are absent.
  if (Platform.OS !== "android") return "";
  try {
    const c = Platform.constants as { Manufacturer?: string; Brand?: string };
    return `${c?.Manufacturer ?? ""} ${c?.Brand ?? ""}`;
  } catch {
    return "";
  }
}

/**
 * Getting automatic capture working (v15). It's the whole app — without it
 * the daily number is fiction — so this sits on Home until it's done.
 *
 * Step 1 is also Google Play's "prominent disclosure": what is read and where
 * it goes, shown before the user is sent to grant notification access.
 */
export function CaptureSetupCard({ p, token }: { p: Palette; token: string }) {
  const { t, fs } = useSettings();
  const [status, setStatus] = useState(captureStatus);
  const [autostartDone, setAutostartDone] = useState(true);
  const needsAutostart = AGGRESSIVE_OEMS.test(manufacturer());

  useEffect(() => {
    AsyncStorage.getItem(AUTOSTART_DONE_KEY).then((v) => setAutostartDone(v === "1"));
    // Coming back from a system settings screen is when things change.
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const next = captureStatus();
      setStatus(next);
      if (next.granted) connectCapture(token);
    });
    return () => sub.remove();
  }, [token]);

  if (!status.supported) return null;
  const steps = [
    { done: status.granted, show: true },
    { done: !status.batteryOptimized, show: status.granted },
    { done: autostartDone, show: status.granted && needsAutostart },
  ];
  if (steps.every((s) => !s.show || s.done)) return null;

  return (
    <Card p={p} style={{ gap: 12 }}>
      <Text style={{ fontSize: fs(15), fontWeight: "700", color: p.ink }}>{t("setupTitle")}</Text>

      {!status.granted ? (
        <>
          <Text style={{ fontSize: fs(13), color: p.ink2, lineHeight: 19 }}>{t("setupDisclosure")}</Text>
          <Pressable style={[styles.cta, { backgroundColor: p.accent }]} onPress={openCaptureSettings}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: fs(14) }}>{t("agreeTurnOn")}</Text>
          </Pressable>
          <Text style={{ fontSize: fs(12), color: p.muted }}>{t("grantHint")}</Text>
        </>
      ) : (
        <View style={{ gap: 10 }}>
          <Step p={p} n={1} title={t("setupStep1")} done />
          <Step
            p={p}
            n={2}
            title={t("setupStep2")}
            hint={t("setupStep2Hint")}
            done={!status.batteryOptimized}
            action={t("open")}
            onAction={openBatterySettings}
          />
          {needsAutostart && (
            <Step
              p={p}
              n={3}
              title={t("setupStep3")}
              hint={t("setupStep3Hint")}
              done={autostartDone}
              action={t("open")}
              onAction={openAppSettings}
              // Android can't tell us whether Autostart is on — the user confirms.
              onConfirm={() => {
                setAutostartDone(true);
                AsyncStorage.setItem(AUTOSTART_DONE_KEY, "1");
              }}
              confirmLabel={t("setupDone")}
            />
          )}
        </View>
      )}
    </Card>
  );
}

function Step({
  p,
  n,
  title,
  hint,
  done,
  action,
  onAction,
  onConfirm,
  confirmLabel,
}: {
  p: Palette;
  n: number;
  title: string;
  hint?: string;
  done: boolean;
  action?: string;
  onAction?: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
}) {
  const { fs } = useSettings();
  return (
    <View style={styles.step}>
      <View style={[styles.dot, { backgroundColor: done ? p.good : p.grid }]}>
        <Text style={{ color: done ? "#fff" : p.ink2, fontSize: 12, fontWeight: "700" }}>{done ? "✓" : n}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: fs(14), fontWeight: "600", color: done ? p.muted : p.ink }}>{title}</Text>
        {!done && hint && <Text style={{ fontSize: fs(12.5), color: p.ink2, lineHeight: 18 }}>{hint}</Text>}
        {!done && (action || onConfirm) && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            {action && onAction && (
              <Pressable style={[styles.small, { borderColor: p.accent }]} onPress={onAction}>
                <Text style={{ color: p.accent, fontWeight: "600", fontSize: fs(13) }}>{action}</Text>
              </Pressable>
            )}
            {onConfirm && confirmLabel && (
              <Pressable style={[styles.small, { borderColor: p.border }]} onPress={onConfirm}>
                <Text style={{ color: p.ink2, fontWeight: "600", fontSize: fs(13) }}>{confirmLabel}</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cta: { borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  step: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
  small: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
});
