/**
 * Sandbox smoke-test + shape probe for the Setu BBPS adapter.
 *
 *   npm run setu-check              # auth + biller directory probe
 *   npm run setu-check -- --fetch <billerId> <param=value> [param=value...]
 *
 * Reads SETU_* from .env.local (or the environment). Prints the raw response
 * envelopes so the VERIFY comments in src/lib/bbps/setu.ts can be settled
 * against real responses.
 */
import { readFileSync } from "node:fs";

// .env.local loader — Next does this for the app, plain node does not.
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* no .env.local — rely on the environment */
}

const BASE = process.env.SETU_BASE_URL || "https://sandbox-coudc.setu.co";
const { SETU_CLIENT_ID, SETU_CLIENT_SECRET, SETU_PARTNER_ID, SETU_AGENT_ID } =
  process.env;

const missing = ["SETU_CLIENT_ID", "SETU_CLIENT_SECRET", "SETU_PARTNER_ID"].filter(
  (k) => !process.env[k],
);
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`Base URL   : ${BASE}`);
console.log(`Partner ID : ${SETU_PARTNER_ID}`);
console.log(`Client ID  : ${SETU_CLIENT_ID.slice(0, 6)}…`);
console.log(`Agent ID   : ${SETU_AGENT_ID || "(none — sending empty)"}`);

const shape = (v, depth = 0) => {
  if (v === null || v === undefined) return String(v);
  if (Array.isArray(v))
    return v.length === 0
      ? "[]"
      : `[${v.length} × ${depth > 2 ? "…" : shape(v[0], depth + 1)}]`;
  if (typeof v === "object")
    return depth > 2
      ? "{…}"
      : `{ ${Object.entries(v)
          .map(([k, val]) => `${k}: ${shape(val, depth + 1)}`)
          .join(", ")} }`;
  return typeof v;
};

// ── 1. auth ────────────────────────────────────────────────────────────────
const authRes = await fetch(`${BASE}/api/v2/auth/token`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ clientID: SETU_CLIENT_ID, secret: SETU_CLIENT_SECRET }),
});
const authText = await authRes.text();
console.log(`\n── auth ── HTTP ${authRes.status}`);
let auth;
try {
  auth = JSON.parse(authText);
} catch {
  console.error(authText.slice(0, 500));
  process.exit(1);
}
console.log(`envelope: ${shape(auth)}`);
const jwt = auth.token ?? auth.data?.token ?? auth.access_token;
if (!jwt) {
  console.error("No token found in the auth response:", authText.slice(0, 500));
  process.exit(1);
}
console.log(`token ok (${jwt.length} chars)`);

const call = async (path, init = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-PARTNER-ID": SETU_PARTNER_ID,
      Authorization: `Bearer ${jwt}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json, text };
};

// ── 2. biller directory (VERIFY: path, pagination params, envelope) ────────
const paths = [
  "/api/v2/bbps/billers?limit=5&offset=0",
  "/api/v2/bbps/billers?limit=5&page=1",
  "/api/v2/bbps/billers",
  "/api/v2/bbps/categories",
];
for (const p of paths) {
  const { status, json, text } = await call(p);
  console.log(`\n── GET ${p} ── HTTP ${status}`);
  if (json) console.log(`envelope: ${shape(json)}`);
  else console.log(text.slice(0, 300));
  if (status === 200 && json) {
    const list = Array.isArray(json)
      ? json
      : Array.isArray(json.data)
        ? json.data
        : (json.data?.billers ?? json.billers ?? []);
    if (list.length) {
      console.log("first item:");
      console.log(JSON.stringify(list[0], null, 2).slice(0, 1500));
      break;
    }
  }
}

// ── 3. optional bill fetch ─────────────────────────────────────────────────
const argv = process.argv.slice(2);
const fi = argv.indexOf("--fetch");
if (fi !== -1) {
  const billerId = argv[fi + 1];
  const customerParams = argv.slice(fi + 2).map((kv) => {
    const i = kv.indexOf("=");
    return { name: kv.slice(0, i), value: kv.slice(i + 1) };
  });
  if (!billerId) {
    console.error("\n--fetch needs a biller id");
    process.exit(1);
  }
  const req = await call("/api/v2/bbps/bills/fetch/request", {
    method: "POST",
    body: JSON.stringify({
      agent: { id: SETU_AGENT_ID ?? "", channel: "MOB" },
      biller: { id: billerId },
      customer: {
        mobile: process.env.SETU_DEFAULT_MOBILE ?? "9999999999",
        customerParams,
      },
    }),
  });
  console.log(`\n── POST bills/fetch/request ── HTTP ${req.status}`);
  console.log(JSON.stringify(req.json ?? req.text, null, 2).slice(0, 1500));
  const refId = req.json?.data?.refId ?? req.json?.refId;
  if (refId) {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 800 : 1200));
      const poll = await call("/api/v2/bbps/bills/fetch/response", {
        method: "POST",
        body: JSON.stringify({ refId }),
      });
      const status = (poll.json?.data?.status ?? poll.json?.status ?? "")
        .toString()
        .toLowerCase();
      console.log(`\n── poll ${i + 1} ── HTTP ${poll.status} status=${status}`);
      if (status === "processing" || status === "pending") continue;
      console.log(JSON.stringify(poll.json ?? poll.text, null, 2).slice(0, 2500));
      break;
    }
  }
}
