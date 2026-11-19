import { newId } from "../lib/ids.js";
import { ValidationError } from "../lib/errors.js";
import { clean, normalizePhone } from "../lib/validate.js";

export const INCIDENT_TYPES = ["reaction", "wrong_entry", "other"];
export const SEVERITIES = ["mild", "moderate", "serious"];

// Patients pick how worried they are; we map that to a severity. No AI answers anywhere in this flow.
export const REPORTED = { mild: "mild", worried: "moderate", emergency: "serious" };

export function newIncident({ type, card, severity, description, contactPhone, contactOk, reporter, now }) {
  const text = clean(description, 600);
  if (text.length < 5) throw new ValidationError("Please describe what happened (at least a few words).");
  if (!INCIDENT_TYPES.includes(type)) throw new ValidationError("Unknown incident type.");
  if (!SEVERITIES.includes(severity)) throw new ValidationError("Unknown severity.");
  let phone = "";
  if (contactOk === true && contactPhone) phone = normalizePhone(contactPhone);
  return {
    id: newId(),
    type,
    cardId: card?.id || null,
    org: card?.org || reporter.org || null,
    severity,
    description: text,
    contactPhone: phone,
    contactOk: contactOk === true,
    reportedBy: { role: reporter.role, id: reporter.id || null, name: reporter.name || null },
    status: "new",
    notes: [],
    handledBy: null,
    escalatedTo: null,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    outcome: null,
  };
}

const note = (user, text, now, kind) => ({ id: newId(), kind, by: user.name, byId: user.id, role: user.role, at: now, text: clean(text, 600) });

export function applyIncidentAction(inc, body, user) {
  const now = new Date().toISOString();
  const text = clean(body.note, 600);
  switch (body.action) {
    case "acknowledge":
      if (inc.status !== "new") throw new ValidationError("This report has already been acknowledged.");
      inc.status = "acknowledged";
      inc.handledBy = { id: user.id, name: user.name, role: user.role };
      inc.notes.push(note(user, text || "Acknowledged.", now, "acknowledged"));
      break;
    case "note":
      if (text.length < 2) throw new ValidationError("Write a note.");
      if (inc.status === "closed") throw new ValidationError("This report is closed.");
      inc.notes.push(note(user, text, now, "note"));
      break;
    case "escalate":
      if (user.role === "doctor" || user.role === "admin") throw new ValidationError("Only pharmacy or health staff escalate to a doctor.");
      if (inc.status === "closed") throw new ValidationError("This report is closed.");
      inc.status = "escalated";
      inc.escalatedAt = now;
      inc.notes.push(note(user, text || "Escalated to a doctor.", now, "escalated"));
      break;
    case "close":
      if (text.length < 5) throw new ValidationError("Write the outcome before closing.");
      if (inc.status === "closed") throw new ValidationError("This report is already closed.");
      inc.status = "closed";
      inc.closedAt = now;
      inc.outcome = text;
      inc.notes.push(note(user, text, now, "closed"));
      break;
    default:
      throw new ValidationError("Unknown action.");
  }
  inc.updatedAt = now;
  return inc;
}

// Admins review incidents without learning who the patient is.
export function incidentView(inc, user) {
  if (user.role !== "admin") return inc;
  const { contactPhone, contactOk, reportedBy, ...rest } = inc;
  return { ...rest, reportedBy: { role: reportedBy.role } };
}

// Wrong medicine name / dose instruction, or a serious incident logged by staff, pauses new cards.
export const triggersSafetyGate = (inc, reporterRole) =>
  inc.type === "wrong_entry" || (inc.severity === "serious" && reporterRole !== "patient");
