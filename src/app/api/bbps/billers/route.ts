import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { getBbpsProvider } from "@/lib/bbps";

export const dynamic = "force-dynamic";

/** Search the biller directory: ?q=bses&category=Electricity */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const category = req.nextUrl.searchParams.get("category");
  const provider = getBbpsProvider(createServiceClient());
  try {
    const [billers, categories] = await Promise.all([
      provider.searchBillers(q, category || null, 30),
      provider.categories(),
    ]);
    return NextResponse.json({ provider: provider.name, billers, categories });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "biller search failed" },
      { status: 502 },
    );
  }
}
