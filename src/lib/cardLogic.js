import { randomBytes, randomUUID } from "node:crypto";
import { TIMES } from "./templates";

export class ValidationError extends Error {}

const FORMS = ["tablet", "capsule", "syrup", "drops", "other"];
const FOODS = ["before", "after", "none"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const num = (v) => (v === "" || v == null ? NaN : Number(v));

export function sanitizeLine(raw) {
  const name = String(raw?.name || "").trim().slice(0, 80);
  if (!name) throw new ValidationError("Every medicine needs a name, copied exactly from the prescription.");

  const pattern = {};
  for (const t of TIMES) {
    const n = num(raw?.pattern?.[t] ?? 0);
    if (!(n >= 0 && n <= 20)) throw new ValidationError("Dose amounts must be between 0 and 20.");
    pattern[t] = n;
  }
  const days = Math.floor(num(raw?.days));

  return {
    name,
    strength: String(raw?.strength || "").trim().slice(0, 30),
    form: FORMS.includes(raw?.form) ? raw.form : "tablet",
    food: FOODS.includes(raw?.food) ? raw.food : "none",
    pattern,
    days: Number.isFinite(days) ? days : 0,
    unclear: raw?.unclear === true,
    note: String(raw?.note || "").trim().slice(0, 300),
    confirmed: raw?.confirmed === true,
  };
}

function requireValidSchedule(line, i) {
  const hasDose = TIMES.some((t) => line.pattern[t] > 0);
  if (!hasDose) throw new ValidationError(`Medicine ${i + 1}: choose when to take it and how much.`);
  if (!(line.days >= 1 && line.days <= 90)) throw new ValidationError(`Medicine ${i + 1}: days must be between 1 and 90.`);
}

function parseEmails(v) {
  const list = String(v || "")
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const e of list) if (!EMAIL.test(e)) throw new ValidationError(`"${e}" is not a valid email address.`);
  return [...new Set(list)].slice(0, 5);
}

export function buildNewCard(body, user) {
  if (!body || typeof body !== "object") throw new ValidationError("Invalid request.");
  const patientName = String(body.patientName || "").trim().slice(0, 80);
  if (!patientName) throw new ValidationError("Enter the patient name.");
  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 10)
    throw new ValidationError("Add between 1 and 10 medicines.");

  const now = new Date().toISOString();
  const actor = { id: user.id, name: user.name, role: user.role };
  const events = [{ type: "created", by: user.name, role: user.role, at: now }];

  const lines = body.lines.map((raw, i) => {
    const l = sanitizeLine(raw);
    const base = {
      name: l.name,
      strength: l.strength,
      form: l.form,
      food: l.food,
      pattern: l.pattern,
      days: l.days,
    };
    if (l.unclear) {
      if (!l.note) throw new ValidationError(`Medicine ${i + 1}: write the question for the prescriber.`);
      events.push({ type: "flagged_unclear", line: i, by: user.name, role: user.role, at: now, detail: l.note });
      return { ...base, status: "unclear", note: l.note };
    }
    requireValidSchedule(l, i);
    if (!l.confirmed) throw new ValidationError(`Medicine ${i + 1} has not been verified against the prescription.`);
    return { ...base, status: "confirmed", note: "", confirmedBy: { ...actor, at: now } };
  });

  const hasUnclear = lines.some((l) => l.status === "unclear");
  const startedAt = Number(body.startedAt);
  const creationSeconds = Number.isFinite(startedAt)
    ? Math.min(3600, Math.max(1, Math.round((Date.now() - startedAt) / 1000)))
    : null;

  const card = {
    id: randomUUID(),
    token: randomBytes(9).toString("base64url"),
    org: user.org,
    demo: false,
    patientName,
    patientAge: String(body.patientAge || "").trim().slice(0, 3),
    patientPhone: String(body.patientPhone || "").trim().slice(0, 20),
    sharedWith: parseEmails(body.sharedWith),
    lines,
    status: hasUnclear ? "awaiting_prescriber" : "issued",
    verifier: null,
    createdBy: { id: user.id, name: user.name },
    createdAt: now,
    issuedAt: null,
    creationSeconds,
    teachBack: null,
    events,
  };

  if (!hasUnclear) {
    card.verifier = { id: user.id, name: user.name, at: now };
    card.issuedAt = now;
    card.events.push({ type: "issued", by: user.name, role: user.role, at: now });
  }
  return card;
}

// Doctor confirms an unclear line as written, or sends a corrected version.
export function applyPrescriberAction(card, body, user) {
  const i = Number(body.lineIndex);
  const line = card.lines[i];
  if (!line || line.status !== "unclear") throw new ValidationError("That line is not waiting for confirmation.");

  const now = new Date().toISOString();
  let corrected = false;

  if (body.correction) {
    const c = sanitizeLine({
      ...line,
      ...body.correction,
      pattern: { ...line.pattern, ...(body.correction.pattern || {}) },
    });
    requireValidSchedule(c, i);
    Object.assign(line, {
      name: c.name,
      strength: c.strength,
      form: c.form,
      food: c.food,
      pattern: c.pattern,
      days: c.days,
    });
    corrected = true;
    line.correctedByPrescriber = true;
  } else {
    requireValidSchedule(sanitizeLine(line), i);
  }

  line.prescriberQuestion = line.note;
  line.status = "confirmed";
  line.note = "";
  line.confirmedBy = { id: user.id, name: user.name, role: user.role, at: now };

  card.events.push({
    type: corrected ? "prescriber_corrected" : "prescriber_confirmed",
    line: i,
    by: user.name,
    role: user.role,
    at: now,
  });

  if (!card.lines.some((l) => l.status === "unclear")) card.status = "ready_to_issue";
  return card;
}

export function applyIssue(card, body, user) {
  if (card.status !== "ready_to_issue") throw new ValidationError("This card is not ready to issue.");
  if (body.readBack !== true) throw new ValidationError("Read the card back to the patient and tick the confirmation.");
  const now = new Date().toISOString();
  card.status = "issued";
  card.verifier = { id: user.id, name: user.name, at: now };
  card.issuedAt = now;
  card.events.push({ type: "issued", by: user.name, role: user.role, at: now });
  return card;
}

export function applyTeachBack(card, body, user) {
  if (card.status !== "issued") throw new ValidationError("Teach-back is only recorded on issued cards.");
  if (!["pass", "fail"].includes(body.result)) throw new ValidationError("Result must be pass or fail.");
  const now = new Date().toISOString();
  card.teachBack = { result: body.result, by: user.name, at: now };
  card.events.push({ type: "teach_back_" + body.result, by: user.name, role: user.role, at: now });
  return card;
}
