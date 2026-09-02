import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import {
  ACCOUNT_KINDS,
  archiveAccount,
  createAccount,
  loadBalanceSheet,
  updateAccount,
  type AccountKind,
} from "@/lib/accounts";

export const dynamic = "force-dynamic";

const MAX_AMOUNT = 1_000_000_000;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function readKind(value: unknown): AccountKind | null {
  return ACCOUNT_KINDS.includes(value as AccountKind)
    ? (value as AccountKind)
    : null;
}

/** Optional money field: absent → undefined, present but junk → error. */
function readAmount(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > MAX_AMOUNT)
    throw new Error(`invalid ${field}`);
  return Math.round(n * 100) / 100;
}

function readDay(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 31)
    throw new Error(`invalid ${field}`);
  return n;
}

/** Accounts with live balances, plus the assets/liabilities/net summary. */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  try {
    return NextResponse.json(
      await loadBalanceSheet(createServiceClient(), userId),
    );
  } catch (err) {
    return fail(err instanceof Error ? err.message : "balances failed", 500);
  }
}

/** Create an account: { name, kind, identifier?, opening_balance?, ... }. */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("invalid JSON");
  }

  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 60)
      : null;
  if (!name) return fail("name is required");

  const kind = readKind(body.kind) ?? "bank";

  try {
    const account = await createAccount(createServiceClient(), userId, {
      name,
      kind,
      identifier:
        typeof body.identifier === "string" && body.identifier.trim()
          ? body.identifier.trim().slice(0, 30)
          : null,
      opening_balance: readAmount(body.opening_balance, "opening_balance") ?? 0,
      credit_limit: readAmount(body.credit_limit, "credit_limit") ?? null,
      statement_day: readDay(body.statement_day, "statement_day") ?? null,
      due_day: readDay(body.due_day, "due_day") ?? null,
      is_default: body.is_default === true,
    });
    return NextResponse.json({ status: "created", account });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "create failed", 500);
  }
}

/** Edit an account: { id, ...fields }. Only the fields sent are changed. */
export async function PATCH(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("invalid JSON");
  }

  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return fail("missing id");

  const patch: Record<string, unknown> = {};
  try {
    if (typeof body.name === "string" && body.name.trim())
      patch.name = body.name.trim().slice(0, 60);
    const kind = readKind(body.kind);
    if (kind) patch.kind = kind;
    if (body.identifier !== undefined)
      patch.identifier =
        typeof body.identifier === "string" && body.identifier.trim()
          ? body.identifier.trim().slice(0, 30)
          : null;
    const opening = readAmount(body.opening_balance, "opening_balance");
    if (opening !== undefined) patch.opening_balance = opening ?? 0;
    const limit = readAmount(body.credit_limit, "credit_limit");
    if (limit !== undefined) patch.credit_limit = limit;
    const statementDay = readDay(body.statement_day, "statement_day");
    if (statementDay !== undefined) patch.statement_day = statementDay;
    const dueDay = readDay(body.due_day, "due_day");
    if (dueDay !== undefined) patch.due_day = dueDay;
    if (body.is_default === true) patch.is_default = true;
    if (typeof body.archived === "boolean") patch.archived = body.archived;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "invalid field");
  }

  if (!Object.keys(patch).length) return fail("nothing to update");

  try {
    const account = await updateAccount(
      createServiceClient(),
      userId,
      id,
      patch,
    );
    if (!account) return fail("not found", 404);
    return NextResponse.json({ status: "updated", account });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "update failed", 500);
  }
}

/**
 * Archive, never hard-delete: the expenses that pointed here keep their
 * history and the balance stays reconstructable.
 */
export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("missing id");
  try {
    const archived = await archiveAccount(createServiceClient(), userId, id);
    if (!archived) return fail("not found", 404);
    return NextResponse.json({ status: "archived" });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "archive failed", 500);
  }
}
