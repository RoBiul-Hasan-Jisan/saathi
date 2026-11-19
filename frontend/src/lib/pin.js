// Screen-lock PIN for shared devices. Only a salted hash is stored in this browser, never the PIN.
// It hides the screen between customers; the real sign-in stays in the (httpOnly) session cookie.

const enc = new TextEncoder();
const ITER = 120_000;
const keyOf = (userId) => `saathi.pin.${userId}`;
const AUTO_KEY = "saathi.autolock";

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin, salt) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, base, 256);
}

export const hasPin = (userId) => {
  try {
    return !!localStorage.getItem(keyOf(userId));
  } catch {
    return false;
  }
};

export async function setPin(userId, pin) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("Use 4 to 8 digits.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(keyOf(userId), JSON.stringify({ salt: toB64(salt), hash: toB64(await derive(pin, salt)) }));
}

export async function checkPin(userId, pin) {
  try {
    const { salt, hash } = JSON.parse(localStorage.getItem(keyOf(userId)) || "null");
    return toB64(await derive(pin, fromB64(salt))) === hash;
  } catch {
    return false;
  }
}

export const clearPin = (userId) => {
  try {
    localStorage.removeItem(keyOf(userId));
  } catch {
    /* ignore */
  }
};

export function clearAllPins() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("saathi.pin.")) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

export const getAutoLockMinutes = () => {
  try {
    return Number(localStorage.getItem(AUTO_KEY)) || 3;
  } catch {
    return 3;
  }
};
export const setAutoLockMinutes = (m) => {
  try {
    localStorage.setItem(AUTO_KEY, String(m));
  } catch {
    /* ignore */
  }
};
