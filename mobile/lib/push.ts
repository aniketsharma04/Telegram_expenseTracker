import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { API_BASE } from "./api";

/**
 * Push notifications (v15): the morning brief, the per-spend tally, the night
 * report and alerts arrive here — delivered by Expo's push service through
 * Firebase (Android) / APNs (iOS). Everything is also kept in the in-app inbox,
 * so a refused permission costs the user the ping, not the message.
 */

const TOKEN_KEY = "et_push_token";

/** Must match NoticeKind on the server — the server sends channelId = kind. */
const CHANNELS: Array<{
  id: string;
  name: string;
  description: string;
  importance: Notifications.AndroidImportance;
}> = [
  {
    id: "daily",
    name: "Daily budget",
    description: "Your morning number and the night report",
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  {
    id: "spend",
    name: "Spends",
    description: "Each captured payment and what's left today",
    importance: Notifications.AndroidImportance.LOW,
  },
  {
    id: "alerts",
    name: "Alerts",
    description: "Budgets crossed, bills due, unusual charges",
    importance: Notifications.AndroidImportance.HIGH,
  },
  {
    id: "digest",
    name: "Monthly review",
    description: "Your month in review on the 1st",
    importance: Notifications.AndroidImportance.DEFAULT,
  },
];

// Show pushes while the app is open too — the user is looking at the money
// screen, a banner is still the clearest "that just landed".
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  for (const c of CHANNELS) {
    await Notifications.setNotificationChannelAsync(c.id, {
      name: c.name,
      description: c.description,
      importance: c.importance,
    });
  }
}

export type PushState = "granted" | "denied" | "undetermined" | "unavailable";

export async function pushPermission(): Promise<PushState> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted"
      ? "granted"
      : status === "denied"
        ? "denied"
        : "undetermined";
  } catch {
    return "unavailable";
  }
}

/**
 * Ask (if needed), fetch this device's token and register it with the
 * server. Safe to call on every launch: the server upserts. `ask: false`
 * registers only when permission was already given — no surprise prompts.
 */
export async function registerForPush(
  sessionToken: string,
  { ask }: { ask: boolean },
): Promise<PushState> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return "unavailable";
  try {
    // Android 13+ only shows the permission prompt once a channel exists.
    await ensureChannels();
    let state = await pushPermission();
    if (state !== "granted" && ask && state !== "denied") {
      const res = await Notifications.requestPermissionsAsync();
      state = res.status === "granted" ? "granted" : "denied";
    }
    if (state !== "granted") return state;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as
      string | undefined;
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const res = await fetch(`${API_BASE}/api/push`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: pushToken, platform: Platform.OS }),
    });
    if (res.ok) await AsyncStorage.setItem(TOKEN_KEY, pushToken);
    return "granted";
  } catch (err) {
    // No Firebase config yet, offline, or an emulator without Play services:
    // the inbox still works, so this is never fatal.
    console.warn("push registration failed", err);
    return "unavailable";
  }
}

/** On logout: this phone stops receiving the old account's notices. */
export async function unregisterPush(sessionToken: string): Promise<void> {
  try {
    const pushToken = await AsyncStorage.getItem(TOKEN_KEY);
    if (!pushToken) return;
    await fetch(`${API_BASE}/api/push?token=${encodeURIComponent(pushToken)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${sessionToken.trim()}` },
    });
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Worst case the server prunes it when the next login re-registers the device.
  }
}

export interface PushTap {
  notificationId: string | null;
  kind: string | null;
  expenseId: string | null;
  bigSpend: boolean;
}

/** What a tapped push carried — read from the server's `data`. */
export function readTap(response: Notifications.NotificationResponse): PushTap {
  const d = (response.notification.request.content.data ?? {}) as Record<
    string,
    unknown
  >;
  return {
    notificationId:
      typeof d.notificationId === "string" ? d.notificationId : null,
    kind: typeof d.kind === "string" ? d.kind : null,
    expenseId: typeof d.expenseId === "string" ? d.expenseId : null,
    bigSpend: d.bigSpend === true,
  };
}
