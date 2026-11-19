import { Router } from "../http/router.js";
import { config } from "../config.js";
import { col, storageMode } from "../db/collections.js";
import { ensureSeed } from "../db/seed.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import { clean } from "../lib/validate.js";
import { nowIso } from "../lib/dates.js";
import { getLibrary, getSettings } from "../services/repo.js";
import { DIALECTS } from "../domain/constants.js";

export const misc = Router();

misc.get("/health", async (req, res) => {
  try {
    await ensureSeed();
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, storage: storageMode() });
  }
  const s = await getSettings();
  res.json({
    ok: true,
    storage: storageMode(),
    demoEnabled: config.enableDemo,
    firebaseConfigured: Boolean(config.firebaseProjectId),
    safetyGatePaused: !!s.safetyGate?.paused,
  });
});

// Approved library for the app: phrases, info panel, ingredients. No patient data in here.
misc.get("/library/active", async (req, res) => {
  const { content, meta } = await getLibrary();
  res.json({ phrases: content.phrases, infoPanel: content.infoPanel, ingredients: content.ingredients, meta, dialects: DIALECTS });
});

// Pharmacies and clinics (names only) for sign-up and e-prescriptions.
misc.get("/orgs", async (req, res) => {
  await ensureSeed();
  const orgs = (await (await col("orgs")).find({ active: true })).map(({ id, name, type, district }) => ({ id, name, type, district }));
  res.json({ orgs });
});

// A device reports how ready it is for offline use (target: 95% or more).
misc.post("/devices/readiness", requireAuth(), async (req, res) => {
  const { deviceId, score, checks } = req.body || {};
  const id = clean(deviceId, 60);
  const n = Number(score);
  if (!id || !(n >= 0 && n <= 100)) throw new HttpError(400, "Invalid readiness report.");
  const safeChecks = {};
  for (const [k, v] of Object.entries(checks || {}).slice(0, 20)) safeChecks[clean(k, 40)] = v === true;
  await (await col("readiness")).insertOne({
    id: newId(), deviceId: id, score: Math.round(n), checks: safeChecks, role: req.user.role, org: req.user.org, at: nowIso(),
  });
  res.json({ ok: true });
});
