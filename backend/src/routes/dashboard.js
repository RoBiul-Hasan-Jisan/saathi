import { Router } from "../http/router.js";
import { col } from "../db/collections.js";
import { requireAuth } from "../middleware/auth.js";
import { dhakaDate } from "../lib/dates.js";
import { STAFF } from "../domain/constants.js";
import { computeStats } from "../domain/stats.js";
import { viewFor } from "../domain/views.js";
import { adherence, courseEndsOn, followUpInfo } from "../domain/schedule.js";
import { canSeeIncident } from "../domain/perms.js";
import { ensureSeed } from "../db/seed.js";
import { getLibrary, getSettings, intakesFor, visibleCards } from "../services/repo.js";

// One call that returns everything a role's home screen needs.
export const dashboard = Router();

dashboard.get("/", requireAuth(), async (req, res) => {
  await ensureSeed();
  const user = req.user;
  const cards = await visibleCards(user);
  const out = { role: user.role, cards: cards.map((c) => viewFor(user, c)) };

  if (STAFF.includes(user.role)) {
    const lib = await getLibrary();
    const antibiotic = new Set(lib.content.ingredients.filter((i) => i.antibiotic).map((i) => i.key));
    const today = dhakaDate();
    out.stats = computeStats(cards);
    out.followUps = cards
      .filter((c) => c.status === "issued" && !c.followUp)
      .map((c) => ({ c, info: followUpInfo(c, today) }))
      .filter((x) => x.info?.due)
      .map(({ c, info }) => ({
        cardId: c.id, patientName: c.patientName, phone: c.patientPhone, endsOn: info.endsOn, daysLeft: info.daysLeft,
        antibiotic: c.lines.some((l) => antibiotic.has(l.ingredient)),
      }));
    out.guardReview = cards.filter((c) => c.guardReview === "pending").map((c) => ({ cardId: c.id, patientName: c.patientName }));
    const erx = await (await col("eprescriptions")).find({ toOrg: user.org, status: "sent" });
    out.eprescriptionsWaiting = erx.length;
    const incidents = await (await col("incidents")).find({});
    out.openIncidents = incidents.filter((i) => canSeeIncident(user, i) && i.status !== "closed").length;
    out.safetyGate = (await getSettings()).safetyGate;
  }

  if (user.role === "doctor") {
    out.queue = cards.filter((c) => c.lines.some((l) => l.status === "unclear")).map((c) => viewFor(user, c));
    out.guardReferred = cards.filter((c) => c.guardReview === "referred").map((c) => ({ cardId: c.id, patientName: c.patientName }));
    out.libraryPending = (await (await col("library")).find({ status: "pending_review" })).filter((d) => d.proposedBy?.id !== user.id).length;
    const incidents = await (await col("incidents")).find({});
    out.openIncidents = incidents.filter((i) => canSeeIncident(user, i) && i.status !== "closed").length;
  }

  if (user.role === "patient" || user.role === "caregiver") {
    // Missed-dose alerts for issued cards in the last day of their course.
    const alerts = [];
    for (const card of cards.filter((c) => c.status === "issued")) {
      const end = courseEndsOn(card);
      if (!end || end < dhakaDate(new Date(Date.now() - 86400000))) continue;
      const a = adherence(card, await intakesFor(card.id));
      if (a.missed.length) alerts.push({ cardId: card.id, patientName: card.patientName, missed: a.missed.slice(-4), percent: a.percent });
    }
    out.alerts = alerts;
  }
  res.json(out);
});
