// Staff who may create and issue cards.
export const STAFF = ["pharmacist", "chw"];

export function canViewCard(user, card) {
  if (!user || !card) return false;
  switch (user.role) {
    case "admin":
    case "doctor":
      return true;
    case "pharmacist":
    case "chw":
      return card.org === user.org;
    case "patient":
    case "caregiver":
      return (card.sharedWith || []).includes((user.email || "").toLowerCase());
    default:
      return false;
  }
}

// What the public QR page may show: no phone, no emails, no audit trail.
export function publicCard(card) {
  return {
    id: card.id,
    token: card.token,
    patientName: card.patientName,
    patientAge: card.patientAge,
    lines: card.lines,
    status: card.status,
    verifier: card.verifier ? { name: card.verifier.name, at: card.verifier.at } : null,
    issuedAt: card.issuedAt,
  };
}
