import test, { before, after } from "node:test";
import assert from "node:assert/strict";

// Real server, real HTTP, in-memory store. Each "Client" keeps its own cookie like a browser tab.
delete process.env.MONGODB_URI;
process.env.SESSION_SECRET = "test-secret-test-secret-test-secret";
process.env.ENABLE_DEMO = "true";
process.env.AUTH_RATE_LIMIT = "100000"; // the suite signs in many times from one address

const { buildApp } = await import("../src/app.js");
const { ensureSeed } = await import("../src/db/seed.js");
const { col } = await import("../src/db/collections.js");
const { signJwt } = await import("../src/lib/jwt.js");
const { config } = await import("../src/config.js");

let server;
let base;

class Client {
  cookie = "";
  bearer = "";
  async call(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    if (this.cookie) headers.Cookie = this.cookie;
    if (this.bearer) headers.Authorization = `Bearer ${this.bearer}`;
    const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.startsWith("saathi_session=;") || /Max-Age=0/.test(set) ? "" : set.split(";")[0];
    const type = res.headers.get("content-type") || "";
    const data = type.includes("json") ? await res.json() : type.startsWith("text/") ? await res.text() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  }
  get = (p) => this.call("GET", p);
  post = (p, b = {}) => this.call("POST", p, b);
  patch = (p, b = {}) => this.call("PATCH", p, b);
  del = (p, b = {}) => this.call("DELETE", p, b);
  async login(role) {
    const r = await this.post("/api/auth/demo", { role });
    assert.equal(r.status, 200, `demo login ${role}`);
    return this;
  }
}
const as = (role) => new Client().login(role);

const line = (o = {}) => ({
  name: "Sample Tablet", strength: "500 mg", form: "tablet", food: "after",
  pattern: { morning: 1, afternoon: 0, night: 1 }, days: 5, confirmed: true, ...o,
});
const newCard = (o = {}) => ({ patientName: "Test Patient", patientAge: "30", lines: [line()], ...o });

before(async () => {
  await ensureSeed();
  server = buildApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test("health, demo tiles and login/logout", async () => {
  const anon = new Client();
  assert.equal((await anon.get("/api/health")).data.ok, true);
  assert.equal((await anon.get("/api/auth/demo-users")).data.users.length, 6);
  assert.equal((await anon.get("/api/cards")).status, 401);
  assert.equal((await anon.post("/api/auth/demo", { role: "wizard" })).status, 400);
  const ph = await as("pharmacist");
  const me = await ph.get("/api/auth/me");
  assert.equal(me.data.user.role, "pharmacist");
  assert.equal((await ph.post("/api/auth/logout")).status, 200);
  assert.equal((await ph.get("/api/auth/me")).data.user, null);
  assert.equal((await anon.get("/api/nope")).status, 404);
});

test("who can see which card", async () => {
  const patient = await as("patient");
  const ids = (await patient.get("/api/cards")).data.cards.map((c) => c.id);
  assert.ok(ids.includes("seed-1") && ids.includes("seed-2"));
  assert.ok(!ids.includes("seed-3"), "not shared, no consent");
  const fam = (await patient.get("/api/cards/seed-1")).data.card;
  assert.equal(fam.patientPhone, undefined);
  assert.equal(fam.events, undefined);
  assert.equal((await patient.post("/api/cards", newCard())).status, 403);

  const admin = await as("admin");
  assert.equal((await admin.get("/api/cards/seed-1")).status, 404, "admins never open patient cards");

  const doctor = await as("doctor");
  assert.equal((await doctor.get("/api/cards/seed-3")).status, 200);
  assert.equal((await doctor.get("/api/cards/seed-1")).status, 404);
});

test("create, verify and issue a card; validation guards", async () => {
  const ph = await as("pharmacist");
  assert.equal((await ph.post("/api/cards", newCard({ lines: [line({ confirmed: false })] }))).status, 400);
  assert.equal((await ph.post("/api/cards", newCard({ lines: [line({ pattern: { morning: 0, afternoon: 0, night: 0 } })] }))).status, 400);
  assert.equal((await ph.post("/api/cards", newCard({ lines: [line({ pattern: { morning: 3, afternoon: 0, night: 0 } })] }))).status, 400, "3 tablets is not an approved amount");
  assert.equal((await ph.post("/api/cards", newCard({ lines: [line({ unclear: true, confirmed: false })] }))).status, 400, "unclear needs a question");
  assert.equal((await ph.post("/api/cards", newCard({ sharedWith: "a@b.com" }))).status, 400, "sharing needs consent");

  const r = await ph.post("/api/cards", newCard({ startedAt: Date.now() - 90_000 }));
  assert.equal(r.status, 201);
  assert.equal(r.data.status, "issued");
  const card = (await ph.get(`/api/cards/${r.data.id}`)).data.card;
  assert.equal(card.verifier.name, "Demo Pharmacist");
  assert.ok(card.creationSeconds >= 89);
  assert.ok(card.courseEndsOn);

  const pub = await new Client().get(`/api/public/cards/${r.data.token}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.data.card.patientPhone, undefined);
  assert.equal(pub.data.card.events, undefined);
  assert.equal((await new Client().get("/api/public/cards/does-not-exist")).status, 404);

  const tb = await ph.patch(`/api/cards/${r.data.id}`, { action: "teachback", result: "pass" });
  assert.equal(tb.data.card.teachBack.result, "pass");
});

test("unclear line -> prescriber -> read-back -> issue", async () => {
  const ph = await as("pharmacist");
  const doctor = await as("doctor");
  const r = await ph.post("/api/cards", newCard({
    lines: [line(), line({ name: "(unreadable)", unclear: true, confirmed: false, note: "Name unreadable", pattern: { morning: 0, afternoon: 0, night: 0 }, days: 0 })],
  }));
  assert.equal(r.data.status, "awaiting_prescriber");
  const id = r.data.id;
  assert.equal((await ph.patch(`/api/cards/${id}`, { action: "issue", readBack: true })).status, 400);
  assert.equal((await ph.patch(`/api/cards/${id}`, { action: "prescriber_confirm", lineIndex: 1 })).status, 403);
  assert.equal((await doctor.patch(`/api/cards/${id}`, { action: "prescriber_confirm", lineIndex: 1 })).status, 400, "cannot confirm an empty schedule as written");
  const fixed = await doctor.patch(`/api/cards/${id}`, {
    action: "prescriber_confirm", lineIndex: 1,
    correction: { name: "Real Name", form: "tablet", food: "before", days: 3, pattern: { morning: 0, afternoon: 0, night: 1 } },
  });
  assert.equal(fixed.data.card.status, "ready_to_issue");
  assert.equal((await ph.patch(`/api/cards/${id}`, { action: "issue" })).status, 400, "needs read-back tick");
  const issued = await ph.patch(`/api/cards/${id}`, { action: "issue", readBack: true });
  assert.equal(issued.data.card.status, "issued");
  assert.ok(issued.data.card.events.some((e) => e.type === "prescriber_corrected"));
});

test("DoctorGuard: flags need a named human decision", async () => {
  const ph = await as("pharmacist");
  const body = newCard({
    patientPhone: "01711111111", patientAllergies: ["penicillin"],
    lines: [line({ name: "Amoxicillin", strength: "500 mg" })],
  });
  const check = await ph.post("/api/cards/guard-check", { lines: body.lines, phone: body.patientPhone, allergies: ["penicillin"], age: 30 });
  assert.equal(check.data.flags[0].kind, "allergy");
  assert.equal(check.data.reviewed, false, "sample library is flagged as not clinically reviewed");
  const key = check.data.flags[0].key;

  assert.equal((await ph.post("/api/cards", body)).status, 400, "unanswered flag");
  assert.equal((await ph.post("/api/cards", { ...body, guardAcks: [{ key, action: "accepted", note: "ok" }] })).status, 400, "high severity needs a real reason");

  const referred = await ph.post("/api/cards", { ...body, guardAcks: [{ key, action: "referred", note: "Please confirm" }] });
  assert.equal(referred.status, 201);
  assert.equal(referred.data.status, "awaiting_prescriber", "referral sends it to the prescriber");

  const accepted = await ph.post("/api/cards", {
    ...body, patientPhone: "01722222222",
    guardAcks: [{ key, action: "accepted", note: "Patient says this is a different drug family; documented." }],
  });
  const card = (await ph.get(`/api/cards/${accepted.data.id}`)).data.card;
  assert.equal(card.guard.flags[0].ack.by, "Demo Pharmacist");
  assert.ok(card.events.some((e) => e.type === "guard_accepted"));

  // The allergy is remembered on the patient profile.
  const look = await ph.get("/api/patients/lookup?phone=01711111111");
  assert.deepEqual(look.data.patient.allergies, ["penicillin"]);
  assert.equal(look.data.cards.length, 1);

  // Max daily dose + duplicate ingredient
  const over = await ph.post("/api/cards/guard-check", { lines: [line({ name: "Paracetamol", strength: "1 g", pattern: { morning: 2, afternoon: 2, night: 2 } })], age: 30 });
  assert.ok(over.data.flags.some((f) => f.kind === "maxDaily"));
});

test("DoctorGuard looks at the patient's earlier active cards", async () => {
  const ph = await as("pharmacist");
  const first = await ph.post("/api/cards", newCard({ patientPhone: "01733333333", lines: [line({ name: "Paracetamol", strength: "500 mg" })] }));
  assert.equal(first.status, 201);
  const check = await ph.post("/api/cards/guard-check", { phone: "01733333333", lines: [line({ name: "Paracetamol", strength: "500 mg" })], age: 30 });
  assert.ok(check.data.flags.some((f) => f.kind === "duplicate" && /issued on/.test(f.message)));
});

test("adherence: 'I took it' from the QR page, undo, validation", async () => {
  const ph = await as("pharmacist");
  const r = await ph.post("/api/cards", newCard({ lines: [line({ pattern: { morning: 0, afternoon: 0, night: 1 }, days: 3 })] }));
  const pub = new Client();
  const t = r.data.token;
  assert.equal((await pub.post(`/api/public/cards/${t}/intake`, { slot: "morning" })).status, 400, "nothing due in the morning");
  const ok = await pub.post(`/api/public/cards/${t}/intake`, { slot: "night" });
  assert.equal(ok.status, 200);
  assert.ok(ok.data.adherence.end);
  await pub.post(`/api/public/cards/${t}/intake`, { slot: "night" }); // idempotent
  const del = await pub.del(`/api/public/cards/${t}/intake`, { slot: "night" });
  assert.equal(del.status, 200);
  assert.equal((await pub.post(`/api/public/cards/${t}/intake`, { slot: "night", date: "2999-01-01" })).status, 400);
});

test("caregiver dashboard shows missed-dose alerts", async () => {
  const cg = await as("caregiver");
  const d = (await cg.get("/api/dashboard")).data;
  assert.ok(Array.isArray(d.alerts));
  assert.ok(d.cards.some((c) => c.id === "seed-1"));
});

test("reaction report -> care team -> escalation -> doctor closes; admin view is masked", async () => {
  const ph = await as("pharmacist");
  const r = await ph.post("/api/cards", newCard({ patientName: "Masked Person", patientPhone: "01744444444" }));
  const rep = await new Client().post(`/api/public/cards/${r.data.token}/incidents`, {
    feeling: "emergency", description: "Face is swelling after the tablet", contactOk: true, contactPhone: "01744444444",
  });
  assert.equal(rep.status, 201);
  assert.equal(rep.data.urgent, true);
  assert.match(rep.data.message, /hospital/i);
  assert.equal((await new Client().post(`/api/public/cards/${r.data.token}/incidents`, { feeling: "mild", description: "x" })).status, 400);

  // A patient-submitted serious report must NOT be able to pause the whole system.
  assert.equal((await new Client().get("/api/health")).data.safetyGatePaused, false);

  const list = (await ph.get("/api/incidents")).data.incidents;
  const inc = list.find((i) => i.description.includes("Face is swelling"));
  assert.equal(inc.severity, "serious");
  assert.equal(inc.patientName, "Masked Person");
  assert.equal(list[0].id, inc.id, "serious reports are listed first");

  const admin = await as("admin");
  const adminView = (await admin.get("/api/admin/incidents")).data.incidents.find((i) => i.id === inc.id);
  assert.equal(adminView.contactPhone, undefined);
  assert.equal(adminView.patientName, undefined);
  assert.equal((await admin.patch(`/api/incidents/${inc.id}`, { action: "escalate" })).status, 400);

  const doctor = await as("doctor");
  assert.ok(!(await doctor.get("/api/incidents")).data.incidents.some((i) => i.id === inc.id), "doctor sees it only after escalation");
  assert.equal((await ph.patch(`/api/incidents/${inc.id}`, { action: "acknowledge" })).status, 200);
  assert.equal((await ph.patch(`/api/incidents/${inc.id}`, { action: "escalate", note: "Needs a doctor now" })).status, 200);
  assert.ok((await doctor.get("/api/incidents")).data.incidents.some((i) => i.id === inc.id));
  assert.equal((await doctor.get(`/api/cards/${r.data.id}`)).status, 200, "escalation lets the doctor open the card");
  assert.equal((await doctor.patch(`/api/incidents/${inc.id}`, { action: "close" })).status, 400, "outcome required");
  const closed = await doctor.patch(`/api/incidents/${inc.id}`, { action: "close", note: "Patient seen at hospital, drug stopped." });
  assert.equal(closed.data.incident.status, "closed");
});

test("safety gate: wrong entry pauses new cards until an admin reviews", async () => {
  const ph = await as("pharmacist");
  const admin = await as("admin");
  const inc = await ph.post("/api/incidents", { type: "wrong_entry", severity: "serious", description: "Wrong dose typed on a card" });
  assert.equal(inc.status, 201);
  assert.equal((await ph.get("/api/health")).data.safetyGatePaused, true);
  const blocked = await ph.post("/api/cards", newCard());
  assert.equal(blocked.status, 423);
  assert.equal((await admin.post("/api/admin/safety-gate/clear", { note: "short" })).status, 400);
  assert.equal((await admin.post("/api/admin/safety-gate/clear", { note: "Reviewed the entry, retrained the counter staff." })).status, 200);
  assert.equal((await ph.post("/api/cards", newCard())).status, 201);

  // Withdrawing a card for a wrong entry does the same and opens an incident.
  const r = await ph.post("/api/cards", newCard());
  assert.equal((await ph.patch(`/api/cards/${r.data.id}`, { action: "void", reason: "wrong_entry", note: "x" })).status, 400);
  const v = await ph.patch(`/api/cards/${r.data.id}`, { action: "void", reason: "wrong_entry", note: "Typed the wrong strength" });
  assert.equal(v.data.card.status, "voided");
  assert.equal((await ph.get("/api/health")).data.safetyGatePaused, true);
  assert.equal((await new Client().get(`/api/public/cards/${r.data.token}`)).data.card.status, "voided");
  await admin.post("/api/admin/safety-gate/clear", { note: "Reviewed and cleared after the retraining." });
});

test("library: propose -> a different doctor approves -> goes live", async () => {
  const admin = await as("admin");
  const doctor = await as("doctor");
  const active = (await new Client().get("/api/library/active")).data;
  assert.equal(active.meta.phrases.reviewed, false);

  assert.equal((await admin.post("/api/library/rules/propose", { content: [{ id: "x1", type: "bogus" }], note: "bad rule" })).status, 400);
  assert.equal((await admin.post("/api/library/phrases/propose", { content: { "time.morning": "ভোরে" }, note: "x" })).status, 400, "needs an explanation");
  const p = await admin.post("/api/library/phrases/propose", { content: { "time.morning": "ভোরে" }, note: "Local wording for morning" });
  assert.equal(p.status, 201);
  assert.equal((await admin.post("/api/library/phrases/propose", { content: {}, note: "second one" })).status, 409, "one pending proposal per section");

  assert.equal((await new Client().get("/api/library/active")).data.phrases["time.morning"], "সকালে", "not live before review");
  assert.equal((await admin.post(`/api/library/proposals/${p.data.proposal.id}/review`, { decision: "approve" })).status, 403, "admins cannot approve");
  assert.equal((await doctor.post(`/api/library/proposals/${p.data.proposal.id}/review`, { decision: "reject" })).status, 400, "reject needs a reason");
  assert.equal((await doctor.post(`/api/library/proposals/${p.data.proposal.id}/review`, { decision: "approve" })).status, 200);

  const after = (await new Client().get("/api/library/active")).data;
  assert.equal(after.phrases["time.morning"], "ভোরে");
  assert.equal(after.meta.phrases.reviewed, true);
  assert.equal(after.meta.phrases.reviewedBy, "Demo Doctor");

  // A doctor cannot approve their own proposal.
  const own = await doctor.post("/api/library/infoPanel/propose", { content: { titleBn: "শিরোনাম", itemsBn: ["একটি লাইন"] }, note: "Shorter panel" });
  assert.equal(own.status, 201);
  assert.equal((await doctor.post(`/api/library/proposals/${own.data.proposal.id}/review`, { decision: "approve" })).status, 403);
  assert.equal((await doctor.post(`/api/library/proposals/${own.data.proposal.id}/withdraw`)).status, 200);
});

test("e-prescription: doctor sends, pharmacist imports, still fully verified", async () => {
  const doctor = await as("doctor");
  const ph = await as("pharmacist");
  const sent = await doctor.post("/api/eprescriptions", {
    toOrg: "demo", patientName: "ERx Patient", patientAge: 35, patientPhone: "01755555555", lines: [line()],
  });
  assert.equal(sent.status, 201);
  assert.equal((await doctor.post("/api/eprescriptions", { toOrg: "nowhere", patientName: "x", lines: [line()] })).status, 400);
  const inbox = (await ph.get("/api/eprescriptions")).data.eprescriptions;
  assert.ok(inbox.some((e) => e.id === sent.data.eprescription.id));
  assert.equal((await ph.post("/api/eprescriptions", {})).status, 403);

  const card = await ph.post("/api/cards", newCard({ patientName: "ERx Patient", eprescriptionId: sent.data.eprescription.id, source: "eprescription" }));
  assert.equal(card.status, 201);
  assert.equal((await ph.post("/api/cards", newCard({ eprescriptionId: sent.data.eprescription.id }))).status, 400, "already imported");
  assert.equal((await ph.get("/api/eprescriptions")).data.eprescriptions.find((e) => e.id === sent.data.eprescription.id).status, "imported");
});

test("offline sync keeps the device's id, token and time, and is retry-safe", async () => {
  const ph = await as("pharmacist");
  const when = new Date(Date.now() - 3600_000).toISOString();
  const body = newCard({ clientId: "local-abc123", clientToken: "AbCdEfGhIjKl", createdAtClient: when, offline: true });
  const a = await ph.post("/api/cards", body);
  assert.equal(a.status, 201);
  assert.equal(a.data.token, "AbCdEfGhIjKl");
  const card = (await ph.get(`/api/cards/${a.data.id}`)).data.card;
  assert.equal(card.createdAt, when);
  assert.equal(card.offline, true);
  assert.ok(card.syncedAt);
  const again = await ph.post("/api/cards", body);
  assert.equal(again.data.duplicate, true);
  assert.equal(again.data.id, a.data.id);
  assert.equal((await new Client().get("/api/public/cards/AbCdEfGhIjKl")).status, 200);

  // Offline cards cannot be DoctorGuard-checked on the device; flags are kept for review after sync.
  const flagged = await ph.post("/api/cards", newCard({
    clientId: "local-flagged", offline: true, createdAtClient: when, patientPhone: "01766666666", patientAllergies: ["penicillin"],
    lines: [line({ name: "Amoxicillin" })],
  }));
  assert.equal(flagged.status, 201);
  const fc = (await ph.get(`/api/cards/${flagged.data.id}`)).data.card;
  assert.equal(fc.guardReview, "pending");
  assert.equal((await ph.get("/api/dashboard")).data.guardReview.some((g) => g.cardId === flagged.data.id), true);
  const key = fc.guard.flags[0].key;
  assert.equal((await ph.patch(`/api/cards/${fc.id}`, { action: "guard_ack", key })).status, 400, "needs a decision");
  assert.equal((await ph.patch(`/api/cards/${fc.id}`, { action: "guard_ack", key, decision: "accepted", note: "ok" })).status, 400, "high severity needs a real reason");
  const referredLater = await ph.patch(`/api/cards/${fc.id}`, { action: "guard_ack", key, decision: "referred", note: "Please review this printed card" });
  assert.equal(referredLater.data.card.guardReview, "referred");
  const doctor = await as("doctor");
  assert.ok((await doctor.get("/api/dashboard")).data.guardReferred.some((g) => g.cardId === fc.id));
  assert.equal((await doctor.patch(`/api/cards/${fc.id}`, { action: "guard_ack", key, note: "no" })).status, 400, "doctor needs a real note");
  const resolved = await doctor.patch(`/api/cards/${fc.id}`, { action: "guard_ack", key, note: "Patient contacted; switched to a different antibiotic." });
  assert.equal(resolved.data.card.guardReview, null);
});

test("dialect voices: record, approve, fall back", async () => {
  const admin = await as("admin");
  const ph = await as("pharmacist");
  const audio = Buffer.from("fake-audio-bytes").toString("base64");
  assert.equal((await admin.post("/api/voices", { dialect: "ctg", key: "not.a.key", mime: "audio/webm", data: audio })).status, 400);
  assert.equal((await admin.post("/api/voices", { dialect: "xx", key: "time.morning", mime: "audio/webm", data: audio })).status, 400);
  assert.equal((await admin.post("/api/voices", { dialect: "ctg", key: "time.morning", mime: "video/mp4", data: audio })).status, 400);

  const own = await admin.post("/api/voices", { dialect: "ctg", key: "time.morning", mime: "audio/webm;codecs=opus", data: audio });
  assert.equal(own.status, 201);
  assert.equal(own.data.clip.status, "approved", "admin recordings are approved at once");
  const manifest = (await new Client().get("/api/voices/manifest")).data;
  assert.equal(manifest.clips.ctg["time.morning"], own.data.clip.id);
  const bytes = await new Client().get(`/api/voices/${own.data.clip.id}/audio`);
  assert.equal(bytes.headers.get("content-type"), "audio/webm");
  assert.equal(bytes.data.toString(), "fake-audio-bytes");

  const pending = await ph.post("/api/voices", { dialect: "syl", key: "time.night", mime: "audio/webm", data: audio });
  assert.equal(pending.data.clip.status, "pending");
  assert.equal((await new Client().get("/api/voices/manifest")).data.clips.syl, undefined, "pending clips are not played");
  assert.equal((await ph.post(`/api/voices/${pending.data.clip.id}/review`, { decision: "approve" })).status, 403);
  await admin.post(`/api/voices/${pending.data.clip.id}/review`, { decision: "approve" });
  assert.ok((await new Client().get("/api/voices/manifest")).data.clips.syl["time.night"]);
});

test("de-identified exports: consent only, no identities, small groups hidden", async () => {
  const admin = await as("admin");
  const ph = await as("pharmacist");
  assert.equal((await ph.get("/api/admin/export/cards.csv")).status, 403);
  await ph.post("/api/cards", newCard({ patientName: "Secret Name", patientPhone: "01788888888", consent: { family: false, dataUse: true } }));
  await ph.post("/api/cards", newCard({ patientName: "No Consent Person", consent: { family: false, dataUse: false } }));
  const cards = await admin.get("/api/admin/export/cards.csv");
  assert.equal(cards.status, 200);
  assert.match(cards.headers.get("content-disposition"), /attachment/);
  const csv = cards.data;
  assert.ok(csv.startsWith("week_start,org_type,age_band"));
  for (const bad of ["Secret Name", "No Consent", "Rahima", "01788888888", "@"]) assert.ok(!csv.includes(bad), `export must not contain ${bad}`);
  const rows = csv.trim().split("\n").length - 1;
  const expected = (await admin.get("/api/admin/cards")).data.cards.length;
  assert.ok(rows >= 1 && rows < expected, "only consented cards are exported");
  const weekly = (await admin.get("/api/admin/export/weekly.csv")).data;
  assert.match(weekly, /<5/);

  const list = (await admin.get("/api/admin/cards")).data.cards;
  assert.ok(list.every((c) => c.patientName === undefined && c.patientPhone === undefined && c.ref.length === 6));
  const audit = (await admin.get("/api/admin/audit")).data.audit;
  assert.ok(audit.some((a) => a.action === "export_downloaded"));
});

test("admin overview, staff accounts and remote sign-out", async () => {
  const admin = await as("admin");
  const ov = (await admin.get("/api/admin/overview")).data;
  assert.ok(ov.stats.issued >= 2);
  assert.ok(ov.perOrg.length >= 2);
  assert.equal(ov.library.phrases.version >= 1, true);

  // A real (non-demo) account exists only in the database. Forge its cookie to test revocation.
  const users = await col("users");
  const u = { id: "u-real-1", email: "real@example.com", name: "Real Pharmacist", role: "pharmacist", org: "unassigned", active: true, sessionVersion: 0, demo: false, createdAt: new Date().toISOString() };
  await users.insertOne(u);
  const token = () => signJwt({ sub: u.id, name: u.name, email: u.email, role: u.role, org: u.org, demo: false, sv: 0 }, config.sessionSecret, 600);
  const real = new Client();
  real.bearer = token();
  assert.equal((await real.get("/api/auth/me")).data.user.email, "real@example.com");
  const denied = await real.post("/api/cards", newCard());
  assert.equal(denied.status, 403, "unassigned staff cannot create cards");
  assert.match(denied.data.error, /assigned/);

  assert.equal((await admin.patch(`/api/admin/users/${u.id}`, { org: "demo" })).status, 200);
  assert.equal((await real.get("/api/auth/me")).data.user.org, "demo", "org change applies to the live session at once");
  assert.equal((await real.post("/api/cards", newCard())).status, 201, "now assigned and approved");

  assert.equal((await admin.post(`/api/admin/users/${u.id}/signout`)).status, 200);
  assert.equal((await real.get("/api/auth/me")).data.user, null, "remote sign-out ends the old session");
  const fresh = new Client();
  fresh.bearer = signJwt({ sub: u.id, name: u.name, email: u.email, role: "pharmacist", org: "demo", demo: false, sv: 1 }, config.sessionSecret, 600);
  assert.equal((await fresh.get("/api/auth/me")).data.user.id, u.id, "signing in again works");
  assert.equal((await admin.patch(`/api/admin/users/${u.id}`, { role: "doctor" })).status, 200);
  assert.equal((await fresh.get("/api/auth/me")).data.user, null, "a role change also ends sessions");

  assert.equal((await admin.patch(`/api/admin/users/${u.id}`, { role: "emperor" })).status, 400);
  assert.equal((await admin.patch(`/api/admin/users/${u.id}`, { active: false })).status, 200);
  const locked = new Client();
  locked.bearer = signJwt({ sub: u.id, name: u.name, email: u.email, role: "doctor", org: "demo", demo: false, sv: 2 }, config.sessionSecret, 600);
  assert.equal((await locked.get("/api/auth/me")).data.user, null, "deactivated accounts cannot act");
  assert.equal((await as("pharmacist").then((c) => c.get("/api/admin/users"))).status, 403);

  const org = await admin.post("/api/admin/orgs", { name: "Test Pharmacy", type: "pharmacy" });
  assert.equal(org.status, 201);
  assert.ok((await new Client().get("/api/orgs")).data.orgs.some((o) => o.name === "Test Pharmacy"));
});

test("follow-ups and patient lookup for staff", async () => {
  const ph = await as("pharmacist");
  const r = await ph.post("/api/cards", newCard({ patientPhone: "01799999999", lines: [line({ days: 1, pattern: { morning: 1, afternoon: 1, night: 1 } })] }));
  const d = (await ph.get("/api/dashboard")).data;
  const fu = d.followUps.find((f) => f.cardId === r.data.id);
  assert.ok(fu, "a 1-day course is due for a follow-up straight away");
  assert.equal((await ph.patch(`/api/cards/${r.data.id}`, { action: "followup_done", note: "Called, course finished" })).status, 200);
  assert.ok(!(await ph.get("/api/dashboard")).data.followUps.some((f) => f.cardId === r.data.id));
  assert.equal(d.stats.issued >= 1, true);

  const look = (await ph.get("/api/patients/lookup?phone=01700000001")).data;
  assert.equal(look.patient.id, "seed-p1");
  assert.deepEqual(look.patient.allergies, ["penicillin"]);
  assert.equal(look.cards.length, 1);
  assert.equal((await ph.get("/api/patients/lookup?phone=abc")).data.patient, null);
});

test("device readiness reports feed the admin overview", async () => {
  const ph = await as("pharmacist");
  assert.equal((await ph.post("/api/devices/readiness", { deviceId: "dev-1", score: 88, checks: { serviceWorker: true, indexedDb: false } })).status, 200);
  assert.equal((await ph.post("/api/devices/readiness", { deviceId: "", score: 5 })).status, 400);
  const ov = (await (await as("admin")).get("/api/admin/overview")).data;
  assert.equal(ov.readiness.devices >= 1, true);
  assert.equal(ov.readiness.belowTarget >= 1, true);
});

test("request hygiene: bad JSON, big bodies, wrong method", async () => {
  const anon = new Client();
  const res = await fetch(`${base}/api/auth/demo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{oops" });
  assert.equal(res.status, 400);
  assert.equal((await anon.call("PUT", "/api/health", {})).status, 405);
  const huge = await fetch(`${base}/api/auth/demo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ x: "a".repeat(1_100_000) }) });
  assert.equal(huge.status, 413);
});
