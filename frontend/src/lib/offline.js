"use client";
import { api } from "./api";

// Offline card creation. When the connection is down, the card is saved in this browser's database
// (IndexedDB) with an id, QR token and time made on the device, then sent to the server when the
// connection returns. Only unsynced cards live here, and they are removed as soon as they sync.

const DB = "saathi";
const STORE = "pending";

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is not available"));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "localId" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req?.result);
    };
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const listPending = () => run("readonly", (s) => s.getAll()).then((x) => x || []);
export const getPending = (id) => run("readonly", (s) => s.get(id));
export const putPending = (item) => run("readwrite", (s) => s.put(item));
export const removePending = (id) => run("readwrite", (s) => s.delete(id));
export const countPending = () => listPending().then((l) => l.length).catch(() => 0);

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const randomToken = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));

// What the card looks like on the device before the server has seen it.
function localCard(payload, user, localId, now) {
  const lines = payload.lines.map((l) =>
    l.unclear
      ? { ...l, status: "unclear", note: l.note }
      : { ...l, status: "confirmed", note: "", confirmedBy: { id: user.id, name: user.name, role: user.role, at: now } }
  );
  const hasUnclear = lines.some((l) => l.status === "unclear");
  return {
    id: localId,
    token: payload.clientToken,
    local: true,
    patientName: payload.patientName,
    patientAge: payload.patientAge === "" || payload.patientAge == null ? null : Number(payload.patientAge),
    patientPhone: payload.patientPhone || "",
    lines,
    status: hasUnclear ? "awaiting_prescriber" : "issued",
    verifier: hasUnclear ? null : { name: user.name, at: now },
    issuedAt: hasUnclear ? null : now,
    createdAt: now,
    consent: payload.consent,
    sharedWith: [],
    guard: { flags: [], unchecked: [] },
    events: [],
  };
}

export async function queueCard(payload, user) {
  const localId = `local-${randomToken(8)}`;
  const now = new Date().toISOString();
  const full = { ...payload, offline: true, clientId: localId, clientToken: randomToken(9), createdAtClient: now };
  const item = { localId, payload: full, card: localCard(full, user, localId, now), createdAt: now, status: "pending", error: null };
  await putPending(item);
  window.dispatchEvent(new Event("saathi:pending-changed"));
  return item;
}

const mapKey = (localId) => `saathi.synced.${localId}`;
export const syncedIdFor = (localId) => {
  try {
    return localStorage.getItem(mapKey(localId));
  } catch {
    return null;
  }
};

// Sends every waiting card. Stops quietly if the server cannot be reached.
export async function syncPending() {
  const items = await listPending();
  const results = [];
  for (const item of items) {
    try {
      const r = await api("/api/cards", { method: "POST", body: item.payload });
      try {
        localStorage.setItem(mapKey(item.localId), r.id);
      } catch {
        /* ignore */
      }
      await removePending(item.localId);
      results.push({ localId: item.localId, ok: true, id: r.id });
    } catch (e) {
      if (e.unreachable) {
        results.push({ localId: item.localId, ok: false, offline: true });
        break;
      }
      await putPending({ ...item, status: "error", error: e.message });
      results.push({ localId: item.localId, ok: false, error: e.message });
    }
  }
  window.dispatchEvent(new Event("saathi:pending-changed"));
  return results;
}
