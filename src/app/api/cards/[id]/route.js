import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { STAFF, canViewCard } from "@/lib/perms";
import { getCardById, saveCard } from "@/lib/store";
import {
  applyIssue,
  applyPrescriberAction,
  applyTeachBack,
  ValidationError,
} from "@/lib/cardLogic";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const card = await getCardById(id);
  if (!card || !canViewCard(user, card)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ card });
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const card = await getCardById(id);
  if (!card || !canViewCard(user, card)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  try {
    switch (body.action) {
      case "prescriber_confirm":
        if (user.role !== "doctor")
          return NextResponse.json({ error: "Only a prescriber can confirm this." }, { status: 403 });
        applyPrescriberAction(card, body, user);
        break;
      case "issue":
        if (!STAFF.includes(user.role))
          return NextResponse.json({ error: "Only a named verifier can issue a card." }, { status: 403 });
        applyIssue(card, body, user);
        break;
      case "teachback":
        if (!STAFF.includes(user.role))
          return NextResponse.json({ error: "Only pharmacy or health staff can record teach-back." }, { status: 403 });
        applyTeachBack(card, body, user);
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    await saveCard(card);
    return NextResponse.json({ card });
  } catch (err) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: "Could not update the card." }, { status: 500 });
  }
}
