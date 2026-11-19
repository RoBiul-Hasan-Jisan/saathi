import test from "node:test";
import assert from "node:assert/strict";
import { addDays, dhakaDate, dhakaToIso, diffDays, weekStart } from "../src/lib/dates.js";
import { adherence, courseEndsOn, expectedSlots } from "../src/domain/schedule.js";
import { dailyMg, parseStrength, runGuard } from "../src/domain/guard.js";
import { validateContent } from "../src/domain/library.js";
import { DEFAULT_CONTENT } from "../src/domain/defaultLibrary.js";
import { normalizePhone } from "../src/lib/validate.js";
import { signJwt, verifyJwt } from "../src/lib/jwt.js";

test("Dhaka dates use UTC+6", () => {
  assert.equal(dhakaDate("2026-11-15T20:00:00Z"), "2026-11-16"); // 02:00 next day in Dhaka
  assert.equal(dhakaToIso("2026-11-16", "08:00"), "2026-11-16T02:00:00.000Z");
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(diffDays("2026-11-01", "2026-11-04"), 3);
  assert.equal(weekStart("2026-11-18T05:00:00Z"), "2026-11-16"); // Wednesday -> Monday
});

test("phone numbers are normalised", () => {
  assert.equal(normalizePhone("01712345678"), "8801712345678");
  assert.equal(normalizePhone("+880 1712-345678"), "8801712345678");
  assert.equal(normalizePhone(""), "");
  assert.throws(() => normalizePhone("12"));
});

test("JWT round trip, tampering and expiry", () => {
  const t = signJwt({ sub: "a" }, "s3cret", 60);
  assert.equal(verifyJwt(t, "s3cret").sub, "a");
  assert.equal(verifyJwt(t, "other"), null);
  assert.equal(verifyJwt(t.slice(0, -2) + "xx", "s3cret"), null);
  assert.equal(verifyJwt(signJwt({ sub: "a" }, "s3cret", -10), "s3cret"), null);
});

const card = (issuedAt, days = 2) => ({
  issuedAt,
  lines: [{ status: "confirmed", days, pattern: { morning: 1, afternoon: 0, night: 1 } }],
});

test("schedule: course end, first-day slots and adherence", () => {
  const c = card("2026-11-16T04:00:00.000Z"); // 10:00 Dhaka on the 16th
  assert.equal(courseEndsOn(c), "2026-11-17");
  assert.deepEqual(expectedSlots(c, "2026-11-16"), ["night"]); // morning (08:00) was before issue
  assert.deepEqual(expectedSlots(c, "2026-11-17"), ["morning", "night"]);
  assert.deepEqual(expectedSlots(c, "2026-11-18"), []);

  const now = "2026-11-17T05:00:00.000Z"; // 11:00 Dhaka on the 17th
  const a = adherence(c, [{ date: "2026-11-16", slot: "night" }], now);
  assert.equal(a.expected, 2); // night 16th (taken) + morning 17th (past grace, missed)
  assert.equal(a.taken, 1);
  assert.deepEqual(a.missed, [{ date: "2026-11-17", slot: "morning" }]);
  assert.equal(a.percent, 50);
});

test("strength parsing and daily totals", () => {
  assert.deepEqual(parseStrength("500 mg"), { mg: 500, perMl: null });
  assert.equal(parseStrength("1 g").mg, 1000);
  assert.equal(parseStrength("125 mg/5 ml").perMl, 25);
  assert.equal(parseStrength("strong"), null);
  const tab = { form: "tablet", strength: "500 mg", pattern: { morning: 2, afternoon: 0, night: 2 } };
  assert.equal(dailyMg(tab), 2000);
  const syrup = { form: "syrup", strength: "125 mg/5 ml", pattern: { morning: 5, afternoon: 5, night: 5 } };
  assert.equal(dailyMg(syrup), 375);
  assert.equal(dailyMg({ form: "drops", strength: "5 mg", pattern: { morning: 1 } }), null);
});

const L = (name, strength, pattern, extra = {}) => ({ name, strength, form: "tablet", ingredient: "", pattern, days: 5, ...extra });
const lib = { ingredients: DEFAULT_CONTENT.ingredients, rules: DEFAULT_CONTENT.rules };

test("DoctorGuard: allergy, duplicate, class duplicate, interaction, max dose", () => {
  const allergy = runGuard({ lines: [L("Amoxicillin", "500 mg", { morning: 1 })], patient: { allergies: ["Penicillin"] }, library: lib });
  assert.equal(allergy.flags[0].kind, "allergy");
  assert.equal(allergy.flags[0].severity, "high");
  assert.ok(allergy.flags[0].source.url);

  const dup = runGuard({ lines: [L("Paracetamol", "500 mg", { morning: 1 }), L("acetaminophen", "500 mg", { night: 1 })], library: lib });
  assert.ok(dup.flags.some((f) => f.kind === "duplicate"));

  const nsaids = runGuard({ lines: [L("Ibuprofen", "400 mg", { morning: 1 }), L("Diclofenac", "50 mg", { night: 1 })], library: lib });
  assert.ok(nsaids.flags.some((f) => f.kind === "classDuplicate"));

  const inter = runGuard({ lines: [L("Ibuprofen", "400 mg", { morning: 1 }), L("Aspirin", "75 mg", { night: 1 })], library: lib });
  assert.ok(inter.flags.some((f) => f.kind === "interaction"));

  const over = runGuard({ lines: [L("Paracetamol", "1 g", { morning: 2, afternoon: 2, night: 2 })], patient: { ageYears: 30 }, library: lib });
  assert.ok(over.flags.some((f) => f.kind === "maxDaily" && f.severity === "high"));

  const child = runGuard({ lines: [L("Paracetamol", "1 g", { morning: 2, afternoon: 2, night: 2 })], patient: { ageYears: 8 }, library: lib });
  assert.ok(!child.flags.some((f) => f.kind === "maxDaily"));
  assert.ok(child.unchecked.some((u) => /child/i.test(u.reason)));

  const safe = runGuard({ lines: [L("Paracetamol", "500 mg", { morning: 1, night: 1 })], patient: { ageYears: 30 }, library: lib });
  assert.equal(safe.flags.length, 0);

  const unknown = runGuard({ lines: [L("Sample Tablet A", "5 mg", { morning: 1 })], library: lib });
  assert.equal(unknown.flags.length, 0);
  assert.equal(unknown.unchecked.length, 1);
});

test("DoctorGuard: counts an active earlier card", () => {
  const active = [{ issuedAt: "2026-11-10T00:00:00Z", lines: [{ status: "confirmed", name: "Paracetamol", strength: "500 mg", form: "tablet", pattern: { morning: 1 } }] }];
  const r = runGuard({ lines: [L("Paracetamol", "500 mg", { night: 1 })], activeCards: active, library: lib });
  assert.ok(r.flags.some((f) => f.kind === "duplicate" && /issued on/.test(f.message)));
});

test("library validation", () => {
  assert.throws(() => validateContent("rules", [{ id: "x1", type: "nope" }]), /unknown type/);
  assert.throws(() => validateContent("ingredients", [{ key: "A B", nameEn: "x" }]));
  assert.throws(() => validateContent("infoPanel", { titleBn: "x", itemsBn: [] }));
  const phrases = validateContent("phrases", { "time.morning": "ভোরে" });
  assert.equal(phrases["time.morning"], "ভোরে");
  assert.equal(phrases["time.night"], DEFAULT_CONTENT.phrases["time.night"]); // missing keys keep defaults
  assert.equal(validateContent("rules", DEFAULT_CONTENT.rules).length, DEFAULT_CONTENT.rules.length);
  assert.equal(validateContent("ingredients", DEFAULT_CONTENT.ingredients).length, DEFAULT_CONTENT.ingredients.length);
});
