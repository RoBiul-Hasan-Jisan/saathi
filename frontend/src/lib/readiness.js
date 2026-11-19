"use client";
import { api } from "./api";
import { hasPin } from "./pin";
import { countPending } from "./offline";

// "Is this device ready to work offline?"  The deck's target is 95% or more.

const PAGES = ["/dashboard", "/cards/new", "/cards/local"];

export function deviceId() {
  try {
    let id = localStorage.getItem("saathi.deviceId");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("saathi.deviceId", id);
    }
    return id;
  } catch {
    return "unknown-device";
  }
}

// Visits the key pages and the library once, so the service worker keeps a copy.
export async function prepareOffline() {
  await Promise.all(PAGES.map((p) => fetch(p, { credentials: "same-origin" }).catch(() => null)));
  await Promise.all(["/api/library/active", "/api/voices/manifest"].map((p) => fetch(p).catch(() => null)));
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }
}

async function pageCached(path) {
  try {
    return !!(await caches.match(path, { ignoreSearch: true }));
  } catch {
    return false;
  }
}

export async function runReadiness(user) {
  const checks = [];
  const add = (key, label, ok, hint) => checks.push({ key, label, ok: !!ok, hint });

  let sw = false;
  try {
    sw = !!(await navigator.serviceWorker?.getRegistration())?.active;
  } catch {
    /* ignore */
  }
  add("serviceWorker", "Offline helper (service worker) is active", sw, "Open the app on https or localhost and reload once. Service workers run in production builds.");

  const idb = await countPending().then(() => true).catch(() => false);
  add("indexedDb", "Device storage for offline cards works", idb, "Private browsing windows block this. Use a normal window.");

  for (const p of PAGES) add(`page:${p}`, `Page saved for offline: ${p}`, await pageCached(p), "Press “Prepare this device for offline use”.");

  let libCached = false;
  try {
    libCached = !!localStorage.getItem("saathi.library");
  } catch {
    /* ignore */
  }
  add("library", "Approved phrase library saved on this device", libCached, "Open the app online once.");

  const voices = typeof speechSynthesis !== "undefined" ? speechSynthesis.getVoices() : [];
  add("voice", "A Bangla voice is installed on this device", voices.some((v) => v.lang?.toLowerCase().startsWith("bn")), "Install a Bangla text-to-speech voice in the phone or computer settings.");

  let qr = false;
  try {
    const QR = (await import("qrcode")).default;
    qr = (await QR.toDataURL("saathi")).startsWith("data:image");
  } catch {
    /* ignore */
  }
  add("qr", "QR codes can be made on the device", qr, "Reload the app.");

  let persisted = false;
  try {
    persisted = !!(await navigator.storage?.persisted?.());
  } catch {
    /* ignore */
  }
  add("persist", "Browser will not clear saved data to free space", persisted, "Press “Prepare this device for offline use” and allow storage if asked.");

  if (["pharmacist", "chw"].includes(user?.role) && !user.demo) add("pin", "Screen-lock PIN is set", hasPin(user.id), "Set a PIN below so the next customer cannot see the screen.");

  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  return { score, checks };
}

export async function reportReadiness(result) {
  const checks = Object.fromEntries(result.checks.map((c) => [c.key, c.ok]));
  return api("/api/devices/readiness", { method: "POST", body: { deviceId: deviceId(), score: result.score, checks } });
}
