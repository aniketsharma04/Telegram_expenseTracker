import { NextRequest } from "next/server";
import { verifyToken, COOKIE_NAME } from "./auth";

/** Session cookie (web) or Bearer token (mobile) — same signed format. */
export function authedUser(req: NextRequest): number | null {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  return verifyToken(req.cookies.get(COOKIE_NAME)?.value) ?? verifyToken(bearer);
}
