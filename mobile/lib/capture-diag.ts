/**
 * What's wrong with capture, in words (v22).
 *
 * When alerts stopped reaching Aaj for five days (Oct–Nov 2026) nothing could
 * say whether Android had stopped the listener, uploads were failing, or no
 * bank alert had arrived. The native side now keeps a few timestamps; this
 * turns them into one verdict the user can act on. Pure, so it's tested.
 */

/** Same shape as the native module's diagnostics(); epoch ms, 0 = never. */
export interface Diagnostics {
  lastSeen: number;
  lastCaptured: number;
  connectedAt: number;
  disconnectedAt: number;
  uploadAt: number;
  uploadResult: string;
  pending: number;
  signedIn: boolean;
}

export type CaptureState =
  | "ok"
  | "waiting"
  | "no-access"
  | "signed-out"
  | "not-running"
  | "silent"
  | "upload-failing";

export interface Verdict {
  state: CaptureState;
  /** Healthy states don't need the user. */
  ok: boolean;
  title: string;
  detail: string;
}

const HOUR = 3_600_000;
/** People get notifications from SMS/UPI apps daily; two silent days is a fault. */
const SILENT_HOURS = 48;

export function ago(ms: number, now: number): string {
  const h = (now - ms) / HOUR;
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

function uploadFailed(result: string): boolean {
  return result !== "" && !/^2\d\d$/.test(result);
}

export function explainCapture(
  d: Diagnostics | null,
  granted: boolean,
  now: number = Date.now(),
): Verdict | null {
  if (!granted)
    return {
      state: "no-access",
      ok: false,
      title: "Notification access is off",
      detail:
        "Aaj can't see your bank and UPI alerts. Turn on notification access for Aaj.",
    };
  // Older builds have no diagnostics; say nothing rather than guess.
  if (!d) return null;

  if (!d.signedIn)
    return {
      state: "signed-out",
      ok: false,
      title: "Alerts can't be sent",
      detail:
        "This phone isn't signed in for background sending. Open Aaj once while signed in.",
    };

  if (d.pending > 0 && uploadFailed(d.uploadResult))
    return {
      state: "upload-failing",
      ok: false,
      title: `${d.pending} alert${d.pending > 1 ? "s" : ""} waiting to be sent`,
      detail:
        d.uploadResult === "offline"
          ? "The last try had no internet. They'll go as soon as you're online."
          : d.uploadResult === "401" || d.uploadResult === "403"
            ? "The server didn't accept this phone's sign-in. Sign out and in again."
            : `The server answered ${d.uploadResult}. Aaj will keep retrying.`,
    };

  if (d.disconnectedAt > d.connectedAt)
    return {
      state: "not-running",
      ok: false,
      title: "Android stopped Aaj's alert reader",
      detail: `Stopped ${ago(d.disconnectedAt, now)}. Turn Aaj's notification access off and on again to restart it.`,
    };

  if (!d.lastSeen)
    return {
      state: "waiting",
      ok: true,
      title: "Waiting for the first alert",
      detail: "Aaj will start logging with the next bank or UPI notification.",
    };

  if (now - d.lastSeen > SILENT_HOURS * HOUR)
    return {
      state: "silent",
      ok: false,
      title: "No alerts reaching Aaj",
      detail: `Nothing from your SMS, bank or UPI apps since ${ago(d.lastSeen, now)}. Android may have stopped the reader: turn Aaj's notification access off and on again.`,
    };

  return {
    state: "ok",
    ok: true,
    title: "Working",
    detail: d.lastCaptured
      ? `Last payment alert ${ago(d.lastCaptured, now)}.`
      : `Reading alerts. Last one ${ago(d.lastSeen, now)}.`,
  };
}
