import { NextResponse } from "next/server";
import { ensureSeed } from "@/lib/store";
import { storageMode } from "@/lib/mongo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeed();
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message, storage: storageMode() }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    storage: storageMode(),
    firebaseConfigured: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    demoEnabled: process.env.ENABLE_DEMO !== "false",
  });
}
