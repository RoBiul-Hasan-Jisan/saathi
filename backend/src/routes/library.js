import { Router } from "../http/router.js";
import { col } from "../db/collections.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import { nowIso } from "../lib/dates.js";
import { clean } from "../lib/validate.js";
import { KINDS } from "../domain/defaultLibrary.js";
import { validateContent } from "../domain/library.js";
import { getLibrary } from "../services/repo.js";
import { audit } from "../services/audit.js";
import { ensureSeed } from "../db/seed.js";

// The approved Bangla template library. Rule: nobody edits it directly. An admin or doctor PROPOSES a
// new version; a DIFFERENT doctor (the clinical panel) approves it before it goes live.
export const library = Router();

const kindOf = (req) => {
  if (!KINDS.includes(req.params.kind)) throw new HttpError(404, "Unknown library section.");
  return req.params.kind;
};

// Active content including DoctorGuard rules (rules are not exposed publicly).
library.get("/full/:kind", requireAuth("admin", "doctor"), async (req, res) => {
  const kind = kindOf(req);
  const lib = await getLibrary();
  res.json({ kind, content: lib.content[kind], meta: lib.meta[kind] });
});

library.get("/proposals", requireAuth("admin", "doctor"), async (req, res) => {
  await ensureSeed();
  const docs = (await (await col("library")).find({}))
    .filter((d) => d.version > 1 || d.status !== "approved")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 60);
  res.json({ proposals: docs });
});

library.post("/:kind/propose", requireAuth("admin", "doctor"), async (req, res) => {
  const kind = kindOf(req);
  const content = validateContent(kind, req.body.content);
  const note = clean(req.body.note, 400);
  if (note.length < 5) throw new HttpError(400, "Write a short note explaining the change.");
  await ensureSeed();
  const lib = await col("library");
  const all = await lib.find({ kind });
  if (all.some((d) => d.status === "pending_review")) {
    throw new HttpError(409, "There is already a proposal waiting for clinical review for this section. Withdraw it first.");
  }
  const doc = {
    id: newId(), kind, version: Math.max(0, ...all.map((d) => d.version)) + 1, status: "pending_review", content,
    proposedBy: { id: req.user.id, name: req.user.name, role: req.user.role }, note,
    reviewedBy: null, reviewedAt: null, reviewNote: null, createdAt: nowIso(),
  };
  await lib.insertOne(doc);
  await audit(req.user, "library_proposed", doc.id, `${kind} v${doc.version}`);
  res.status(201).json({ proposal: doc });
});

library.post("/proposals/:id/review", requireAuth("doctor"), async (req, res) => {
  const lib = await col("library");
  const doc = await lib.findOne({ id: req.params.id });
  if (!doc || doc.status !== "pending_review") throw new HttpError(404, "No proposal waiting for review.");
  if (doc.proposedBy?.id === req.user.id) throw new HttpError(403, "You cannot approve your own proposal. Another clinical-panel doctor must review it.");
  const approve = req.body.decision === "approve";
  if (!approve && req.body.decision !== "reject") throw new HttpError(400, "Decision must be approve or reject.");
  const reviewNote = clean(req.body.note, 400);
  if (!approve && reviewNote.length < 5) throw new HttpError(400, "Say why you are rejecting it.");
  const patch = {
    status: approve ? "approved" : "rejected", reviewedBy: { id: req.user.id, name: req.user.name }, reviewedAt: nowIso(), reviewNote,
  };
  await lib.updateOne({ id: doc.id }, patch);
  await audit(req.user, approve ? "library_approved" : "library_rejected", doc.id, `${doc.kind} v${doc.version}`);
  res.json({ proposal: { ...doc, ...patch } });
});

library.post("/proposals/:id/withdraw", requireAuth("admin", "doctor"), async (req, res) => {
  const lib = await col("library");
  const doc = await lib.findOne({ id: req.params.id });
  if (!doc || doc.status !== "pending_review") throw new HttpError(404, "No proposal to withdraw.");
  if (doc.proposedBy?.id !== req.user.id) throw new HttpError(403, "Only the person who proposed it can withdraw it.");
  await lib.updateOne({ id: doc.id }, { status: "withdrawn" });
  await audit(req.user, "library_withdrawn", doc.id, `${doc.kind} v${doc.version}`);
  res.json({ ok: true });
});
