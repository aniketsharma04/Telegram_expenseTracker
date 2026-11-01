import * as Updates from "expo-updates";
import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./Text";
import { Icon, PressableScale } from "./ui";
import { elevation, type Palette } from "../lib/theme";
import { useSettings } from "../lib/i18n";

/** Checks are cheap but rate-limited by Expo: at most one per this long. */
const CHECK_EVERY_MS = 5 * 60_000;

/**
 * Looks for a new over-the-air update on launch and whenever the app comes
 * back to the front, and shows "Update ready" with a button that downloads
 * it (if it isn't already) and restarts into it. No more "close it twice".
 * Does nothing in development or when updates are off.
 */
export function useUpdateCheck() {
  const last = useRef(0);
  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;
    const check = () => {
      const now = Date.now();
      if (now - last.current < CHECK_EVERY_MS) return;
      last.current = now;
      // The result lands in useUpdates(); a failed check just waits for the next one.
      Updates.checkForUpdateAsync().catch(() => {});
    };
    check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => sub.remove();
  }, []);
}

/** Download (if needed) and restart into the newest update. */
export async function applyUpdate(alreadyDownloaded: boolean): Promise<void> {
  if (!alreadyDownloaded) await Updates.fetchUpdateAsync();
  await Updates.reloadAsync({
    reloadScreenOptions: { backgroundColor: "#0f766e", fade: true },
  });
}

export function UpdateBanner({ p }: { p: Palette }) {
  const { fs } = useSettings();
  const insets = useSafeAreaInsets();
  const {
    isUpdateAvailable,
    isUpdatePending,
    isDownloading,
    downloadProgress,
  } = Updates.useUpdates();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [later, setLater] = useState(false);
  useUpdateCheck();

  if (later || !(isUpdateAvailable || isUpdatePending)) return null;

  const working = busy || isDownloading;
  const pct =
    isDownloading && downloadProgress != null
      ? ` ${Math.round(downloadProgress * 100)}%`
      : "";

  const onUpdate = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await applyUpdate(isUpdatePending);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + 8 }]}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.bar, { backgroundColor: p.surface }, elevation(p)]}>
        <Icon name="download-cloud" size={20} color={p.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.ink, fontWeight: "700", fontSize: fs(14) }}>
            {failed ? "Couldn't update" : "A new version of Aaj is ready"}
          </Text>
          <Text style={{ color: p.ink2, fontSize: fs(12.5) }}>
            {failed
              ? "Check your internet and try again."
              : working
                ? `Updating${pct}… the app restarts by itself.`
                : "Takes a few seconds. Nothing you've saved is lost."}
          </Text>
        </View>
        {!working && (
          <PressableScale
            onPress={() => setLater(true)}
            accessibilityRole="button"
            accessibilityLabel="Later"
            style={styles.later}
          >
            <Icon name="x" size={18} color={p.muted} />
          </PressableScale>
        )}
        <PressableScale
          onPress={onUpdate}
          disabled={working}
          accessibilityRole="button"
          accessibilityState={{ busy: working }}
          style={[
            styles.button,
            { backgroundColor: p.accent, opacity: working ? 0.6 : 1 },
          ]}
        >
          <Text
            style={{ color: p.onAccent, fontWeight: "700", fontSize: fs(13.5) }}
          >
            {working ? "…" : failed ? "Retry" : "Update"}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, zIndex: 50 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 16,
  },
  later: { padding: 6 },
  button: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12 },
});
