import { Router } from "../http/router.js";
import { col } from "../db/collections.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import { nowIso } from "../lib/dates.js";
import { DIALECTS, STAFF } from "../domain/constants.js";
import { ALL_CLIP_KEYS } from "../domain/defaultLibrary.js";
import { audit } from "../services/audit.js";
import { ensureSeed } from "../db/seed.js";

// Dialect voices: native speakers record the fixed phrases and numbers; an admin approves each clip.
// The player uses an approved clip when one exists, and falls back to the device's text-to-speech.
export const voices = Router();

const MIMES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-m4a"];
const MAX_BASE64 = 560_000; // about 400 KB of audio

voices.get("/manifest", async (req, res) => {
  await ensureSeed();
  const approved = await (await col("voiceclips")).find({ status: "approved" });
  const clips = {};
  for (const c of approved) (clips[c.dialect] ||= {})[c.key] = c.id;
  res.json({ dialects: DIALECTS, keys: ALL_CLIP_KEYS, clips });
});

voices.get("/:id/audio", async (req, res) => {
  const clip = await (await col("voiceclips")).findOne({ id: req.params.id });
  const preview = clip && clip.status === "pending" && req.user && (req.user.role === "admin" || clip.recordedBy?.id === req.user.id);
  if (!clip || (clip.status !== "approved" && !preview)) throw new HttpError(404, "Not found.");
  // Approved clips are public and immutable (ids never change). Pending previews are private.
  res.setHeader("Cache-Control", preview ? "private, no-store" : "public, max-age=31536000, immutable");
  res.send(Buffer.from(clip.data, "base64"), clip.mime);
});

voices.get("/", requireAuth("admin", ...STAFF), async (req, res) => {
  await ensureSeed();
  const all = await (await col("voiceclips")).find({});
  const list = all
    .filter((c) => req.user.role === "admin" || c.recordedBy?.id === req.user.id)
    .map(({ data, ...rest }) => rest)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json({ clips: list });
});

voices.post("/", requireAuth("admin", ...STAFF), async (req, res) => {
  const { dialect, key, mime, data } = req.body || {};
  if (!DIALECTS.some((d) => d.code === dialect)) throw new HttpError(400, "Choose a dialect.");
  if (!ALL_CLIP_KEYS.includes(key)) throw new HttpError(400, "Unknown phrase.");
  const type = String(mime || "").split(";")[0];
  if (!MIMES.includes(type)) throw new HttpError(400, "Unsupported audio format.");
  if (typeof data !== "string" || !data || data.length > MAX_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(data)) {
    throw new HttpError(400, "The recording is missing or too long (keep each clip under a few seconds).");
  }
  const isAdmin = req.user.role === "admin";
  const clip = {
    id: newId(), dialect, key, mime: type, data, size: data.length,
    recordedBy: { id: req.user.id, name: req.user.name }, status: isAdmin ? "approved" : "pending", createdAt: nowIso(),
  };
  const clips = await col("voiceclips");
  if (isAdmin) await retireApproved(clips, dialect, key);
  await clips.insertOne(clip);
  await audit(req.user, "voice_clip_uploaded", clip.id, `${dialect}/${key}`);
  const { data: _omit, ...safe } = clip;
  res.status(201).json({ clip: safe });
});

async function retireApproved(clips, dialect, key) {
  for (const old of await clips.find({ dialect, key, status: "approved" })) await clips.updateOne({ id: old.id }, { status: "replaced" });
}

voices.post("/:id/review", requireAuth("admin"), async (req, res) => {
  const clips = await col("voiceclips");
  const clip = await clips.findOne({ id: req.params.id });
  if (!clip || clip.status !== "pending") throw new HttpError(404, "No clip waiting for review.");
  const approve = req.body.decision === "approve";
  if (approve) await retireApproved(clips, clip.dialect, clip.key);
  await clips.updateOne({ id: clip.id }, { status: approve ? "approved" : "rejected" });
  await audit(req.user, approve ? "voice_clip_approved" : "voice_clip_rejected", clip.id, `${clip.dialect}/${clip.key}`);
  res.json({ ok: true });
});

voices.delete("/:id", requireAuth("admin"), async (req, res) => {
  await (await col("voiceclips")).deleteOne({ id: req.params.id });
  await audit(req.user, "voice_clip_deleted", req.params.id);
  res.json({ ok: true });
});
