import { ValidationError } from "./errors.js";

export const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);

export function parseList(v, maxItems = 10, maxLen = 60) {
  const raw = Array.isArray(v) ? v : String(v ?? "").split(/[,;\n]+/);
  const out = [];
  for (const item of raw) {
    const s = clean(item, maxLen);
    if (s && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out.slice(0, maxItems);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmails(v, max = 5) {
  const list = (Array.isArray(v) ? v : String(v ?? "").split(/[\s,;]+/))
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean);
  for (const e of list) if (!EMAIL.test(e)) throw new ValidationError(`"${e}" is not a valid email address.`);
  return [...new Set(list)].slice(0, max);
}

// Bangladesh-friendly: 01712345678, +8801712345678 and 8801712345678 all become 8801712345678.
export function normalizePhone(input) {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (!digits) return "";
  let n = digits;
  if (n.startsWith("880")) n = digits;
  else if (n.startsWith("0")) n = "88" + n;
  else if (n.length === 10 && n.startsWith("1")) n = "880" + n;
  if (n.length < 11 || n.length > 15) throw new ValidationError("Enter a valid phone number.");
  return n;
}
