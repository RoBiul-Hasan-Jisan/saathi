import { Router } from "../http/router.js";
import { col } from "../db/collections.js";
import { requireAuth, requireOrg } from "../middleware/auth.js";
import { HttpError, ValidationError } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import { dhakaDate, nowIso } from "../lib/dates.js";
import { STAFF } from "../domain/constants.js";
import { canViewCard } from "../domain/perms.js";
import { viewFor } from "../domain/views.js";
import { runGuard } from "../domain/guard.js";
import { activeSlots, adherence, courseEndsOn } from "../domain/schedule.js";
import { normalizePhone } from "../lib/validate.js";
import { newIncident, triggersSafetyGate } from "../domain/incidents.js";
import {
  applyConsent, applyFollowUp, applyGuardAck, applyIssue, applyPrescriberAction, applyShare, applyTeachBack, applyVoid,
  buildNewCard, sanitizeCardInput,
} from "../domain/cards.js";
import { allCards, getCard, getLibrary, getSettings, intakesFor, saveCard, saveSettings, visibleCards } from "../services/repo.js";
import { audit } from "../services/audit.js";

export const cards = Router();

// Cards of this patient (same pharmacy) whose course is still running.
export async function activeCardsOf(patientId, org, excludeId) {
  if (!patientId) return [];
  const today = dhakaDate();
  return (await allCards()).filter((c) => {
    if (c.patientId !== patientId || c.org !== org || c.id === excludeId || c.status !== "issued") return false;
    const end = courseEndsOn(c);
    return !end || end >= today;
  });
}

async function findOrCreatePatient(input, user, now) {
  if (!input.patientPhone) return null;
  const patients = await col("patients");
  let p = await patients.findOne({ org: user.org, phone: input.patientPhone });
  if (!p) {
    p = { id: newId(), org: user.org, name: input.patientName, phone: input.patientPhone, ageYears: input.patientAge, allergies: input.allergies, createdAt: now, updatedAt: now };
    await patients.insertOne(p);
    return p;
  }
  const merged = [...p.allergies];
  for (const a of input.allergies) if (!merged.some((x) => x.toLowerCase() === a.toLowerCase())) merged.push(a);
  p = { ...p, name: input.patientName, ageYears: input.patientAge ?? p.ageYears, allergies: merged, updatedAt: now };
  await patients.replaceOne({ id: p.id }, p);
  return p;
}

const ackMap = (acks) => Object.fromEntries((Array.isArray(acks) ? acks : []).filter((a) => a?.key).map((a) => [a.key, a]));

// Create a card (online, or synced from an offline device).
cards.post("/", requireAuth(...STAFF), async (req, res) => {
  requireOrg(req.user);
  const settings = await getSettings();
  if (settings.safetyGate?.paused) {
    throw new HttpError(423, "New cards are paused while a safety incident is reviewed. An admin must clear the safety gate.");
  }

  const input = sanitizeCardInput(req.body);
  const cardsCol = await col("cards");

  // Retry-safe: a device that syncs the same offline card twice gets the first one back.
  if (input.clientId) {
    const existing = await cardsCol.findOne({ clientId: input.clientId, org: req.user.org });
    if (existing) return res.json({ id: existing.id, status: existing.status, token: existing.token, duplicate: true });
  }
  if (input.clientToken && (await cardsCol.findOne({ token: input.clientToken }))) input.clientToken = "";

  // The device's clock is trusted only within sane limits.
  let now = nowIso();
  let syncedAt = null;
  if (input.offline && input.createdAtClient) {
    const t = Date.parse(input.createdAtClient);
    const age = Date.now() - t;
    if (Number.isFinite(t) && age >= -5 * 60000 && age <= 30 * 86400000) {
      now = new Date(t).toISOString();
      syncedAt = nowIso();
    } else syncedAt = nowIso();
  }

  const patient = await findOrCreatePatient(input, req.user, now);
  const library = (await getLibrary()).content;
  const { flags, unchecked } = runGuard({
    lines: input.lines,
    patient: { allergies: patient?.allergies || input.allergies, ageYears: input.patientAge ?? patient?.ageYears ?? null },
    activeCards: await activeCardsOf(patient?.id, req.user.org),
    library,
  });

  let prescriberId = null;
  let erx = null;
  if (input.eprescriptionId) {
    erx = await (await col("eprescriptions")).findOne({ id: input.eprescriptionId });
    if (!erx || erx.status !== "sent" || erx.toOrg !== req.user.org) throw new ValidationError("That e-prescription is not available to import.");
    prescriberId = erx.doctorId;
  }

  const meta = (await getLibrary()).meta;
  const card = buildNewCard(input, req.user, {
    now, patient, flags, unchecked, acks: ackMap(req.body.guardAcks), prescriberId, syncedAt,
    libraryReviewed: meta.rules.reviewed && meta.ingredients.reviewed, offline: input.offline,
  });
  await cardsCol.insertOne(card);
  if (patient) await (await col("patients")).updateOne({ id: patient.id }, { lastCardAt: now });
  if (erx) await (await col("eprescriptions")).updateOne({ id: erx.id }, { status: "imported", importedAt: nowIso(), importedCardId: card.id });
  if (input.offline) await audit(req.user, "offline_card_synced", card.id, `created ${now}`);

  res.status(201).json({ id: card.id, status: card.status, token: card.token });
});

// Run DoctorGuard on a draft before issuing.
cards.post("/guard-check", requireAuth(...STAFF, "doctor"), async (req, res) => {
  const lines = (Array.isArray(req.body.lines) ? req.body.lines : []).slice(0, 10).map((l) => ({
    name: String(l?.name || "").slice(0, 80), strength: String(l?.strength || "").slice(0, 30), form: l?.form,
    pattern: l?.pattern || {}, ingredient: String(l?.ingredient || ""), days: Number(l?.days) || 0,
  }));
  let patient = null;
  if (req.body.phone) {
    patient = await (await col("patients")).findOne({ org: req.user.org, phone: normalizePhone(req.body.phone) });
  }
  const typed = (Array.isArray(req.body.allergies) ? req.body.allergies : []).map((a) => String(a).slice(0, 40));
  const allergies = [...new Set([...(patient?.allergies || []), ...typed])];
  const age = req.body.age === "" || req.body.age == null ? patient?.ageYears ?? null : Number(req.body.age);
  const lib = await getLibrary();
  const { flags, unchecked } = runGuard({
    lines, patient: { allergies, ageYears: Number.isFinite(age) ? age : null },
    activeCards: await activeCardsOf(patient?.id, req.user.org), library: lib.content,
  });
  res.json({ flags, unchecked, allergies, reviewed: lib.meta.rules.reviewed && lib.meta.ingredients.reviewed });
});

cards.get("/", requireAuth(), async (req, res) => {
  const list = await visibleCards(req.user);
  res.json({ cards: list.map((c) => viewFor(req.user, c)) });
});

async function loadVisible(req) {
  const card = await getCard(req.params.id);
  if (!card || !canViewCard(req.user, card)) throw new HttpError(404, "Not found.");
  return card;
}

cards.get("/:id", requireAuth(), async (req, res) => {
  res.json({ card: viewFor(req.user, await loadVisible(req)) });
});

// Everything that changes a card goes through one named action, each with its own permission.
cards.patch("/:id", requireAuth(), async (req, res) => {
  const card = await loadVisible(req);
  const user = req.user;
  const body = req.body || {};
  const staff = STAFF.includes(user.role);
  const need = (ok, msg) => {
    if (!ok) throw new HttpError(403, msg);
  };

  switch (body.action) {
    case "prescriber_confirm":
      need(user.role === "doctor", "Only a prescriber can confirm this.");
      applyPrescriberAction(card, body, user);
      break;
    case "issue": {
      need(staff, "Only a named verifier can issue a card.");
      const settings = await getSettings();
      if (settings.safetyGate?.paused) throw new HttpError(423, "New cards are paused while a safety incident is reviewed.");
      applyIssue(card, body, user);
      break;
    }
    case "teachback":
      need(staff, "Only pharmacy or health staff can record teach-back.");
      applyTeachBack(card, body, user);
      break;
    case "consent":
      need(staff, "Only staff record consent.");
      applyConsent(card, body, user);
      break;
    case "share":
      need(staff, "Only staff share cards.");
      applyShare(card, body, user);
      break;
    case "followup_done":
      need(staff, "Only staff record follow-ups.");
      applyFollowUp(card, body, user);
      break;
    case "guard_ack":
      need(staff || user.role === "doctor", "Not allowed.");
      applyGuardAck(card, body, user);
      break;
    case "void": {
      need(staff || user.role === "doctor", "Only staff or a doctor can withdraw a card.");
      applyVoid(card, body, user);
      if (card.voided.reason === "wrong_entry") {
        const now = nowIso();
        const inc = newIncident({
          type: "wrong_entry", card, severity: "serious", reporter: user, now,
          description: `Card withdrawn because of a wrong entry: ${card.voided.note}`,
        });
        await (await col("incidents")).insertOne(inc);
        const settings = await getSettings();
        settings.safetyGate = { paused: true, reason: "A card was withdrawn because of a wrong entry.", incidentId: inc.id, at: now };
        await saveSettings(settings);
        await audit(user, "safety_gate_paused", inc.id, settings.safetyGate.reason);
      }
      break;
    }
    default:
      throw new ValidationError("Unknown action.");
  }
  await saveCard(card);
  res.json({ card: viewFor(user, card) });
});

/* --------- adherence ("I took it") for logged-in users --------- */

cards.get("/:id/adherence", requireAuth(), async (req, res) => {
  const card = await loadVisible(req);
  res.json({ adherence: adherence(card, await intakesFor(card.id)) });
});

cards.post("/:id/intake", requireAuth("patient", "caregiver", ...STAFF), async (req, res) => {
  const card = await loadVisible(req);
  res.json(await recordIntake(card, req.body, req.user.role));
});

cards.delete("/:id/intake", requireAuth("patient", "caregiver", ...STAFF), async (req, res) => {
  const card = await loadVisible(req);
  res.json(await removeIntake(card, req.body));
});

export async function recordIntake(card, body, source) {
  if (card.status !== "issued") throw new ValidationError("This card is not active.");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? body.date : dhakaDate();
  if (date > dhakaDate()) throw new ValidationError("You cannot mark a future day.");
  if (!activeSlots(card, date).includes(body.slot)) throw new ValidationError("No medicine is due in that slot.");
  const intakes = await col("intakes");
  if (!(await intakes.findOne({ cardId: card.id, date, slot: body.slot }))) {
    await intakes.insertOne({ id: newId(), cardId: card.id, date, slot: body.slot, takenAt: nowIso(), source });
  }
  return { adherence: adherence(card, await intakesFor(card.id)) };
}

export async function removeIntake(card, body) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || "")) ? body.date : dhakaDate();
  const intakes = await col("intakes");
  const row = await intakes.findOne({ cardId: card.id, date, slot: body.slot });
  if (row) await intakes.deleteOne({ id: row.id });
  return { adherence: adherence(card, await intakesFor(card.id)) };
}
