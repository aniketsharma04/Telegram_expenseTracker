import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE, ApiData } from "./api";

/**
 * Offline-first data (v18): the last good /api/data payload is kept on the
 * phone, so the app opens straight onto real numbers instead of a spinner,
 * and still shows them with no signal. Refreshes ask the server "anything
 * new?" with the cached ETag and usually get a bodyless 304 back.
 */

const KEY = "et_data_cache_v1";

export interface CachedData {
  data: ApiData;
  etag: string | null;
  /** When the server last confirmed this data (ms). */
  savedAt: number;
}

export async function readCache(): Promise<CachedData | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedData;
    return parsed?.data ? parsed : null;
  } catch {
    return null;
  }
}

async function writeCache(entry: CachedData): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    // A full disk only costs the instant start next time.
  }
}

/** On logout or account deletion — the next person on this phone sees nothing. */
export async function clearCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}

export type FetchOutcome =
  | { kind: "fresh"; entry: CachedData }
  | { kind: "unchanged"; entry: CachedData }
  | { kind: "unauthorized" }
  | { kind: "offline" };

/** Fetch /api/data, reusing `current` when the server says nothing changed. */
export async function fetchDataCached(
  token: string,
  current: CachedData | null,
): Promise<FetchOutcome> {
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token.trim()}`,
    };
    if (current?.etag) headers["If-None-Match"] = current.etag;
    const res = await fetch(`${API_BASE}/api/data`, { headers });
    if (res.status === 401) return { kind: "unauthorized" };
    if (res.status === 304 && current) {
      const entry = { ...current, savedAt: Date.now() };
      await writeCache(entry);
      return { kind: "unchanged", entry };
    }
    if (!res.ok) return { kind: "offline" };
    const entry: CachedData = {
      data: (await res.json()) as ApiData,
      etag: res.headers.get("etag"),
      savedAt: Date.now(),
    };
    await writeCache(entry);
    return { kind: "fresh", entry };
  } catch {
    return { kind: "offline" };
  }
}

/** "10:42 AM" for the offline note. */
export function savedTime(ms: number): string {
  const d = new Date(ms);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const am = h < 12;
  h = h % 12 || 12;
  return `${h}:${m} ${am ? "AM" : "PM"}`;
}
