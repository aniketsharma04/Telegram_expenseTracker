import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { localDate } from "@/lib/parser";
import { loadCategories } from "@/lib/log-expense";
import {
  BILL_KINDS,
  BillInput,
  BillKind,
  KIND_CATEGORY,
  createBill,
  loadBillStatuses,
  removeBill,
  updateBill,
} from "@/lib/bills";

export const dynamic = "force-dynamic";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Validate a create/update body into BillInput (partial for PATCH). */
async function parseBill(
  body: Record<string, unknown>,
  partial: boolean,
): Promise<{ input: Partial<BillInput> } | { error: string }> {
  const input: Partial<BillInput> = {};

  if (body.name !== undefined || !partial) {
    if (typeof body.name !== "string" || !body.name.trim())
      return { error: "name required" };
    input.name = body.name.trim().slice(0, 60);
  }
  if (body.kind !== undefined || !partial) {
    if (!BILL_KINDS.includes(body.kind as BillKind))
      return { error: "invalid kind" };
    input.kind = body.kind as BillKind;
  }
  if (body.due_day !== undefined || !partial) {
    const d = Number(body.due_day);
    if (!Number.isInteger(d) || d < 1 || d > 31)
      return { error: "due_day must be 1–31" };
    input.due_day = d;
  }
  if (body.amount !== undefined) {
    if (body.amount === null || body.amount === "") input.amount = null;
    else {
      const a = Number(body.amount);
      if (!Number.isFinite(a) || a <= 0 || a > 100_000_000)
        return { error: "invalid amount" };
      input.amount = a;
    }
  } else if (!partial) input.amount = null;

  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  if (body.upi_id !== undefined || !partial) {
    const upi = str(body.upi_id, 80);
    if (upi && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi))
      return { error: "UPI id looks wrong (name@bank)" };
    input.upi_id = upi;
  }
  if (body.payee_name !== undefined || !partial)
    input.payee_name = str(body.payee_name, 60);
  if (body.consumer_number !== undefined || !partial)
    input.consumer_number = str(body.consumer_number, 60);

  if (body.category !== undefined) {
    const categories = await loadCategories(createServiceClient());
    const match = categories.find(
      (c) =>
        typeof body.category === "string" &&
        c.name.toLowerCase() === body.category.trim().toLowerCase(),
    );
    if (!match) return { error: "unknown category" };
    input.category = match.name;
  } else if (!partial) {
    input.category = KIND_CATEGORY[input.kind as BillKind];
  }

  return { input };
}

/** List bills with due status (also included in /api/data). */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  const bills = await loadBillStatuses(
    createServiceClient(),
    userId,
    localDate(),
  );
  return NextResponse.json({ bills });
}

export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("invalid JSON");
  }
  const parsed = await parseBill(body, false);
  if ("error" in parsed) return fail(parsed.error);
  try {
    const bill = await createBill(
      createServiceClient(),
      userId,
      parsed.input as BillInput,
    );
    return NextResponse.json({ status: "created", bill });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "create failed", 500);
  }
}

export async function PATCH(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("invalid JSON");
  }
  if (typeof body.id !== "string") return fail("missing id");
  const parsed = await parseBill(body, true);
  if ("error" in parsed) return fail(parsed.error);
  if (Object.keys(parsed.input).length === 0) return fail("nothing to update");
  try {
    const bill = await updateBill(
      createServiceClient(),
      userId,
      body.id,
      parsed.input,
    );
    if (!bill) return fail("not found", 404);
    return NextResponse.json({ status: "updated", bill });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "update failed", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("missing id");
  try {
    const deleted = await removeBill(createServiceClient(), userId, id);
    return NextResponse.json({ deleted });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "delete failed", 500);
  }
}
