import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * The app polls this payload; most of the time nothing has changed. A weak
 * ETag over the JSON lets it ask "anything new?" and get a bodyless 304 back
 * instead of the whole 180-day history again.
 */
export function respondWithEtag(req: NextRequest, body: unknown): NextResponse {
  const json = JSON.stringify(body);
  const etag = `W/"${createHash("sha1").update(json).digest("base64url")}"`;
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
  if (req.headers.get("if-none-match") === etag)
    return new NextResponse(null, { status: 304, headers });
  return new NextResponse(json, {
    status: 200,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
