import { Router } from "../http/router.js";
import { col } from "../db/collections.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import { nowIso } from "../lib/dates.js";
import { clean } from "../lib/validate.js";
import { ROLES } from "../domain/constants.js";
import { adminCardRow } from "../domain/views.js";
import { computeStats, readinessSummary } from "../domain/stats.js";
import { incidentView } from "../domain/incidents.js";
import { cardLevelCsv, weeklySummaryCsv } from "../domain/exports.js";
import { allCards, getLibrary, getSettings, orgsById, saveSettings } from "../services/repo.js";
import { audit } from "../services/audit.js";
import { ensureSeed } from "../db/seed.js";

// Programme-manager tools. Everything here is de-identified: no patient names, phones or emails.
export const admin = Router();
admin.use(requireAuth("admin"));

admin.get("/overview", async (req, res) => {
  await ensureSeed();
  const cards = await allCards();
  const orgs = await orgsById();
  const settings = await getSettings();
  const lib = await getLibrary();
  const incidents = await (await col("incidents")).find({});
  const clips = await (await col("voiceclips")).find({});
  const users = await (await col("users")).find({});
  const perOrg = [...orgs.values()].map((o) => ({ id: o.id, name: o.name, type: o.type, ...computeStats(cards.filter((c) => c.org === o.id)) }));
  res.json({
    stats: computeStats(cards),
    perOrg,
    readiness: readinessSummary(await (await col("readiness")).find({})),
    safetyGate: settings.safetyGate,
    incidents: {
      open: incidents.filter((i) => i.status !== "closed").length,
      seriousOpen: incidents.filter((i) => i.status !== "closed" && i.severity === "serious").length,
    },
    library: lib.meta,
    voices: {
      approved: clips.filter((c) => c.status === "approved").length,
      pending: clips.filter((c) => c.status === "pending").length,
    },
    users: { total: users.length, pendingApproval: users.filter((u) => u.active === false).length },
  });
});

// Verification log without patient identity.
admin.get("/cards", async (req, res) => {
  const orgs = await orgsById();
  const cards = await allCards();
  res.json({ cards: cards.slice(0, 200).map((c) => adminCardRow(c, orgs.get(c.org)?.name)) });
});

admin.get("/audit", async (req, res) => {
  await ensureSeed();
  const limit = Math.min(Number(req.query.limit) || 100, 300);
  const list = await (await col("audit")).find({}, { sort: { at: -1 }, limit });
  res.json({ audit: list });
});

admin.get("/incidents", async (req, res) => {
  const list = await (await col("incidents")).find({});
  res.json({ incidents: list.map((i) => incidentView(i, req.user)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
});

/* ------------------------------ staff accounts ------------------------------ */

admin.get("/users", async (req, res) => {
  const users = await (await col("users")).find({});
  const safe = users.map(({ id, name, email, role, org, active, createdAt }) => ({ id, name, email, role, org, active: active !== false, createdAt }));
  res.json({ users: safe.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
});

admin.patch("/users/:id", async (req, res) => {
  const users = await col("users");
  const u = await users.findOne({ id: req.params.id });
  if (!u) throw new HttpError(404, "User not found.");
  if (u.id === req.user.id) throw new HttpError(400, "You cannot change your own role or access.");
  const patch = {};
  if (req.body.role != null) {
    if (!ROLES.includes(req.body.role)) throw new HttpError(400, "Unknown role.");
    patch.role = req.body.role;
  }
  if (req.body.org != null) {
    const org = req.body.org === "unassigned" ? { id: "unassigned" } : await (await col("orgs")).findOne({ id: String(req.body.org) });
    if (!org) throw new HttpError(400, "Unknown pharmacy or clinic.");
    patch.org = org.id;
  }
  if (req.body.active != null) patch.active = req.body.active === true;
  if (patch.active === false || patch.role) patch.sessionVersion = (u.sessionVersion || 0) + 1; // end their sessions
  await users.updateOne({ id: u.id }, patch);
  await audit(req.user, "user_updated", u.id, JSON.stringify({ ...patch, sessionVersion: undefined }));
  res.json({ ok: true });
});

admin.post("/users/:id/signout", async (req, res) => {
  const users = await col("users");
  const u = await users.findOne({ id: req.params.id });
  if (!u) throw new HttpError(404, "User not found.");
  await users.updateOne({ id: u.id }, { sessionVersion: (u.sessionVersion || 0) + 1 });
  await audit(req.user, "user_signed_out_remotely", u.id);
  res.json({ ok: true });
});

admin.get("/orgs", async (req, res) => {
  res.json({ orgs: [...(await orgsById()).values()] });
});

admin.post("/orgs", async (req, res) => {
  const name = clean(req.body.name, 80);
  if (name.length < 2) throw new HttpError(400, "Enter a name.");
  const type = ["pharmacy", "clinic", "ngo"].includes(req.body.type) ? req.body.type : "pharmacy";
  const org = { id: newId(), name, type, district: clean(req.body.district, 60), active: true, createdAt: nowIso() };
  await (await col("orgs")).insertOne(org);
  await audit(req.user, "org_created", org.id, name);
  res.status(201).json({ org });
});

admin.patch("/orgs/:id", async (req, res) => {
  const orgs = await col("orgs");
  const o = await orgs.findOne({ id: req.params.id });
  if (!o) throw new HttpError(404, "Not found.");
  const patch = {};
  if (req.body.name != null) patch.name = clean(req.body.name, 80);
  if (req.body.district != null) patch.district = clean(req.body.district, 60);
  if (req.body.active != null) patch.active = req.body.active === true;
  await orgs.updateOne({ id: o.id }, patch);
  await audit(req.user, "org_updated", o.id);
  res.json({ ok: true });
});

/* ------------------------------ safety gate ------------------------------ */

admin.post("/safety-gate/pause", async (req, res) => {
  const reason = clean(req.body.reason, 300) || "Paused by an admin.";
  const s = await getSettings();
  s.safetyGate = { paused: true, reason, incidentId: null, at: nowIso() };
  await saveSettings(s);
  await audit(req.user, "safety_gate_paused", null, reason);
  res.json({ safetyGate: s.safetyGate });
});

admin.post("/safety-gate/clear", async (req, res) => {
  const note = clean(req.body.note, 400);
  if (note.length < 10) throw new HttpError(400, "Write what was reviewed and decided (at least 10 characters) before resuming.");
  const s = await getSettings();
  s.safetyGate = { paused: false, clearedBy: req.user.name, clearedAt: nowIso(), clearNote: note, previous: s.safetyGate };
  await saveSettings(s);
  await audit(req.user, "safety_gate_cleared", null, note);
  res.json({ safetyGate: s.safetyGate });
});

/* ------------------------------ de-identified exports ------------------------------ */

async function exportCsv(req, res, name, build) {
  const orgs = await orgsById();
  const typeOf = (id) => orgs.get(id)?.type || "unknown";
  const csv = build(await allCards(), typeOf);
  await audit(req.user, "export_downloaded", null, name);
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.send(csv, "text/csv; charset=utf-8");
}

admin.get("/export/cards.csv", (req, res) => exportCsv(req, res, "saathi-deidentified-cards.csv", cardLevelCsv));
admin.get("/export/weekly.csv", (req, res) => exportCsv(req, res, "saathi-weekly-summary.csv", weeklySummaryCsv));
