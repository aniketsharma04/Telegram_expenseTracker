import { SupabaseClient } from "@supabase/supabase-js";
import { MockBbpsProvider } from "./mock";
import { SetuBbpsProvider, setuConfigured } from "./setu";
import type { BbpsProvider } from "./types";

export type {
  BbpsProvider,
  Biller,
  BillerParam,
  FetchedBill,
  FetchResult,
} from "./types";
export { setuConfigured, syncSetuBillers } from "./setu";

const mock = new MockBbpsProvider();

/**
 * Setu when keys are present (sandbox or production by SETU_BASE_URL),
 * otherwise the built-in mock. BBPS_PROVIDER=mock forces the mock even with keys.
 */
export function getBbpsProvider(supabase: SupabaseClient): BbpsProvider {
  if (process.env.BBPS_PROVIDER === "mock") return mock;
  return setuConfigured() ? new SetuBbpsProvider(supabase) : mock;
}

/** Validate customer params against a biller's declared schema. */
export function validateParams(
  biller: {
    params: Array<{
      name: string;
      regex?: string;
      minLength?: number | null;
      maxLength?: number | null;
      optional: boolean;
    }>;
  },
  params: Record<string, string>,
): string | null {
  for (const p of biller.params) {
    const v = (params[p.name] ?? "").trim();
    if (!v) {
      if (!p.optional) return `${p.name} is required`;
      continue;
    }
    if (p.minLength && v.length < p.minLength) return `${p.name} is too short`;
    if (p.maxLength && v.length > p.maxLength) return `${p.name} is too long`;
    if (p.regex) {
      try {
        if (!new RegExp(p.regex).test(v)) return `${p.name} doesn't look right`;
      } catch {
        /* bad regex from provider — skip */
      }
    }
  }
  return null;
}
