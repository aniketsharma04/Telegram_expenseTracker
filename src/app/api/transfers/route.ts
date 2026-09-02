import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import { localDate } from "@/lib/parser";
import { listAccounts, loadBalanceSheet } from "@/lib/accounts";
import {
  TRANSFER_KINDS,
  createTransfer,
  deleteTransfer,
  listTransfers,
  type TransferKind,
} from "@/lib/transfers";

export const dynamic = "force-dynamic";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Transfers, newest first. `?since=YYYY-MM-DD` narrows the window. */
export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  const since = req.nextUrl.searchParams.get("since") ?? undefined;
  try {
    const transfers = await listTransfers(
      createServiceClient(),
      userId,
      since && /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : undefined,
    );
    return NextResponse.json({ transfers });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "list failed", 500);
  }
}

/**
 * Record a movement between your own accounts:
 * { from_account_id?, to_account_id?, amount, transfer_date?, kind?, note? }
 *
 * At least one end must be a real account of yours — a transfer with neither
 * end is just an untracked hole in the ledger.
 */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("invalid JSON");
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000)
    return fail("invalid amount");

  const from =
    typeof body.from_account_id === "string" ? body.from_account_id : null;
  const to = typeof body.to_account_id === "string" ? body.to_account_id : null;
  if (!from && !to) return fail("a transfer needs a source or a destination");
  if (from && to && from === to) return fail("pick two different accounts");

  const supabase = createServiceClient();
  const owned = new Set(
    (await listAccounts(supabase, userId, { includeArchived: true })).map(
      (a) => a.id,
    ),
  );
  if (!owned.size) return fail("set up an account first");
  if (from && !owned.has(from)) return fail("unknown source account", 404);
  if (to && !owned.has(to)) return fail("unknown destination account", 404);

  const kind: TransferKind = TRANSFER_KINDS.includes(body.kind as TransferKind)
    ? (body.kind as TransferKind)
    : "transfer";
  const transfer_date =
    typeof body.transfer_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.transfer_date)
      ? body.transfer_date
      : localDate();

  try {
    const transfer = await createTransfer(supabase, userId, {
      from_account_id: from,
      to_account_id: to,
      amount: Math.round(amount * 100) / 100,
      transfer_date,
      kind,
      note:
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim().slice(0, 140)
          : null,
    });
    // Balances shift on every transfer, so hand them back with the result.
    return NextResponse.json({
      status: "recorded",
      transfer,
      balances: await loadBalanceSheet(supabase, userId),
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "transfer failed", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId) return fail("unauthorized", 401);
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return fail("missing id");
  const supabase = createServiceClient();
  try {
    const deleted = await deleteTransfer(supabase, userId, id);
    if (!deleted) return fail("not found", 404);
    return NextResponse.json({
      status: "deleted",
      balances: await loadBalanceSheet(supabase, userId),
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "delete failed", 500);
  }
}
