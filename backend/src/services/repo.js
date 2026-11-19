import { col } from "../db/collections.js";
import { activeLibrary } from "../domain/library.js";
import { canViewCard } from "../domain/perms.js";
import { ensureSeed } from "../db/seed.js";

// Small helpers shared by several routes. Pilot data is small, so we filter in JS after fetching.

export async function getSettings() {
  await ensureSeed();
  return (await (await col("settings")).findOne({ id: "global" })) || { id: "global", safetyGate: { paused: false } };
}

export async function saveSettings(s) {
  await (await col("settings")).replaceOne({ id: "global" }, s);
}

export async function getLibrary() {
  await ensureSeed();
  const docs = await (await col("library")).find({});
  return activeLibrary(docs);
}

export async function getCard(id) {
  await ensureSeed();
  return (await col("cards")).findOne({ id });
}

export async function getCardByToken(token) {
  await ensureSeed();
  return (await col("cards")).findOne({ token });
}

export async function saveCard(card) {
  await (await col("cards")).replaceOne({ id: card.id }, card);
  return card;
}

export async function allCards() {
  await ensureSeed();
  const list = await (await col("cards")).find({});
  return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function visibleCards(user) {
  return (await allCards()).filter((c) => canViewCard(user, c));
}

export async function orgsById() {
  await ensureSeed();
  const orgs = await (await col("orgs")).find({});
  return new Map(orgs.map((o) => [o.id, o]));
}

export async function intakesFor(cardId) {
  return (await col("intakes")).find({ cardId });
}
