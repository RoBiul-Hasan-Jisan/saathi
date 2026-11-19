import { col, mongoDb } from "./collections.js";
import { DEFAULT_CONTENT, KINDS } from "../domain/defaultLibrary.js";
import { DEMO_ORG } from "../domain/demoUsers.js";
import { addDays, dhakaDate, dhakaToIso } from "../lib/dates.js";
import { GRACE_MIN, SLOT_TIMES, TIMES } from "../domain/constants.js";
import { expectedSlots } from "../domain/schedule.js";

// Sample data so every demo role has something to look at immediately. Idempotent.
// Medicine names and doses here are placeholders, NOT medical advice.

const ago = (h) => new Date(Date.now() - h * 3600_000).toISOString();
const pharmacist = { id: "demo-pharmacist", name: "Demo Pharmacist", role: "pharmacist" };
const emptyGuard = { checkedAt: null, flags: [], unchecked: [], libraryReviewed: false };

const line = (name, strength, form, food, pattern, days, by, at, extra = {}) => ({
  name, strength, form, food, pattern, days, ingredient: "", status: "confirmed", note: "",
  confirmedBy: { ...by, at }, ...extra,
});

function seedCards() {
  const base = (id, token, patientId, name, age, shared, at, extra) => ({
    id, token, org: DEMO_ORG, demo: true, clientId: null, patientId, patientName: name, patientAge: age,
    patientPhone: "", sharedWith: shared, consent: { family: true, dataUse: true, by: pharmacist.name, at },
    createdBy: { id: pharmacist.id, name: pharmacist.name }, createdAt: at, followUp: null, source: "manual",
    eprescriptionId: null, prescriberId: null, doctorVisible: false, offline: false, syncedAt: null,
    guard: { ...emptyGuard, checkedAt: at }, guardReview: null, ...extra,
  });
  const ev = (type, at, extra = {}) => ({ type, by: pharmacist.name, byId: pharmacist.id, role: "pharmacist", at, ...extra });

  const t1 = ago(30), t2 = ago(8), t3 = ago(2);
  return [
    base("seed-1", "demo-card-1", "seed-p1", "Rahima Khatun (sample)", 54, ["patient@saathi.demo", "caregiver@saathi.demo"], t1, {
      lines: [
        line("Sample Tablet A", "500 mg", "tablet", "after", { morning: 1, afternoon: 1, night: 1 }, 3, pharmacist, t1),
        line("Sample Capsule B", "250 mg", "capsule", "before", { morning: 1, afternoon: 0, night: 1 }, 5, pharmacist, t1),
      ],
      status: "issued", verifier: { id: pharmacist.id, name: pharmacist.name, at: t1 }, issuedAt: t1, creationSeconds: 112,
      teachBack: { result: "pass", by: pharmacist.name, at: ago(29.9) },
      events: [ev("created", t1), ev("issued", t1), ev("teach_back_pass", ago(29.9))],
    }),
    base("seed-2", "demo-card-2", "seed-p2", "Karim Uddin (sample)", 7, ["patient@saathi.demo"], t2, {
      lines: [line("Sample Syrup C", "125 mg/5 ml", "syrup", "after", { morning: 5, afternoon: 5, night: 5 }, 5, pharmacist, t2)],
      status: "issued", verifier: { id: pharmacist.id, name: pharmacist.name, at: t2 }, issuedAt: t2, creationSeconds: 74,
      teachBack: { result: "fail", by: pharmacist.name, at: ago(7.9) },
      events: [ev("created", t2), ev("issued", t2), ev("teach_back_fail", ago(7.9))],
    }),
    base("seed-3", "demo-card-3", "seed-p3", "Jahanara Begum (sample)", 63, [], t3, {
      consent: { family: false, dataUse: false, by: pharmacist.name, at: t3 },
      lines: [
        line("Sample Tablet D", "10 mg", "tablet", "after", { morning: 0, afternoon: 0, night: 1 }, 7, pharmacist, t3),
        {
          name: "(handwriting unclear)", strength: "", form: "tablet", food: "none", pattern: { morning: 0, afternoon: 0, night: 0 },
          days: 0, ingredient: "", status: "unclear",
          note: "Medicine name and dose cannot be read on the prescription. Please confirm name, dose, timing and days.",
        },
      ],
      status: "awaiting_prescriber", verifier: null, issuedAt: null, creationSeconds: 95, teachBack: null, doctorVisible: true,
      events: [ev("created", t3), ev("flagged_unclear", t3, { line: 1, detail: "Medicine name and dose cannot be read on the prescription." })],
    }),
  ];
}

function seedIntakes() {
  // Seed-1 course: tick every passed dose except the most recent one, so a caregiver sees one missed-dose alert.
  const card = seedCards()[0];
  const now = new Date().toISOString();
  const passed = [];
  for (let d = dhakaDate(card.issuedAt); d <= dhakaDate(now); d = addDays(d, 1)) {
    for (const slot of expectedSlots(card, d)) {
      // Only doses already past their grace period count, so the skipped one below is a real "missed" dose.
      if (Date.parse(dhakaToIso(d, SLOT_TIMES[slot])) + GRACE_MIN * 60000 < Date.parse(now)) passed.push({ date: d, slot });
    }
  }
  return passed.slice(0, -1).map((p, i) => ({
    id: `seed-intake-${i}`, cardId: card.id, date: p.date, slot: p.slot, takenAt: dhakaToIso(p.date, SLOT_TIMES[p.slot]), source: "patient",
  }));
}

let seeded = null;

export async function ensureSeed() {
  const db = await mongoDb();
  const key = db ? "mongo" : "memory";
  if (seeded?.key === key) return seeded.promise;
  const promise = runSeed(db).catch((err) => {
    seeded = null;
    throw err;
  });
  seeded = { key, promise };
  return promise;
}

export function resetSeedState() {
  seeded = null;
}

async function runSeed(db) {
  if (db) {
    const unique = { cards: [["id"], ["token"]], users: [["id"], ["email"]], library: [["id"]], voiceclips: [["id"]], incidents: [["id"]], patients: [["id"]] };
    for (const [name, idx] of Object.entries(unique)) for (const [k] of idx) await db.collection(name).createIndex({ [k]: 1 }, { unique: true });
    await db.collection("intakes").createIndex({ cardId: 1, date: 1, slot: 1 });
  }

  const now = new Date().toISOString();
  const orgs = await col("orgs");
  await orgs.insertIfMissing({ id: DEMO_ORG, name: "Demo Pharmacy (sample)", type: "pharmacy", district: "Chattogram", active: true, createdAt: now });
  await orgs.insertIfMissing({ id: "demo-clinic", name: "Demo Community Clinic (sample)", type: "clinic", district: "Chattogram", active: true, createdAt: now });

  const lib = await col("library");
  for (const kind of KINDS) {
    await lib.insertIfMissing({
      id: `lib-${kind}-1`, kind, version: 1, status: "approved", content: DEFAULT_CONTENT[kind],
      proposedBy: null, reviewedBy: null, reviewedAt: null, note: "Sample content shipped with the app. Not clinically reviewed.", createdAt: now,
    });
  }

  await (await col("settings")).insertIfMissing({ id: "global", safetyGate: { paused: false } });

  const patients = await col("patients");
  const p = (id, name, phone, age, allergies) => ({ id, org: DEMO_ORG, name, phone, ageYears: age, allergies, createdAt: now, updatedAt: now });
  await patients.insertIfMissing(p("seed-p1", "Rahima Khatun (sample)", "8801700000001", 54, ["penicillin"]));
  await patients.insertIfMissing(p("seed-p2", "Karim Uddin (sample)", "8801700000002", 7, []));
  await patients.insertIfMissing(p("seed-p3", "Jahanara Begum (sample)", "8801700000003", 63, []));

  const cards = await col("cards");
  for (const c of seedCards()) await cards.insertIfMissing(c);
  const intakes = await col("intakes");
  for (const i of seedIntakes()) await intakes.insertIfMissing(i);

  await (await col("incidents")).insertIfMissing({
    id: "seed-incident-1", type: "reaction", cardId: "seed-1", org: DEMO_ORG, severity: "moderate",
    description: "Feeling dizzy after the night dose (sample report).", contactPhone: "", contactOk: false,
    reportedBy: { role: "patient", id: null, name: null }, status: "new", notes: [], handledBy: null, escalatedTo: null,
    createdAt: ago(5), updatedAt: ago(5), closedAt: null, outcome: null,
  });

  await (await col("eprescriptions")).insertIfMissing({
    id: "seed-erx-1", toOrg: DEMO_ORG, doctorId: "demo-doctor", doctorName: "Demo Doctor", patientName: "Nasrin Akter (sample)",
    patientAge: 41, patientPhone: "8801700000004", note: "Sample e-prescription. Still needs full verification at the counter.",
    lines: [{ name: "Sample Tablet E", strength: "20 mg", form: "tablet", food: "after", pattern: { morning: 0, afternoon: 0, night: 1 }, days: 5, ingredient: "" }],
    status: "sent", createdAt: ago(1), importedAt: null, importedCardId: null,
  });
}

export { TIMES };
