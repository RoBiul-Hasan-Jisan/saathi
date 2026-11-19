import { STAFF } from "./constants.js";

// Who may open which card. The admin role is deliberately absent: admins work from
// de-identified lists, never from a patient's card.
export function canViewCard(user, card) {
  if (!user || !card) return false;
  switch (user.role) {
    case "pharmacist":
    case "chw":
      return card.org === user.org;
    case "doctor":
      return !!card.doctorVisible || (card.events || []).some((e) => e.byId === user.id) || card.prescriberId === user.id;
    case "patient":
    case "caregiver":
      return !!card.consent?.family && (card.sharedWith || []).includes((user.email || "").toLowerCase());
    default:
      return false;
  }
}

export const isStaff = (user) => STAFF.includes(user?.role);

// Incidents: staff see their own pharmacy/clinic, doctors see what was escalated to them.
export function canSeeIncident(user, incident) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "doctor") return incident.status === "escalated" || incident.escalatedTo === user.id;
  if (STAFF.includes(user.role)) return incident.org === user.org;
  return false;
}
