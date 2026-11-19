import { Router } from "../http/router.js";
import { col } from "../db/collections.js";
import { rateLimit } from "../http/middleware.js";
import { HttpError } from "../lib/errors.js";
import { nowIso } from "../lib/dates.js";
import { publicCardView } from "../domain/views.js";
import { adherence } from "../domain/schedule.js";
import { REPORTED, newIncident } from "../domain/incidents.js";
import { getCardByToken, getLibrary, intakesFor } from "../services/repo.js";
import { recordIntake, removeIntake } from "./cards.js";

// What the QR code on the printed card opens. The 12-character token is the key, so these routes
// need no login and only ever expose what the family needs (no phone, no emails, no audit trail).
export const publicRoutes = Router();
publicRoutes.use(rateLimit({ name: "public", max: 120 }));

async function load(req) {
  const card = await getCardByToken(req.params.token);
  if (!card || !["issued", "voided"].includes(card.status)) throw new HttpError(404, "Card not found.");
  return card;
}

publicRoutes.get("/cards/:token", async (req, res) => {
  const card = await load(req);
  const lib = await getLibrary();
  const out = { card: publicCardView(card), reviewed: lib.meta.phrases.reviewed && lib.meta.infoPanel.reviewed };
  if (card.status === "issued") out.adherence = adherence(card, await intakesFor(card.id));
  res.json(out);
});

publicRoutes.post("/cards/:token/intake", async (req, res) => {
  res.json(await recordIntake(await load(req), req.body || {}, "patient"));
});

publicRoutes.delete("/cards/:token/intake", async (req, res) => {
  res.json(await removeIntake(await load(req), req.body || {}));
});

// "Report a problem": goes to the care team of the pharmacy that issued the card. No automated advice.
publicRoutes.post("/cards/:token/incidents", rateLimit({ name: "report", max: 10 }), async (req, res) => {
  const card = await load(req);
  const b = req.body || {};
  const severity = REPORTED[b.feeling] || "mild";
  const inc = newIncident({
    type: "reaction", card, severity, description: b.description, contactPhone: b.contactPhone, contactOk: b.contactOk,
    reporter: { role: "patient" }, now: nowIso(),
  });
  await (await col("incidents")).insertOne(inc);
  res.status(201).json({
    ok: true,
    urgent: severity === "serious",
    message: severity === "serious"
      ? "Go to the nearest hospital or call for emergency help now. Your report has also been sent to the pharmacy."
      : "Your report was sent to the pharmacy. If you feel worse, go to a doctor or hospital.",
  });
});
