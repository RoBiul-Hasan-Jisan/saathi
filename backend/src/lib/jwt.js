import crypto from "node:crypto";

// Minimal HS256 JSON Web Token (sign + verify) using only Node's crypto.
const b64u = (v) => Buffer.from(v).toString("base64url");

export function signJwt(payload, secret, ttlSeconds) {
  const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64u(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }));
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token, secret) {
  try {
    const [h, b, s] = String(token).split(".");
    if (!h || !b || !s) return null;
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    if (header.alg !== "HS256") return null;
    const expected = crypto.createHmac("sha256", secret).update(`${h}.${b}`).digest();
    const given = Buffer.from(s, "base64url");
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    const payload = JSON.parse(Buffer.from(b, "base64url").toString());
    if (!payload.exp || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
