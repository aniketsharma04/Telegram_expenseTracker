import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase-server";
import {
  addPerson,
  archivePerson,
  listPeople,
  updatePerson,
} from "@/lib/splits";
import { readJson, splitFailure } from "@/lib/split-http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({
      people: await listPeople(createServiceClient(), userId),
    });
  } catch (err) {
    return splitFailure(err);
  }
}

/** Add someone to split with: { name, upi_id?, phone? }. */
export async function POST(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  if (!body)
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  try {
    const person = await addPerson(createServiceClient(), userId, {
      name: body.name,
      upi_id: body.upi_id,
      phone: body.phone,
    });
    return NextResponse.json({ person });
  } catch (err) {
    return splitFailure(err);
  }
}

/** Change a name, UPI ID or phone: { id, name?, upi_id?, phone? }. */
export async function PATCH(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  if (!body || typeof body.id !== "string")
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  try {
    const person = await updatePerson(createServiceClient(), userId, body.id, {
      name: body.name,
      upi_id: body.upi_id,
      phone: body.phone,
    });
    return NextResponse.json({ person });
  } catch (err) {
    return splitFailure(err);
  }
}

/** Remove someone you're square with (?id=). */
export async function DELETE(req: NextRequest) {
  const userId = authedUser(req);
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  try {
    await archivePerson(createServiceClient(), userId, id);
    return NextResponse.json({ removed: true });
  } catch (err) {
    return splitFailure(err);
  }
}
