import fs from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// FIREBASE_SERVICE_ACCOUNT_JSON can be either:
//   - a file path, e.g. service_account.json (relative to the project folder), or
//   - the raw JSON text (handy on hosts like Vercel where you cannot upload a file).
function loadServiceAccount() {
  const value = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!value) return null;
  if (value.startsWith("{")) return JSON.parse(value);

  const file = path.isAbsolute(value) ? value : path.join(process.cwd(), value);
  if (!fs.existsSync(file)) {
    throw new Error(`Firebase service account file not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function adminAuth() {
  if (!getApps().length) {
    const account = loadServiceAccount();
    if (account) {
      initializeApp({ credential: cert(account) });
    } else {
      // Verifying ID tokens only needs the project ID.
      initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
    }
  }
  return getAuth();
}
