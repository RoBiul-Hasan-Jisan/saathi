import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Tiny .env reader (works on any Node version). Real environment variables win.
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
loadEnv(path.join(ROOT, ".env"));

const env = process.env;
const isProd = env.NODE_ENV === "production";

if (isProd && !env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set in production.");
}

const list = (v) =>
  String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const config = {
  root: ROOT,
  port: Number(env.PORT || 4000),
  isProd,
  sessionSecret: env.SESSION_SECRET || "dev-only-secret-change-me-0123456789abcdef",
  enableDemo: env.ENABLE_DEMO !== "false",
  mongodbUri: env.MONGODB_URI || "",
  mongodbDb: env.MONGODB_DB || "saathi",
  firebaseProjectId: env.FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  firebaseServiceAccount: env.FIREBASE_SERVICE_ACCOUNT_JSON || "",
  corsOrigins: list(env.CORS_ORIGIN || "http://localhost:3000"),
  adminEmails: list(env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
  authRateMax: Number(env.AUTH_RATE_LIMIT || 40),
  autoApproveStaff: env.AUTO_APPROVE_STAFF === "true",
  cookieSameSite: env.COOKIE_SAMESITE || "lax",
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === "true" : isProd,
};
