import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { HttpError } from "../lib/errors.js";

// FIREBASE_SERVICE_ACCOUNT_JSON may be a file path (relative to the backend folder) or raw JSON text.
function loadServiceAccount() {
  const value = config.firebaseServiceAccount.trim();
  if (!value) return null;
  if (value.startsWith("{")) return JSON.parse(value);
  const file = path.isAbsolute(value) ? value : path.join(config.root, value);
  if (!fs.existsSync(file)) throw new Error(`Firebase service account file not found: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

let authPromise = null;

async function getAuthClient() {
  if (!authPromise) {
    authPromise = (async () => {
      const { cert, getApps, initializeApp } = await import("firebase-admin/app");
      const { getAuth } = await import("firebase-admin/auth");
      if (!getApps().length) {
        const account = loadServiceAccount();
        initializeApp(account ? { credential: cert(account) } : { projectId: config.firebaseProjectId });
      }
      return getAuth();
    })().catch((err) => {
      authPromise = null;
      throw err;
    });
  }
  return authPromise;
}

// Returns { uid, email, name } for a valid Firebase ID token.
export async function verifyFirebaseToken(idToken) {
  try {
    const decoded = await (await getAuthClient()).verifyIdToken(idToken);
    return { uid: decoded.uid, email: (decoded.email || "").toLowerCase(), name: decoded.name || "" };
  } catch (err) {
    console.error("[saathi] Firebase token check failed:", err.message);
    throw new HttpError(401, "Could not verify your sign-in. Please try again.");
  }
}
