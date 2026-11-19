import { newId, newToken, TOKEN_RE } from "../lib/ids.js";
import { ValidationError } from "../lib/errors.js";
import { clean, normalizePhone, parseEmails, parseList } from "../lib/validate.js";
import { DOSE_OPTIONS, FOOD_KEYS, FORM_KEYS, MAX_COURSE_DAYS, TIMES } from "./constants.js";

const num = (v) => (v === "" || v == null ? NaN : Number(v));

/* ------------------------------------------------------------------ input */

export function sanitizeLine(raw) {
  const name = clean(raw?.name, 80);
  if (!name) throw new ValidationError("Every medicine needs a name, copied exactly from the prescription.");
  const form = FORM_KEYS.includes(raw?.form) ? raw.form : "tablet";
  const pattern = {};
  for (const t of TIMES) {
    const n = num(raw?.pattern?.[t] ?? 0);
    if (!(n >= 0 && n <= 20)) throw new ValidationError("Dose amounts must be between 0 and 20.");
    if (n > 0 && !DOSE_OPTIONS[form].includes(n)) throw new ValidationError(`${n} is not an approved amount for this medicine form.`);
    pattern[t] = n;
  }
  const days = Math.floor(num(raw?.days));
  return {
    name,
    strength: clean(raw?.strength, 30),
    form,
    food: FOOD_KEYS.includes(raw?.food) ? raw.food : "none",
    pattern,
    days: Number.isFinite(days) ? days : 0,
    ingredient: /^[a-z0-9_-]{2,40}$/.test(String(raw?.ingredient || "")) ? raw.ingredient : "",
    unclear: raw?.unclear === true,
    note: clean(raw?.note, 300),
    confirmed: raw?.confirmed === true,
  };
}

export function requireValidSchedule(line, i) {
  if (!TIMES.some((t) => line.pattern[t] > 0)) throw new ValidationError(`Medicine ${i + 1}: choose when to take it and how much.`);
  if (!(line.days >= 1 && line.days <= MAX_COURSE_DAYS)) throw new ValidationError(`Medicine ${i + 1}: days must be between 1 and ${MAX_COURSE_DAYS}.`);
}

export function sanitizeCardInput(body) {
  if (!body || typeof body !== "object") throw new ValidationError("Invalid request.");
  const patientName = clean(body.patientName, 80);
  if (!patientName) throw new ValidationError("Enter the patient name.");
  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 10) {
    throw new ValidationError("Add between 1 and 10 medicines.");
  }
  const ageRaw = clean(body.patientAge, 3);
  const age = ageRaw === "" ? null : Number(ageRaw);
  if (age !== null && !(Number.isInteger(age) && age >= 0 && age <= 120)) throw new ValidationError("Age must be a whole number between 0 and 120.");

  const consent = { family: body.consent?.family === true, dataUse: body.consent?.dataUse === true };
  const sharedWith = parseEmails(body.sharedWith);
  if (sharedWith.length && !consent.family) {
    throw new ValidationError("Record the patient's consent before sharing the card with family.");
  }

  const startedAt = Number(body.startedAt);
  return {
    patientName,
    patientAge: age,
    patientPhone: normalizePhone(clean(body.patientPhone, 20)),
    sharedWith,
    consent,
    allergies: parseList(body.patientAllergies, 10, 40),
    lines: body.lines.map(sanitizeLine),
    startedAt: Number.isFinite(startedAt) ? startedAt : null,
    eprescriptionId: clean(body.eprescriptionId, 60),
    source: ["manual", "eprescription", "rxscan"].includes(body.source) ? body.source : "manual",
    // Offline workflow: the device creates the id/token and the time, the server keeps them if sane.
    clientId: clean(body.clientId, 60),
    clientToken: TOKEN_RE.test(String(body.clientToken || "")) ? body.clientToken : "",
    createdAtClient: clean(body.createdAtClient, 40),
    offline: body.offline === true,
  };
}

/* ------------------------------------------------------------------ build */

// ctx = { now, patient, flags, unchecked, acks, libraryReviewed, offline }
export function buildNewCard(input, user, ctx) {
  const now = ctx.now;
  const offline = !!ctx.offline;
  const who = { by: user.name, byId: user.id, role: user.role };
  const events = [{ type: "created", ...who, at: now, ...(offline ? { offline: true } : {}) }];
  const lines = input.lines.map((l) => ({ ...l }));

  // DoctorGuard: every flag needs a named human decision.
  const guardFlags = [];
  for (const f of ctx.flags) {
    const ack = ctx.acks[f.key];
    if (!ack) {
      if (!offline) throw new ValidationError(`DoctorGuard: please review "${f.title}" before continuing.`);
      guardFlags.push({ ...f, ack: null });
      continue;
    }
    if (!["accepted", "referred"].includes(ack.action)) {
      throw new ValidationError('For each DoctorGuard flag choose "I reviewed this" or "Refer to prescriber".');
    }
    const note = clean(ack.note, 300);
    if (ack.action === "accepted" && f.severity === "high" && note.length < 10) {
      throw new ValidationError("High-severity DoctorGuard flag: write why you are proceeding (at least 10 characters) or refer it to the prescriber.");
    }
    guardFlags.push({ ...f, ack: { action: ack.action, note, ...who, at: now } });
    events.push({ type: ack.action === "referred" ? "guard_referred" : "guard_accepted", ...who, at: now, detail: f.title });
    if (ack.action === "referred") {
      for (const i of f.lines) {
        const l = lines[i];
        if (l && !l.unclear) {
          l.unclear = true;
          l.note = `DoctorGuard flag: ${f.title}. ${note}`.trim().slice(0, 300);
        }
      }
    }
  }

  const finalLines = lines.map((l, i) => {
    const base = { name: l.name, strength: l.strength, form: l.form, food: l.food, pattern: l.pattern, days: l.days, ingredient: l.ingredient };
    if (l.unclear) {
      if (!l.note) throw new ValidationError(`Medicine ${i + 1}: write the question for the prescriber.`);
      events.push({ type: "flagged_unclear", line: i, ...who, at: now, detail: l.note });
      return { ...base, status: "unclear", note: l.note };
    }
    requireValidSchedule(l, i);
    if (!l.confirmed) throw new ValidationError(`Medicine ${i + 1} has not been verified against the prescription.`);
    return { ...base, status: "confirmed", note: "", confirmedBy: { id: user.id, name: user.name, role: user.role, at: now } };
  });

  const hasUnclear = finalLines.some((l) => l.status === "unclear");
  const startedAt = input.startedAt;
  const creationSeconds = startedAt ? Math.min(3600, Math.max(1, Math.round((Date.parse(now) - startedAt) / 1000))) : null;

  const card = {
    id: newId(),
    token: input.clientToken || newToken(),
    org: user.org,
    demo: false,
    clientId: input.clientId || null,
    patientId: ctx.patient?.id || null,
    patientName: input.patientName,
    patientAge: input.patientAge,
    patientPhone: input.patientPhone,
    sharedWith: input.sharedWith,
    consent: { ...input.consent, by: user.name, at: now },
    lines: finalLines,
    status: hasUnclear ? "awaiting_prescriber" : "issued",
    verifier: null,
    createdBy: { id: user.id, name: user.name },
    createdAt: now,
    issuedAt: null,
    creationSeconds,
    teachBack: null,
    followUp: null,
    source: input.source,
    eprescriptionId: input.eprescriptionId || null,
    prescriberId: ctx.prescriberId || null,
    doctorVisible: hasUnclear || !!ctx.prescriberId,
    offline,
    syncedAt: offline ? ctx.syncedAt : null,
    guard: { checkedAt: now, flags: guardFlags, unchecked: ctx.unchecked, libraryReviewed: !!ctx.libraryReviewed },
    guardReview: null,
    events,
  };
  card.guardReview = guardReviewState(card);

  if (!hasUnclear) {
    card.verifier = { id: user.id, name: user.name, at: now };
    card.issuedAt = now;
    card.events.push({ type: "issued", ...who, at: now });
  }
  return card;
}

/* ---------------------------------------------------------------- actions */

export function guardReviewState(card) {
  const flags = card.guard?.flags || [];
  if (flags.some((f) => !f.ack)) return "pending";
  if (flags.some((f) => f.ack.action === "referred" && !f.ack.resolved)) return "referred";
  return null;
}

// Doctor confirms an unclear line as written, or sends the corrected version.
export function applyPrescriberAction(card, body, user) {
  const i = Number(body.lineIndex);
  const line = card.lines[i];
  if (!line || line.status !== "unclear") throw new ValidationError("That line is not waiting for confirmation.");
  const now = new Date().toISOString();
  let corrected = false;

  if (body.correction) {
    const c = sanitizeLine({ ...line, ...body.correction, pattern: { ...line.pattern, ...(body.correction.pattern || {}) } });
    requireValidSchedule(c, i);
    Object.assign(line, { name: c.name, strength: c.strength, form: c.form, food: c.food, pattern: c.pattern, days: c.days, ingredient: c.ingredient });
    corrected = true;
    line.correctedByPrescriber = true;
  } else {
    requireValidSchedule(sanitizeLine(line), i);
  }

  line.prescriberQuestion = line.note;
  line.status = "confirmed";
  line.note = "";
  line.confirmedBy = { id: user.id, name: user.name, role: user.role, at: now };
  card.prescriberId = user.id;
  card.events.push({ type: corrected ? "prescriber_corrected" : "prescriber_confirmed", line: i, by: user.name, byId: user.id, role: user.role, at: now });

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
  card.events.push({ type: "issued", by: user.name, byId: user.id, role: user.role, at: now });
  return card;
}

export function applyTeachBack(card, body, user) {
  if (card.status !== "issued") throw new ValidationError("Teach-back is only recorded on issued cards.");
  if (!["pass", "fail"].includes(body.result)) throw new ValidationError("Result must be pass or fail.");
  const now = new Date().toISOString();
  card.teachBack = { result: body.result, by: user.name, at: now };
  card.events.push({ type: `teach_back_${body.result}`, by: user.name, byId: user.id, role: user.role, at: now });
  return card;
}

export function applyConsent(card, body, user) {
  const now = new Date().toISOString();
  card.consent = { family: body.family === true, dataUse: body.dataUse === true, by: user.name, at: now };
  if (!card.consent.family) card.sharedWith = [];
  card.events.push({ type: "consent_recorded", by: user.name, byId: user.id, role: user.role, at: now, detail: `family=${card.consent.family}, dataUse=${card.consent.dataUse}` });
  return card;
}

export function applyShare(card, body, user) {
  if (!card.consent?.family) throw new ValidationError("Record the patient's consent before sharing the card with family.");
  card.sharedWith = parseEmails(body.sharedWith);
  card.events.push({ type: "shared_with_family", by: user.name, byId: user.id, role: user.role, at: new Date().toISOString(), detail: `${card.sharedWith.length} recipient(s)` });
  return card;
}

export function applyFollowUp(card, body, user) {
  if (card.status !== "issued") throw new ValidationError("Only issued cards have follow-ups.");
  const now = new Date().toISOString();
  card.followUp = { by: user.name, at: now, note: clean(body.note, 200) };
  card.events.push({ type: "follow_up_done", by: user.name, byId: user.id, role: user.role, at: now });
  return card;
}

export const VOID_REASONS = ["wrong_entry", "patient_request", "other"];

export function applyVoid(card, body, user) {
  if (!["issued", "ready_to_issue", "awaiting_prescriber"].includes(card.status)) throw new ValidationError("This card cannot be withdrawn.");
  const reason = VOID_REASONS.includes(body.reason) ? body.reason : null;
  const note = clean(body.note, 300);
  if (!reason) throw new ValidationError("Choose a reason for withdrawing the card.");
  if (note.length < 5) throw new ValidationError("Write a short note explaining why the card is withdrawn.");
  const now = new Date().toISOString();
  card.status = "voided";
  card.voided = { reason, note, by: user.name, at: now };
  card.events.push({ type: "voided", by: user.name, byId: user.id, role: user.role, at: now, detail: `${reason}: ${note}` });
  return card;
}

// For offline cards (or any card) that still have flags nobody has answered.
export function applyGuardAck(card, body, user) {
  const flag = (card.guard?.flags || []).find((f) => f.key === body.key);
  if (!flag) throw new ValidationError("That DoctorGuard flag was not found.");
  const now = new Date().toISOString();
  const who = { by: user.name, byId: user.id, role: user.role };
  const note = clean(body.note, 300);

  if (user.role === "doctor") {
    if (!flag.ack || flag.ack.action !== "referred") throw new ValidationError("This flag is not waiting for the prescriber.");
    if (note.length < 5) throw new ValidationError("Write a short note with your decision.");
    flag.ack.resolved = { ...who, at: now, note };
    card.events.push({ type: "guard_resolved", ...who, at: now, detail: flag.title });
  } else {
    if (flag.ack) throw new ValidationError("This flag has already been answered.");
    if (!["accepted", "referred"].includes(body.decision)) throw new ValidationError('Choose "I reviewed this" or "Refer to prescriber".');
    if (body.decision === "accepted" && flag.severity === "high" && note.length < 10) {
      throw new ValidationError("High-severity flag: write why you are proceeding (at least 10 characters) or refer it to the prescriber.");
    }
    flag.ack = { action: body.decision, note, ...who, at: now };
    if (body.decision === "referred") card.doctorVisible = true;
    card.events.push({ type: body.decision === "referred" ? "guard_referred" : "guard_accepted", ...who, at: now, detail: flag.title });
  }
  card.guardReview = guardReviewState(card);
  return card;
}
