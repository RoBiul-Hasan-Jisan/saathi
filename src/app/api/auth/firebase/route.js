import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { adminAuth } from "@/lib/firebaseAdmin";
import { createSession } from "@/lib/auth";
import { findUserByEmail, insertUser } from "@/lib/store";
import { SELF_SIGNUP_ROLES } from "@/lib/demoUsers";

// Exchanges a Firebase ID token for our own session cookie, creating the MongoDB user
// on first sign-in. Existing users keep their stored role (no self-escalation).
export async function POST(req) {
  const { idToken, role, name } = await req.json().catch(() => ({}));
  if (!idToken) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken);
  } catch (err) {
    return NextResponse.json({ error: "Could not verify your sign-in. Please try again." }, { status: 401 });
  }

  const email = (decoded.email || "").toLowerCase();
  if (!email) return NextResponse.json({ error: "This account has no email address." }, { status: 400 });

  let user = await findUserByEmail(email);
  if (!user) {
    user = {
      id: randomUUID(),
      uid: decoded.uid,
      email,
      name: String(name || decoded.name || email.split("@")[0]).slice(0, 60),
      role: SELF_SIGNUP_ROLES.includes(role) ? role : "patient",
      org: "default",
      demo: false,
    };
    await insertUser(user);
  }

  await createSession(user);
  return NextResponse.json({ ok: true, role: user.role });
}
