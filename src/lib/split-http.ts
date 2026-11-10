import { NextResponse } from "next/server";
import { SplitError } from "./splits";

/** One error shape for the split routes: user mistakes 400, missing tables 503. */
export function splitFailure(err: unknown) {
  if (err instanceof SplitError)
    return NextResponse.json({ error: err.message }, { status: 400 });
  const code = (err as { code?: string } | null)?.code;
  // undefined_table / undefined_column / PostgREST "no such table": v24 not applied.
  if (code === "42P01" || code === "42703" || code === "PGRST205")
    return NextResponse.json(
      {
        error:
          "Splits need a database update. Try again after the next release.",
      },
      { status: 503 },
    );
  console.error("split route failed", err);
  return NextResponse.json(
    { error: "Something went wrong. Try again." },
    { status: 500 },
  );
}

export async function readJson(
  req: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
