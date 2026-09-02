import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "./api";
import {
  captureSupported,
  drainCaptures,
  hasCapturePermission,
  pendingCaptures,
  type Capture,
} from "../modules/notification-capture";

/**
 * Uploading what the notification listener captured.
 *
 * The listener queues alerts on the device whether or not the app is open;
 * this drains that queue and posts it to /api/ingest, where the parsing,
 * deduplication and balance reconciliation happen. Anything that fails to
 * upload goes back on the queue, so a flaky connection loses nothing.
 */

const LAST_SYNC_KEY = "et_last_capture_sync";
const FAILED_KEY = "et_capture_retry";

export interface CaptureSyncResult {
  sent: number;
  logged: number;
  duplicates: number;
  ignored: number;
  needsReview: number;
  error: string | null;
}

const empty: CaptureSyncResult = {
  sent: 0,
  logged: 0,
  duplicates: 0,
  ignored: 0,
  needsReview: 0,
  error: null,
};

export function captureStatus(): {
  supported: boolean;
  granted: boolean;
  pending: number;
} {
  const supported = captureSupported;
  return {
    supported,
    granted: supported ? hasCapturePermission() : false,
    pending: supported ? pendingCaptures() : 0,
  };
}

export async function lastCaptureSync(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNC_KEY);
}

/**
 * Drain and upload. Safe to call on every foreground — with an empty queue
 * it does nothing and touches no network.
 */
export async function syncCaptures(token: string): Promise<CaptureSyncResult> {
  if (!captureSupported) return empty;

  const retries = await readRetries();
  const fresh = drainCaptures();
  const batch = [...retries, ...fresh];
  if (!batch.length) return empty;

  try {
    const res = await fetch(`${API_BASE}/api/ingest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "notification",
        messages: batch.map((c) => ({
          body: c.body,
          external_id: c.external_id,
          received_at: c.received_at,
        })),
      }),
    });

    if (!res.ok) {
      // 4xx means the server rejected this batch's shape — retrying forever
      // would wedge the queue, so only hold on to it for server errors.
      if (res.status >= 500) await keepForRetry(batch);
      return { ...empty, sent: batch.length, error: `HTTP ${res.status}` };
    }

    const body = (await res.json()) as {
      results?: Array<{ status: string }>;
    };
    await AsyncStorage.multiRemove([FAILED_KEY]);
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

    const results = body.results ?? [];
    return {
      sent: batch.length,
      logged: results.filter((r) => r.status === "logged").length,
      duplicates: results.filter((r) => r.status === "duplicate").length,
      ignored: results.filter((r) => r.status === "ignored").length,
      needsReview: results.filter((r) => r.status === "needs_review").length,
      error: null,
    };
  } catch (err) {
    // Offline or the request died mid-flight: the captures must not vanish.
    await keepForRetry(batch);
    return {
      ...empty,
      sent: batch.length,
      error: err instanceof Error ? err.message : "upload failed",
    };
  }
}

async function readRetries(): Promise<Capture[]> {
  try {
    const raw = await AsyncStorage.getItem(FAILED_KEY);
    return raw ? (JSON.parse(raw) as Capture[]) : [];
  } catch {
    return [];
  }
}

async function keepForRetry(batch: Capture[]): Promise<void> {
  try {
    // Cap it: a queue that grows forever while offline is its own problem.
    const trimmed = batch.slice(-200);
    await AsyncStorage.setItem(FAILED_KEY, JSON.stringify(trimmed));
  } catch {
    // If even this fails there's nothing sensible left to do.
  }
}
