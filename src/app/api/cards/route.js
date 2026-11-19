import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { STAFF } from "@/lib/perms";
import { listCards, insertCard } from "@/lib/store";
import { buildNewCard, ValidationError } from "@/lib/cardLogic";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.json({ cards: await listCards(user) });
}

export async function POST(req) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!STAFF.includes(user.role))
    return NextResponse.json({ error: "Only a pharmacist or health worker can create cards." }, { status: 403 });

  const body = await req.json().catch(() => null);
  try {
    const card = buildNewCard(body, user);
    await insertCard(card);
    return NextResponse.json({ id: card.id, status: card.status }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: "Could not save the card." }, { status: 500 });
  }
}
