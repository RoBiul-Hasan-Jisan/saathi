export const DEMO_ORG = "demo";

// One-click demo accounts. They need no password and no database round-trip:
// the session cookie is signed straight from this list.
export const DEMO_USERS = [
  {
    id: "demo-pharmacist",
    name: "Demo Pharmacist",
    email: "pharmacist@saathi.demo",
    role: "pharmacist",
    org: DEMO_ORG,
    demo: true,
    title: "Pharmacist / clinic worker",
    blurb: "Enter a prescription, verify each line, issue and print the card.",
  },
  {
    id: "demo-patient",
    name: "Demo Patient",
    email: "patient@saathi.demo",
    role: "patient",
    org: DEMO_ORG,
    demo: true,
    title: "Patient",
    blurb: "Listen to the Bangla audio guide and read the timetable.",
  },
  {
    id: "demo-caregiver",
    name: "Demo Caregiver",
    email: "caregiver@saathi.demo",
    role: "caregiver",
    org: DEMO_ORG,
    demo: true,
    title: "Caregiver / family",
    blurb: "See the same verified card from another city.",
  },
  {
    id: "demo-doctor",
    name: "Demo Doctor",
    email: "doctor@saathi.demo",
    role: "doctor",
    org: DEMO_ORG,
    demo: true,
    title: "Doctor / prescriber",
    blurb: "Answer \"please confirm\" questions with one tap.",
  },
  {
    id: "demo-chw",
    name: "Demo Health Worker",
    email: "chw@saathi.demo",
    role: "chw",
    org: DEMO_ORG,
    demo: true,
    title: "Community health worker",
    blurb: "Run assisted sessions at camps and home visits.",
  },
  {
    id: "demo-admin",
    name: "Demo Admin",
    email: "admin@saathi.demo",
    role: "admin",
    org: DEMO_ORG,
    demo: true,
    title: "Admin / programme manager",
    blurb: "Pilot metrics, verification logs and the template library.",
  },
];

export const ROLE_LABELS = {
  pharmacist: "Pharmacist / clinic worker",
  patient: "Patient",
  caregiver: "Caregiver / family",
  doctor: "Doctor / prescriber",
  chw: "Community health worker",
  admin: "Admin / programme manager",
};

// Roles anyone may pick when signing up with Firebase. Doctor and admin are
// assigned by an administrator, never self-selected.
export const SELF_SIGNUP_ROLES = ["pharmacist", "patient", "caregiver", "chw"];
