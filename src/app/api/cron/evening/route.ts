import { NextRequest } from "next/server";
import { runBriefs } from "@/lib/briefs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily-budget evening message — see vercel.json for the schedule (IST = UTC+5:30). */
export async function GET(req: NextRequest) {
  return runBriefs(req, "evening");
}
