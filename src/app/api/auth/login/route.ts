import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signToken, COOKIE_NAME } from "@/lib/auth";

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

/** Landing point of the magic link the bot sends via /dashboard. */
export async function GET(req: NextRequest) {
  const userId = verifyToken(req.nextUrl.searchParams.get("token"));
  if (!userId) {
    return NextResponse.redirect(new URL("/?login=expired", req.url));
  }
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(COOKIE_NAME, signToken(userId, SESSION_TTL), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL,
    path: "/",
  });
  return res;
}
