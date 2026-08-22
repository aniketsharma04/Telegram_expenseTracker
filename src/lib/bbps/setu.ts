import { SupabaseClient } from "@supabase/supabase-js";
import type { BbpsProvider, Biller, BillerParam, FetchResult } from "./types";

/**
 * Setu BBPS COU adapter (docs.setu.co/payments/billpay).
 *
 * Auth: POST /api/v2/auth/token {clientID, secret} → JWT (600s), sent as
 * `Authorization: Bearer` with `X-PARTNER-ID`. Bill fetch is async: request
 * returns a refId, then poll /bills/fetch/response until Success/Failure.
 * Amounts on the wire are paise.
 *
 * Env: SETU_CLIENT_ID, SETU_CLIENT_SECRET, SETU_PARTNER_ID,
 *      SETU_BASE_URL (default sandbox), SETU_AGENT_ID (given at onboarding).
 *
 * Field names follow the published objects reference; anything marked
 * VERIFY should be checked once against the Bridge playground with real keys.
 */

const DEFAULT_BASE = "https://sandbox-coudc.setu.co";

export function setuConfigured(): boolean {
  return Boolean(
    process.env.SETU_CLIENT_ID &&
    process.env.SETU_CLIENT_SECRET &&
    process.env.SETU_PARTNER_ID,
  );
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function token(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000)
    return cachedToken.token;
  const base = process.env.SETU_BASE_URL || DEFAULT_BASE;
  const res = await fetch(`${base}/api/v2/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientID: process.env.SETU_CLIENT_ID,
      secret: process.env.SETU_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Setu auth failed: HTTP ${res.status}`);
  const body = (await res.json()) as {
    token?: string;
    expiresIn?: number;
    success?: boolean;
  };
  if (!body.token) throw new Error("Setu auth: no token in response");
  cachedToken = {
    token: body.token,
    expiresAt: Date.now() + (body.expiresIn ?? 600) * 1000,
  };
  return body.token;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = process.env.SETU_BASE_URL || DEFAULT_BASE;
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-PARTNER-ID": process.env.SETU_PARTNER_ID!,
      Authorization: `Bearer ${await token()}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const msg =
      (json as { error?: { message?: string }; message?: string } | null)?.error
        ?.message ??
      (json as { message?: string } | null)?.message ??
      `HTTP ${res.status}`;
    throw new Error(`Setu ${path}: ${msg}`);
  }
  return json as T;
}

// ── Raw Setu shapes (subset) ────────────────────────────────────────────────

interface SetuParam {
  paramName: string;
  dataType: "NUMERIC" | "ALPHANUMERIC";
  regex?: string;
  minLength?: number | null;
  maxLength?: number | null;
  optional?: boolean;
  visibility?: boolean;
}

interface SetuBiller {
  id: string;
  name: string;
  categoryName: string;
  customerParams?: SetuParam[]; // VERIFY: may be `paramInfo` on list responses
  paramInfo?: SetuParam[];
}

interface SetuBill {
  amount: number; // paise
  dueDate?: string;
  billDate?: string;
  billNumber?: string;
  customerName?: string;
}

function normalizeBiller(b: SetuBiller): Biller {
  const params = (b.customerParams ?? b.paramInfo ?? [])
    .filter((p) => p.visibility !== false)
    .map<BillerParam>((p) => ({
      name: p.paramName,
      dataType: p.dataType === "NUMERIC" ? "NUMERIC" : "ALPHANUMERIC",
      regex: p.regex,
      minLength: p.minLength ?? null,
      maxLength: p.maxLength ?? null,
      optional: Boolean(p.optional),
    }));
  return { id: b.id, name: b.name, category: b.categoryName, params };
}

/** Pull the full biller directory (paged) — used by the daily cache sync. */
export async function listAllSetuBillers(): Promise<Biller[]> {
  const out: Biller[] = [];
  let offset = 0;
  const limit = 1000;
  for (let page = 0; page < 50; page++) {
    // VERIFY pagination params against the reference; defensive about the envelope.
    const body = await call<{
      data?: { billers?: SetuBiller[] } | SetuBiller[];
      billers?: SetuBiller[];
    }>(`/api/v2/bbps/billers?limit=${limit}&offset=${offset}`);
    const list: SetuBiller[] = Array.isArray(body.data)
      ? body.data
      : (body.data?.billers ?? body.billers ?? []);
    out.push(...list.map(normalizeBiller));
    if (list.length < limit) break;
    offset += limit;
  }
  return out;
}

export class SetuBbpsProvider implements BbpsProvider {
  readonly name = "setu" as const;
  constructor(private supabase: SupabaseClient) {}

  async categories(): Promise<string[]> {
    const { data } = await this.supabase
      .from("bbps_billers")
      .select("category");
    return [...new Set((data ?? []).map((r) => r.category as string))].sort();
  }

  async searchBillers(
    query: string,
    category?: string | null,
    limit = 25,
  ): Promise<Biller[]> {
    let q = this.supabase
      .from("bbps_billers")
      .select("id, name, category, params")
      .limit(limit);
    if (category) q = q.eq("category", category);
    if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
    const { data, error } = await q.order("name");
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      params: (r.params ?? []) as BillerParam[],
    }));
  }

  async getBiller(id: string): Promise<Biller | null> {
    const { data } = await this.supabase
      .from("bbps_billers")
      .select("id, name, category, params")
      .eq("id", id)
      .limit(1);
    const r = data?.[0];
    return r
      ? {
          id: r.id,
          name: r.name,
          category: r.category,
          params: (r.params ?? []) as BillerParam[],
        }
      : null;
  }

  async fetchBill(
    billerId: string,
    params: Record<string, string>,
    customerMobile: string | null,
  ): Promise<FetchResult> {
    try {
      const req = await call<{ data?: { refId?: string; status?: string } }>(
        "/api/v2/bbps/bills/fetch/request",
        {
          method: "POST",
          body: JSON.stringify({
            agent: { id: process.env.SETU_AGENT_ID ?? "", channel: "MOB" },
            biller: { id: billerId },
            customer: {
              mobile: customerMobile ?? process.env.SETU_DEFAULT_MOBILE ?? "",
              customerParams: Object.entries(params).map(([name, value]) => ({
                name,
                value,
              })),
            },
          }),
        },
      );
      const refId = req.data?.refId;
      if (!refId)
        return { ok: false, code: "provider", error: "Setu returned no refId" };

      // Poll — fetches usually complete within a few seconds.
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 800 : 1200));
        const poll = await call<{
          data?: {
            status?: string;
            bills?: SetuBill[];
            billerResponse?: SetuBill; // VERIFY: some responses nest a single bill here
            reason?: { message?: string };
            error?: { message?: string };
          };
        }>("/api/v2/bbps/bills/fetch/response", {
          method: "POST",
          body: JSON.stringify({ refId }),
        });
        const status = (poll.data?.status ?? "").toLowerCase();
        if (status === "processing" || status === "pending") continue;
        if (status === "success") {
          const bill = poll.data?.bills?.[0] ?? poll.data?.billerResponse;
          if (!bill)
            return {
              ok: false,
              code: "no_dues",
              error: "No outstanding bill right now",
            };
          return {
            ok: true,
            bill: {
              refId,
              amount: Math.round(Number(bill.amount)) / 100,
              dueDate: bill.dueDate ?? null,
              billDate: bill.billDate ?? null,
              billNumber: bill.billNumber ?? null,
              customerName: bill.customerName ?? null,
            },
          };
        }
        const msg =
          poll.data?.reason?.message ??
          poll.data?.error?.message ??
          "Bill fetch failed";
        const notFound = /not found|invalid|no record|does not exist/i.test(
          msg,
        );
        return {
          ok: false,
          code: notFound ? "not_found" : "provider",
          error: msg,
        };
      }
      return {
        ok: false,
        code: "provider",
        error: "Biller is taking too long — try again in a minute",
      };
    } catch (err) {
      return {
        ok: false,
        code: "provider",
        error: err instanceof Error ? err.message : "Setu error",
      };
    }
  }
}

/** Refresh the biller directory cache (daily cron). Returns count upserted. */
export async function syncSetuBillers(
  supabase: SupabaseClient,
): Promise<number> {
  const billers = await listAllSetuBillers();
  for (let i = 0; i < billers.length; i += 500) {
    const chunk = billers.slice(i, i + 500).map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      params: b.params,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from("bbps_billers")
      .upsert(chunk, { onConflict: "id" });
    if (error) throw error;
  }
  return billers.length;
}
