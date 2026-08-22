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
  fetchPatch,
} from "@/lib/bills";
import { getBbpsProvider, validateParams } from "@/lib/bbps";

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
    if (typeof body.name !== "string" || !body.name.trim()) {
      if (!body.biller_id) return { error: "name required" };
      input.name = ""; // filled from the biller name on create
    } else input.name = body.name.trim().slice(0, 60);
  }
  if (body.kind !== undefined || !partial) {
    if (!BILL_KINDS.includes(body.kind as BillKind))
      return { error: "invalid kind" };
    input.kind = body.kind as BillKind;
  }
  if (body.due_day !== undefined || (!partial && !body.biller_id)) {
    const d = Number(body.due_day);
    if (!Number.isInteger(d) || d < 1 || d > 31)
      return { error: "due_day must be 1–31" };
    input.due_day = d;
  } else if (!partial) input.due_day = 1; // overwritten by the fetched due date
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

  // v6: optional BBPS link
  if (body.biller_id !== undefined) {
    input.biller_id = str(body.biller_id, 80);
    if (input.biller_id) {
      if (typeof body.fetch_params !== "object" || !body.fetch_params)
        return { error: "fetch_params required with biller_id" };
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(
        body.fetch_params as Record<string, unknown>,
      ))
        if (typeof v === "string")
          params[k.slice(0, 60)] = v.trim().slice(0, 64);
      input.fetch_params = params;
    } else {
      input.fetch_params = null;
      input.biller_name = null;
    }
  }

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
    const supabase = createServiceClient();
    let fetched: Record<string, unknown> = {};
    let fetch: unknown = null;
    if (parsed.input.biller_id && parsed.input.fetch_params) {
      const provider = getBbpsProvider(supabase);
      const biller = await provider.getBiller(parsed.input.biller_id);
      if (!biller) return fail("unknown biller", 404);
      const invalid = validateParams(biller, parsed.input.fetch_params);
      if (invalid) return fail(invalid);
      parsed.input.biller_name = biller.name;
      if (!parsed.input.name) parsed.input.name = biller.name;
      const result = await provider.fetchBill(
        biller.id,
        parsed.input.fetch_params,
        null,
      );
      fetch = result;
      fetched = fetchPatch(result);
      if (result.ok) {
        parsed.input.amount = result.bill.amount;
        if (result.bill.dueDate)
          parsed.input.due_day = Number(result.bill.dueDate.slice(8));
      }
    }
    const bill = await createBill(supabase, userId, {
      ...(parsed.input as BillInput),
      ...fetched,
    } as BillInput);
    return NextResponse.json({ status: "created", bill, fetch });
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
