/**
 * What a UPI app said when it handed control back (v25).
 *
 * NPCI's intent spec has the payer app return a `response` string like
 * "txnId=…&responseCode=00&Status=SUCCESS&txnRef=…". Apps differ in where
 * they put it (an extra named "response", "Status" directly, or the data
 * URI) and in case, so this reads all of them. Anything unclear is
 * "unknown" — the app then asks the user instead of guessing, and the bank
 * alert settles it either way.
 */

export type UpiOutcome = "success" | "failure" | "pending" | "unknown";

export interface LaunchResult {
  resultCode?: number;
  data?: string;
  extra?: object;
}

function fields(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of text.replace(/^[^?]*\?/, "").split("&")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    // A UPI app's response is untrusted text: a bad escape must not throw.
    const decode = (x: string) => {
      try {
        return decodeURIComponent(x.replace(/\+/g, " ")).trim();
      } catch {
        return x.trim();
      }
    };
    out[decode(part.slice(0, i)).toLowerCase()] = decode(part.slice(i + 1));
  }
  return out;
}

export function parseUpiResult(r: LaunchResult | null | undefined): UpiOutcome {
  if (!r) return "unknown";
  const found: Record<string, string> = {};
  const extra = (r.extra ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(extra)) {
    if (typeof v !== "string") continue;
    if (k.toLowerCase() === "response") Object.assign(found, fields(v));
    else found[k.toLowerCase()] = v.trim();
  }
  if (typeof r.data === "string" && r.data.includes("="))
    Object.assign(found, fields(r.data));

  const status = (found.status ?? "").toUpperCase();
  if (status === "SUCCESS" || status === "S") return "success";
  if (status === "FAILURE" || status === "FAILED" || status === "F")
    return "failure";
  if (status === "SUBMITTED" || status === "PENDING") return "pending";
  // Some apps only send a response code: "00" is success in UPI.
  const code = found.responsecode ?? found.txnresponsecode;
  if (code === "00" || code === "0") return "success";
  if (code && /^[A-Z0-9]{2,3}$/i.test(code)) return "failure";
  return "unknown";
}
