import { Router } from "../http/router.js";
import { col } from "../db/collections.js";
import { requireAuth, requireOrg } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { nowIso } from "../lib/dates.js";
import { STAFF } from "../domain/constants.js";
import { canSeeIncident } from "../domain/perms.js";
import { applyIncidentAction, incidentView, newIncident, triggersSafetyGate } from "../domain/incidents.js";
import { getCard, getSettings, saveCard, saveSettings } from "../services/repo.js";
import { audit } from "../services/audit.js";
import { ensureSeed } from "../db/seed.js";

// Reaction reports and safety incidents. The care team (pharmacy/clinic staff, then a doctor) handles them.
// Nothing here generates medical advice.
export const incidents = Router();

const rank = { serious: 0, moderate: 1, mild: 2 };
const open = (i) => (i.status === "closed" ? 1 : 0);

incidents.get("/", requireAuth(...STAFF, "doctor", "admin"), async (req, res) => {
  await ensureSeed();
  const all = await (await col("incidents")).find({});
  const list = all
    .filter((i) => canSeeIncident(req.user, i))
    .sort((a, b) => open(a) - open(b) || rank[a.severity] - rank[b.severity] || (a.createdAt < b.createdAt ? 1 : -1));
  // Patient name for the care team (never for admins).
  const out = [];
  for (const i of list) {
    const v = incidentView(i, req.user);
    if (req.user.role !== "admin" && i.cardId) {
      const card = await getCard(i.cardId);
      v.patientName = card?.patientName || null;
    }
    out.push(v);
  }
  res.json({ incidents: out });
});

// Staff or doctors log an incident themselves (e.g. a wrong entry noticed later).
incidents.post("/", requireAuth(...STAFF, "doctor"), async (req, res) => {
  const b = req.body || {};
  if (req.user.role !== "doctor") requireOrg(req.user);
  let card = null;
  if (b.cardId) {
    card = await getCard(String(b.cardId));
    if (!card || (STAFF.includes(req.user.role) && card.org !== req.user.org)) throw new HttpError(404, "Card not found.");
  }
  const inc = newIncident({
    type: b.type, card, severity: b.severity, description: b.description, reporter: req.user, now: nowIso(),
  });
  await (await col("incidents")).insertOne(inc);
  await audit(req.user, "incident_reported", inc.id, `${inc.type}/${inc.severity}`);

  if (triggersSafetyGate(inc, req.user.role)) {
    const settings = await getSettings();
    if (!settings.safetyGate?.paused) {
      settings.safetyGate = { paused: true, reason: `Safety incident reported (${inc.type}).`, incidentId: inc.id, at: nowIso() };
      await saveSettings(settings);
      await audit(req.user, "safety_gate_paused", inc.id, settings.safetyGate.reason);
    }
  }
  res.status(201).json({ incident: inc });
});

incidents.patch("/:id", requireAuth(...STAFF, "doctor", "admin"), async (req, res) => {
  const c = await col("incidents");
  const inc = await c.findOne({ id: req.params.id });
  if (!inc || !canSeeIncident(req.user, inc)) throw new HttpError(404, "Not found.");
  applyIncidentAction(inc, req.body || {}, req.user);

  if (req.body.action === "escalate" && inc.cardId) {
    const card = await getCard(inc.cardId);
    if (card) {
      card.doctorVisible = true;
      await saveCard(card);
    }
  }
  await c.replaceOne({ id: inc.id }, inc);
  await audit(req.user, `incident_${req.body.action}`, inc.id);
  res.json({ incident: incidentView(inc, req.user) });
});
