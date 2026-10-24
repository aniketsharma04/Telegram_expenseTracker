import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase-server";
import { exchangeCode } from "@/lib/gmail";
import { saveGmailAccount } from "@/lib/detected";

export const dynamic = "force-dynamic";

/** Minimal self-contained page — the user lands here from Google, in whatever browser. */
function page(title: string, body: string, ok: boolean): NextResponse {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
 body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
      background:#0b0f14;color:#e6edf3;padding:24px}
 .card{max-width:420px;text-align:center}
 .mark{font-size:44px;margin-bottom:12px}
 h1{font-size:20px;margin:0 0 8px}
 p{margin:0;color:#8b98a5}
</style></head><body><div class="card">
<div class="mark">${ok ? "✅" : "⚠️"}</div><h1>${title}</h1><p>${body}</p>
</div></body></html>`;
  return new NextResponse(html, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** Google redirects here with ?code&state (state = our signed session token). */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const denied = params.get("error");
  if (denied)
    return page(
      "Not connected",
      `Google returned “${denied}”. Nothing was changed.`,
      false,
    );

  const code = params.get("code");
  const userId = verifyToken(params.get("state"));
  if (!code || !userId)
    return page(
      "Link expired",
      "That consent link is no longer valid. Start again from the app.",
      false,
    );

  try {
    const { refreshToken, email, scope } = await exchangeCode(code);
    await saveGmailAccount(
      createServiceClient(),
      userId,
      email,
      refreshToken,
      scope,
    );
    return page(
      "Gmail connected",
      `${email} is linked. Bills found in your inbox will show up under Bills, and you confirm each one before it's added.`,
      true,
    );
  } catch (err) {
    console.error("gmail callback failed", err);
    return page(
      "Couldn't connect",
      err instanceof Error ? err.message : "Unknown error",
      false,
    );
  }
}
