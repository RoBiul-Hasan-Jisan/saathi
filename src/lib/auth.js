import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "saathi_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function key() {
  return new TextEncoder().encode(
    process.env.SESSION_SECRET || "saathi-dev-secret-change-me-in-production-0123456789"
  );
}

export async function createSession(user) {
  const token = await new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
    org: user.org || "default",
    demo: !!user.demo,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      org: payload.org,
      demo: !!payload.demo,
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
