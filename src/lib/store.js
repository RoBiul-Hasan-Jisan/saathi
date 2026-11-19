import { getDb } from "./mongo";
import { DEMO_USERS } from "./demoUsers";
import { buildSeedCards } from "./seed";
import { canViewCard } from "./perms";

// Data layer: MongoDB when MONGODB_URI works, otherwise an in-memory fallback so the
// app (and demo accounts) still run with zero setup. Memory data resets on restart.

const g = globalThis;
const mem = (g.__saathiMem ||= { users: [], cards: [] });
let seedPromise = null;

const NO_ID = { projection: { _id: 0 } };
const clone = (v) => (v == null ? v : structuredClone(v));
const byNewest = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);

async function col(name) {
  const db = await getDb();
  return db ? db.collection(name) : null;
}

export async function ensureSeed() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const seeds = buildSeedCards();
    const cards = await col("cards");
    if (cards) {
      const users = await col("users");
      await cards.createIndex({ id: 1 }, { unique: true });
      await cards.createIndex({ token: 1 }, { unique: true });
      await users.createIndex({ email: 1 }, { unique: true });
      for (const c of seeds) await cards.updateOne({ id: c.id }, { $setOnInsert: c }, { upsert: true });
      for (const { title, blurb, ...u } of DEMO_USERS)
        await users.updateOne({ id: u.id }, { $setOnInsert: u }, { upsert: true });
    } else {
      for (const c of seeds) if (!mem.cards.some((x) => x.id === c.id)) mem.cards.push(c);
      for (const { title, blurb, ...u } of DEMO_USERS)
        if (!mem.users.some((x) => x.id === u.id)) mem.users.push(u);
    }
  })().catch((err) => {
    seedPromise = null;
    throw err;
  });
  return seedPromise;
}

async function allCards() {
  await ensureSeed();
  const c = await col("cards");
  const list = c ? await c.find({}, NO_ID).toArray() : mem.cards;
  return clone(list).sort(byNewest);
}

export async function listAllCards() {
  return allCards();
}

export async function listCards(user) {
  return (await allCards()).filter((c) => canViewCard(user, c));
}

export async function getCardById(id) {
  await ensureSeed();
  const c = await col("cards");
  return clone(c ? await c.findOne({ id }, NO_ID) : mem.cards.find((x) => x.id === id));
}

export async function getCardByToken(token) {
  await ensureSeed();
  const c = await col("cards");
  return clone(c ? await c.findOne({ token }, NO_ID) : mem.cards.find((x) => x.token === token));
}

export async function insertCard(card) {
  await ensureSeed();
  const c = await col("cards");
  if (c) await c.insertOne({ ...card });
  else mem.cards.push(clone(card));
  return card;
}

export async function saveCard(card) {
  const c = await col("cards");
  if (c) await c.replaceOne({ id: card.id }, card);
  else {
    const i = mem.cards.findIndex((x) => x.id === card.id);
    if (i >= 0) mem.cards[i] = clone(card);
  }
  return card;
}

export async function findUserByEmail(email) {
  await ensureSeed();
  const e = email.toLowerCase();
  const u = await col("users");
  return clone(u ? await u.findOne({ email: e }, NO_ID) : mem.users.find((x) => x.email === e));
}

export async function insertUser(user) {
  const u = await col("users");
  if (u) await u.insertOne({ ...user });
  else mem.users.push(clone(user));
  return user;
}
