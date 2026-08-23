/**
 * Minimal Gmail REST client (v7) — read-only access to the user's own inbox
 * so bills that arrive by email can be detected without any BBPS onboarding.
 *
 * Plain `fetch` rather than googleapis: we need four endpoints and the SDK is
 * ~10 MB of dependency for them.
 *
 * Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL (for the redirect URI).
 * Scope: gmail.readonly only — the app can never send, label, or delete mail.
 */

const OAUTH_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN = "https://oauth2.googleapis.com/token";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function gmailConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

export function redirectUri(): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${base}/api/gmail/callback`;
}

/** Consent-screen URL. `state` carries our signed session token back. */
export function authUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline", // we need a refresh token for the daily cron
    prompt: "consent", // force a refresh token even on re-consent
    include_granted_scopes: "true",
    state,
  });
  return `${OAUTH_AUTH}?${params}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(
  body: Record<string, string>,
): Promise<TokenResponse> {
  const res = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error)
    throw new Error(
      `Google OAuth: ${json.error_description || json.error || `HTTP ${res.status}`}`,
    );
  return json;
}

/** Consent code → refresh token + the address that was connected. */
export async function exchangeCode(code: string): Promise<{
  refreshToken: string;
  accessToken: string;
  email: string;
  scope: string;
}> {
  const tok = await tokenRequest({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
  if (!tok.refresh_token)
    throw new Error(
      "Google didn't return a refresh token — revoke the app at myaccount.google.com/permissions and connect again",
    );
  const profile = await gmailGet<{ emailAddress?: string }>(
    tok.access_token!,
    "/profile",
  );
  return {
    refreshToken: tok.refresh_token,
    accessToken: tok.access_token!,
    email: profile.emailAddress ?? "",
    scope: tok.scope ?? GMAIL_SCOPE,
  };
}

// Access tokens live an hour; a cron pass reuses one across many calls.
const accessCache = new Map<string, { token: string; expiresAt: number }>();

export async function accessToken(refreshToken: string): Promise<string> {
  const hit = accessCache.get(refreshToken);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;
  const tok = await tokenRequest({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: "refresh_token",
  });
  if (!tok.access_token) throw new Error("Google OAuth: no access token");
  accessCache.set(refreshToken, {
    token: tok.access_token,
    expiresAt: Date.now() + (tok.expires_in ?? 3600) * 1000,
  });
  return tok.access_token;
}

async function gmailGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `HTTP ${res.status}`;
    try {
      msg =
        (JSON.parse(text) as { error?: { message?: string } })?.error
          ?.message ?? msg;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`Gmail ${path}: ${msg}`);
  }
  return (await res.json()) as T;
}

/** Message ids matching a Gmail search query, newest first. */
export async function listMessageIds(
  token: string,
  query: string,
  max = 40,
): Promise<string[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(Math.min(max, 100)),
  });
  const body = await gmailGet<{ messages?: Array<{ id: string }> }>(
    token,
    `/messages?${params}`,
  );
  return (body.messages ?? []).map((m) => m.id);
}

export interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  date: string; // RFC 2822 as sent
  snippet: string;
  body: string; // plain text, HTML stripped
}

interface RawPart {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number };
  parts?: RawPart[];
}

function decodeB64Url(data: string): string {
  return Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
}

/** Strip tags/styles from an HTML part down to readable text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8377;|&rupee;/gi, "₹")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Depth-first walk preferring text/plain; falls back to the HTML part. */
export function extractBody(payload: RawPart | undefined): string {
  if (!payload) return "";
  const plain: string[] = [];
  const html: string[] = [];
  const walk = (part: RawPart) => {
    if (part.filename) return; // attachments are never the bill text we want
    const data = part.body?.data;
    if (data) {
      if (part.mimeType === "text/plain") plain.push(decodeB64Url(data));
      else if (part.mimeType === "text/html") html.push(decodeB64Url(data));
    }
    for (const child of part.parts ?? []) walk(child);
  };
  walk(payload);
  const text = plain.length ? plain.join("\n") : htmlToText(html.join("\n"));
  return text.replace(/\r/g, "").trim();
}

export async function getMessage(
  token: string,
  id: string,
): Promise<GmailMessage> {
  const msg = await gmailGet<{
    id: string;
    snippet?: string;
    payload?: RawPart & { headers?: Array<{ name: string; value: string }> };
  }>(token, `/messages/${id}?format=full`);
  const header = (name: string) =>
    msg.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value ??
    "";
  return {
    id: msg.id,
    subject: header("subject"),
    from: header("from"),
    date: header("date"),
    snippet: msg.snippet ?? "",
    body: extractBody(msg.payload),
  };
}
