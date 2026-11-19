import { NextResponse } from "next/server";
import { DEMO_USERS } from "@/lib/demoUsers";
import { createSession } from "@/lib/auth";

// Instant login: signs the cookie straight from the demo list, no database or Firebase call.
export async function POST(req) {
  if (process.env.ENABLE_DEMO === "false") {
    return NextResponse.json({ error: "Demo accounts are disabled." }, { status: 403 });
  }
  const { role } = await req.json().catch(() => ({}));
  const user = DEMO_USERS.find((u) => u.role === role);
  if (!user) return NextResponse.json({ error: "Unknown demo role." }, { status: 400 });

  await createSession(user);
  return NextResponse.json({ ok: true, role: user.role });
}
