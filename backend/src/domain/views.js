import { courseEndsOn, followUpInfo } from "./schedule.js";
import { diffDays, dhakaDate } from "../lib/dates.js";

// Different people see different slices of the same card.

const withCourse = (card) => {
  const endsOn = courseEndsOn(card);
  return { courseEndsOn: endsOn, daysLeft: endsOn ? diffDays(dhakaDate(), endsOn) : null };
};

// Pharmacist / health worker / doctor: the whole card, including the audit trail.
export function staffCardView(card) {
  return { ...card, ...withCourse(card) };
}

// Patient or caregiver logged in: the plan and who verified it, no internal trail or contact details.
export function familyCardView(card) {
  return {
    id: card.id,
    token: card.token,
    patientName: card.patientName,
    patientAge: card.patientAge,
    lines: card.lines,
    status: card.status,
    verifier: card.verifier ? { name: card.verifier.name, at: card.verifier.at } : null,
    issuedAt: card.issuedAt,
    createdAt: card.createdAt,
    teachBack: null,
    ...withCourse(card),
  };
}

// Public QR page: the same, reachable without logging in.
export function publicCardView(card) {
  return { ...familyCardView(card), voided: card.status === "voided" ? { at: card.voided?.at } : undefined };
}

export function viewFor(user, card) {
  if (user.role === "patient" || user.role === "caregiver") return familyCardView(card);
  return staffCardView(card);
}

const ageBand = (a) => (a == null ? "unknown" : a < 5 ? "0-4" : a < 15 ? "5-14" : a < 45 ? "15-44" : a < 65 ? "45-64" : "65+");

// Admin list row: no name, phone, email or exact age. Short reference only.
export function adminCardRow(card, orgName) {
  return {
    ref: card.id.slice(0, 6),
    org: card.org,
    orgName: orgName || card.org,
    status: card.status,
    ageBand: ageBand(card.patientAge),
    medicines: card.lines.length,
    unclear: card.lines.filter((l) => l.status === "unclear" || l.prescriberQuestion).length,
    guardFlags: (card.guard?.flags || []).length,
    verifiedBy: card.verifier?.name || null,
    verifiedAt: card.verifier?.at || null,
    teachBack: card.teachBack?.result || null,
    creationSeconds: card.creationSeconds ?? null,
    offline: !!card.offline,
    createdAt: card.createdAt,
  };
}

export { ageBand, followUpInfo };
