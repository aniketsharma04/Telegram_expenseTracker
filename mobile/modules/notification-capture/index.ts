import { NativeModule, requireNativeModule } from "expo";
import { Platform } from "react-native";

/**
 * Notification capture — the Android half of auto-logging.
 *
 * The native listener queues bank alerts locally; this module is how the app
 * checks permission, sends the user to grant it, and drains what's waiting.
 * Nothing leaves the device from native code — the upload happens in
 * lib/capture.ts with the user's session token.
 */

export interface Capture {
  /** Full notification text (title + body). */
  body: string;
  /** Which app it came from, e.g. "com.google.android.apps.messaging". */
  package: string;
  /** Stable id, so re-delivering the same alert can't log it twice. */
  external_id: string;
  /** Epoch milliseconds. */
  received_at: number;
}

type CaptureEvents = {
  onCapture(event: { pending: number }): void;
};

declare class NotificationCaptureModule extends NativeModule<CaptureEvents> {
  hasPermission(): boolean;
  openSettings(): void;
  pendingCount(): number;
  drain(): Capture[];
  getWatchedPackages(): string[];
  setWatchedPackages(packages: string[]): void;
}

/**
 * Absent on iOS, in Expo Go, and in any build made before this module
 * existed — every caller must cope with null rather than crashing the app.
 */
const native: NotificationCaptureModule | null =
  Platform.OS === "android"
    ? (() => {
        try {
          return requireNativeModule<NotificationCaptureModule>(
            "NotificationCapture",
          );
        } catch {
          return null;
        }
      })()
    : null;

/** True when this build can capture at all (Android, module present). */
export const captureSupported = native !== null;

export function hasCapturePermission(): boolean {
  try {
    return native?.hasPermission() ?? false;
  } catch {
    return false;
  }
}

export function openCaptureSettings(): void {
  native?.openSettings();
}

export function pendingCaptures(): number {
  try {
    return native?.pendingCount() ?? 0;
  } catch {
    return 0;
  }
}

export function drainCaptures(): Capture[] {
  try {
    return native?.drain() ?? [];
  } catch {
    return [];
  }
}

export function watchedPackages(): string[] {
  try {
    return native?.getWatchedPackages() ?? [];
  } catch {
    return [];
  }
}

export function setWatchedPackages(packages: string[]): void {
  native?.setWatchedPackages(packages);
}

/** Fires when a capture lands while the app is open. Returns an unsubscribe. */
export function onCapture(listener: (pending: number) => void): () => void {
  if (!native) return () => {};
  const subscription = native.addListener("onCapture", (event) =>
    listener(event.pending),
  );
  return () => subscription.remove();
}

export default native;
