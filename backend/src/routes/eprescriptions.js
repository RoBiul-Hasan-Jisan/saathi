import { Router } from "../http/router.js";
import { col } from "../db/collections.js";
import { requireAuth, requireOrg } from "../middleware/auth.js";
import { HttpError, ValidationError } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import { nowIso } from "../lib/dates.js";
import { clean, normalizePhone } from "../lib/validate.js";
import { STAFF } from "../domain/constants.js";
import { requireValidSchedule, sanitizeLine } from "../domain/cards.js";
import { ensureSeed } from "../db/seed.js";
import { audit } from "../services/audit.js";

// A doctor can send a digital prescription to a pharmacy. It only PRE-FILLS the card form.
// The pharmacist still reads every line back and verifies it, so nothing skips human checking.
export const erx = Router();

erx.post("/", requireAuth("doctor"), async (req, res) => {
  await ensureSeed();
  const b = req.body || {};
  const org = await (await col("orgs")).findOne({ id: String(b.toOrg || ""), active: true });
  if (!org) throw new ValidationError("Choose the pharmacy or clinic to send this to.");
  const patientName = clean(b.patientName, 80);
  if (!patientName) throw new ValidationError("Enter the patient name.");
  if (!Array.isArray(b.lines) || b.lines.length < 1 || b.lines.length > 10) throw new ValidationError("Add between 1 and 10 medicines.");
  const lines = b.lines.map((raw, i) => {
    const l = sanitizeLine(raw);
    requireValidSchedule(l, i);
    const { unclear, note, confirmed, ...rest } = l;
    return rest;
  });
  const age = b.patientAge === "" || b.patientAge == null ? null : Number(b.patientAge);
  const doc = {
    id: newId(), toOrg: org.id, doctorId: req.user.id, doctorName: req.user.name, patientName,
    patientAge: Number.isInteger(age) && age >= 0 && age <= 120 ? age : null,
    patientPhone: normalizePhone(clean(b.patientPhone, 20)), note: clean(b.note, 300), lines,
    status: "sent", createdAt: nowIso(), importedAt: null, importedCardId: null,
  };
  await (await col("eprescriptions")).insertOne(doc);
  await audit(req.user, "eprescription_sent", doc.id, `to ${org.id}`);
  res.status(201).json({ eprescription: doc });
});

erx.get("/", requireAuth("doctor", ...STAFF), async (req, res) => {
  await ensureSeed();
  const all = await (await col("eprescriptions")).find({});
  let list;
  if (req.user.role === "doctor") list = all.filter((e) => e.doctorId === req.user.id);
  else {
    requireOrg(req.user);
    list = all.filter((e) => e.toOrg === req.user.org);
  }
  res.json({ eprescriptions: list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 50) });
});

erx.get("/:id", requireAuth("doctor", ...STAFF), async (req, res) => {
  const e = await (await col("eprescriptions")).findOne({ id: req.params.id });
  const ok = e && (req.user.role === "doctor" ? e.doctorId === req.user.id : e.toOrg === req.user.org);
  if (!ok) throw new HttpError(404, "Not found.");
  res.json({ eprescription: e });
});

erx.post("/:id/cancel", requireAuth("doctor"), async (req, res) => {
  const c = await col("eprescriptions");
  const e = await c.findOne({ id: req.params.id });
  if (!e || e.doctorId !== req.user.id || e.status !== "sent") throw new HttpError(404, "Nothing to cancel.");
  await c.updateOne({ id: e.id }, { status: "cancelled" });
  res.json({ ok: true });
});
