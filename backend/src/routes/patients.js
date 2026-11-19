import { Router } from "../http/router.js";
import { col } from "../db/collections.js";
import { requireAuth, requireOrg } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { nowIso } from "../lib/dates.js";
import { normalizePhone, parseList } from "../lib/validate.js";
import { STAFF } from "../domain/constants.js";
import { staffCardView } from "../domain/views.js";
import { allCards } from "../services/repo.js";
import { audit } from "../services/audit.js";

export const patients = Router();

// Staff look a patient up by phone to see earlier cards and the DoctorGuard profile (allergies).
patients.get("/lookup", requireAuth(...STAFF), async (req, res) => {
  requireOrg(req.user);
  let phone;
  try {
    phone = normalizePhone(req.query.phone);
  } catch {
    return res.json({ patient: null, cards: [] });
  }
  if (!phone) return res.json({ patient: null, cards: [] });
  const patient = await (await col("patients")).findOne({ org: req.user.org, phone });
  if (!patient) return res.json({ patient: null, cards: [] });
  const cards = (await allCards()).filter((c) => c.patientId === patient.id && c.org === req.user.org);
  res.json({ patient, cards: cards.map(staffCardView) });
});

patients.patch("/:id", requireAuth(...STAFF, "doctor"), async (req, res) => {
  const col_ = await col("patients");
  const p = await col_.findOne({ id: req.params.id });
  if (!p || (req.user.role !== "doctor" && p.org !== req.user.org)) throw new HttpError(404, "Not found.");
  const allergies = parseList(req.body.allergies, 10, 40);
  await col_.updateOne({ id: p.id }, { allergies, updatedAt: nowIso() });
  await audit(req.user, "patient_allergies_updated", p.id, `${allergies.length} entries`);
  res.json({ patient: { ...p, allergies } });
});
