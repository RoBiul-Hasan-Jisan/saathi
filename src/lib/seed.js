import { DEMO_ORG } from "./demoUsers";

const ago = (hours) => new Date(Date.now() - hours * 3600_000).toISOString();

// Sample cards so every demo role has something to look at immediately.
// Medicine names and doses are placeholders, NOT medical advice.
export function buildSeedCards() {
  const pharmacist = { id: "demo-pharmacist", name: "Demo Pharmacist", role: "pharmacist" };

  const confirmed = (at) => ({ ...pharmacist, at });

  return [
    {
      id: "seed-1",
      token: "demo-card-1",
      org: DEMO_ORG,
      demo: true,
      patientName: "Rahima Khatun (sample)",
      patientAge: "54",
      patientPhone: "",
      sharedWith: ["patient@saathi.demo", "caregiver@saathi.demo"],
      lines: [
        {
          name: "Sample Tablet A",
          strength: "500 mg",
          form: "tablet",
          food: "after",
          pattern: { morning: 1, afternoon: 1, night: 1 },
          days: 3,
          status: "confirmed",
          note: "",
          confirmedBy: confirmed(ago(30)),
        },
        {
          name: "Sample Capsule B",
          strength: "250 mg",
          form: "capsule",
          food: "before",
          pattern: { morning: 1, afternoon: 0, night: 1 },
          days: 5,
          status: "confirmed",
          note: "",
          confirmedBy: confirmed(ago(30)),
        },
      ],
      status: "issued",
      verifier: { id: pharmacist.id, name: pharmacist.name, at: ago(30) },
      createdBy: { id: pharmacist.id, name: pharmacist.name },
      createdAt: ago(30),
      issuedAt: ago(30),
      creationSeconds: 112,
      teachBack: { result: "pass", by: pharmacist.name, at: ago(29.9) },
      events: [
        { type: "created", by: pharmacist.name, role: "pharmacist", at: ago(30) },
        { type: "issued", by: pharmacist.name, role: "pharmacist", at: ago(30) },
        { type: "teach_back_pass", by: pharmacist.name, role: "pharmacist", at: ago(29.9) },
      ],
    },
    {
      id: "seed-2",
      token: "demo-card-2",
      org: DEMO_ORG,
      demo: true,
      patientName: "Karim Uddin (sample)",
      patientAge: "7",
      patientPhone: "",
      sharedWith: ["patient@saathi.demo"],
      lines: [
        {
          name: "Sample Syrup C",
          strength: "125 mg/5 ml",
          form: "syrup",
          food: "after",
          pattern: { morning: 5, afternoon: 5, night: 5 },
          days: 5,
          status: "confirmed",
          note: "",
          confirmedBy: confirmed(ago(8)),
        },
      ],
      status: "issued",
      verifier: { id: pharmacist.id, name: pharmacist.name, at: ago(8) },
      createdBy: { id: pharmacist.id, name: pharmacist.name },
      createdAt: ago(8),
      issuedAt: ago(8),
      creationSeconds: 74,
      teachBack: { result: "fail", by: pharmacist.name, at: ago(7.9) },
      events: [
        { type: "created", by: pharmacist.name, role: "pharmacist", at: ago(8) },
        { type: "issued", by: pharmacist.name, role: "pharmacist", at: ago(8) },
        { type: "teach_back_fail", by: pharmacist.name, role: "pharmacist", at: ago(7.9) },
      ],
    },
    {
      id: "seed-3",
      token: "demo-card-3",
      org: DEMO_ORG,
      demo: true,
      patientName: "Jahanara Begum (sample)",
      patientAge: "63",
      patientPhone: "",
      sharedWith: [],
      lines: [
        {
          name: "Sample Tablet D",
          strength: "10 mg",
          form: "tablet",
          food: "after",
          pattern: { morning: 0, afternoon: 0, night: 1 },
          days: 7,
          status: "confirmed",
          note: "",
          confirmedBy: confirmed(ago(2)),
        },
        {
          name: "(handwriting unclear)",
          strength: "",
          form: "tablet",
          food: "none",
          pattern: { morning: 0, afternoon: 0, night: 0 },
          days: 0,
          status: "unclear",
          note: "Medicine name and dose cannot be read on the prescription. Please confirm name, dose, timing and days.",
        },
      ],
      status: "awaiting_prescriber",
      verifier: null,
      createdBy: { id: pharmacist.id, name: pharmacist.name },
      createdAt: ago(2),
      issuedAt: null,
      creationSeconds: 95,
      teachBack: null,
      events: [
        { type: "created", by: pharmacist.name, role: "pharmacist", at: ago(2) },
        {
          type: "flagged_unclear",
          line: 1,
          by: pharmacist.name,
          role: "pharmacist",
          at: ago(2),
          detail: "Medicine name and dose cannot be read on the prescription.",
        },
      ],
    },
  ];
}
