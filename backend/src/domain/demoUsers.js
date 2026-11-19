export const DEMO_ORG = "demo";

// One-click accounts. They are signed straight into the session cookie: no password,
// no database or Firebase round-trip, so login is instant.
export const DEMO_USERS = [
  { id: "demo-pharmacist", name: "Demo Pharmacist", email: "pharmacist@saathi.demo", role: "pharmacist", org: DEMO_ORG,
    title: "Pharmacist / clinic worker", blurb: "Create a card, run DoctorGuard, issue and print it." },
  { id: "demo-patient", name: "Demo Patient", email: "patient@saathi.demo", role: "patient", org: DEMO_ORG,
    title: "Patient", blurb: "Bangla audio, timetable, “I took it”, report a problem." },
  { id: "demo-caregiver", name: "Demo Caregiver", email: "caregiver@saathi.demo", role: "caregiver", org: DEMO_ORG,
    title: "Caregiver / family", blurb: "See the card from another city and get missed-dose alerts." },
  { id: "demo-doctor", name: "Demo Doctor", email: "doctor@saathi.demo", role: "doctor", org: DEMO_ORG,
    title: "Doctor / prescriber", blurb: "Confirm unclear lines, send e-prescriptions, sign off the library." },
  { id: "demo-chw", name: "Demo Health Worker", email: "chw@saathi.demo", role: "chw", org: DEMO_ORG,
    title: "Community health worker", blurb: "Assisted sessions, follow-ups and incident handling." },
  { id: "demo-admin", name: "Demo Admin", email: "admin@saathi.demo", role: "admin", org: DEMO_ORG,
    title: "Admin / programme manager", blurb: "Pilot metrics, staff, library, voices, safety gate, exports." },
].map((u) => ({ ...u, demo: true, active: true }));
