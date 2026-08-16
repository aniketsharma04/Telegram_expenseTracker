import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side client using the service role key — used only inside the
 * webhook route to write expenses. Never import this from client code.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(url, key, { auth: { persistSession: false } });
}
