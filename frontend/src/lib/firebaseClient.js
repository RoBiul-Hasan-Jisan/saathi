import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// NEXT_PUBLIC_* values must be written out literally so Next.js can inline them.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

export function getFirebaseAuth() {
  return getAuth(getApps().length ? getApp() : initializeApp(config));
}
