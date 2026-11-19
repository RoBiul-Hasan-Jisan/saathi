import { config } from "../config.js";

// Data layer. With a working MONGODB_URI everything lives in MongoDB; otherwise in memory
// (resets when the server restarts) so the app and demo accounts still run with zero setup.
// Every collection offers the same small API either way:
//   find(filter, {sort, limit})  findOne  insertOne  insertIfMissing  replaceOne  updateOne  deleteOne  count
// Filters support plain equality (array fields match if they contain the value) and $in $ne $gt $gte $lt $lte.

const g = globalThis;
g.__saathiMem ||= {};
let failedAt = 0;
let mode = "unknown";

export const storageMode = () => mode;

export async function mongoDb() {
  const uri = config.mongodbUri;
  if (!uri) {
    mode = "memory (MONGODB_URI not set)";
    return null;
  }
  if (failedAt && Date.now() - failedAt < 60_000) return null;
  try {
    if (!g.__saathiMongo) {
      const { MongoClient } = await import("mongodb");
      g.__saathiMongo = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 }).connect();
    }
    const client = await g.__saathiMongo;
    mode = "mongodb";
    return client.db(config.mongodbDb);
  } catch (err) {
    console.error("[saathi] MongoDB unavailable, using the in-memory store:", err.message);
    g.__saathiMongo = null;
    failedAt = Date.now();
    mode = "memory (MongoDB unreachable)";
    return null;
  }
}

export async function col(name) {
  const db = await mongoDb();
  return db ? mongoCol(db.collection(name)) : memCol(name);
}

/* ---------- MongoDB ---------- */
const NO_ID = { projection: { _id: 0 } };

function mongoCol(m) {
  return {
    find: (f = {}, o = {}) => {
      let c = m.find(f, NO_ID);
      if (o.sort) c = c.sort(o.sort);
      if (o.limit) c = c.limit(o.limit);
      return c.toArray();
    },
    findOne: (f) => m.findOne(f, NO_ID),
    insertOne: async (d) => {
      await m.insertOne({ ...d });
      return d;
    },
    insertIfMissing: (d) => m.updateOne({ id: d.id }, { $setOnInsert: { ...d } }, { upsert: true }),
    replaceOne: (f, d) => m.replaceOne(f, d),
    updateOne: (f, set) => m.updateOne(f, { $set: set }),
    deleteOne: (f) => m.deleteOne(f),
    count: (f = {}) => m.countDocuments(f),
  };
}

/* ---------- Memory ---------- */
const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

function matchValue(actual, cond) {
  const isOps = cond && typeof cond === "object" && !Array.isArray(cond) && Object.keys(cond).some((k) => k.startsWith("$"));
  if (!isOps) return Array.isArray(actual) ? actual.includes(cond) : actual === cond;
  return Object.entries(cond).every(([op, v]) => {
    switch (op) {
      case "$in": return Array.isArray(actual) ? actual.some((x) => v.includes(x)) : v.includes(actual);
      case "$ne": return Array.isArray(actual) ? !actual.includes(v) : actual !== v;
      case "$gt": return actual > v;
      case "$gte": return actual >= v;
      case "$lt": return actual < v;
      case "$lte": return actual <= v;
      default: throw new Error(`Unsupported filter operator ${op}`);
    }
  });
}

const matches = (doc, filter) => Object.entries(filter).every(([k, c]) => matchValue(get(doc, k), c));
const clone = (v) => (v == null ? v : structuredClone(v));

function memCol(name) {
  const arr = (g.__saathiMem[name] ||= []);
  return {
    find: async (f = {}, o = {}) => {
      let out = arr.filter((d) => matches(d, f));
      if (o.sort) {
        const [[key, dir]] = Object.entries(o.sort);
        out = [...out].sort((a, b) => (get(a, key) > get(b, key) ? dir : get(a, key) < get(b, key) ? -dir : 0));
      }
      if (o.limit) out = out.slice(0, o.limit);
      return clone(out);
    },
    findOne: async (f) => clone(arr.find((d) => matches(d, f)) ?? null),
    insertOne: async (d) => {
      arr.push(clone(d));
      return d;
    },
    insertIfMissing: async (d) => {
      if (!arr.some((x) => x.id === d.id)) arr.push(clone(d));
    },
    replaceOne: async (f, d) => {
      const i = arr.findIndex((x) => matches(x, f));
      if (i >= 0) arr[i] = clone(d);
    },
    updateOne: async (f, set) => {
      const d = arr.find((x) => matches(x, f));
      if (d) Object.assign(d, clone(set));
    },
    deleteOne: async (f) => {
      const i = arr.findIndex((x) => matches(x, f));
      if (i >= 0) arr.splice(i, 1);
    },
    count: async (f = {}) => arr.filter((d) => matches(d, f)).length,
  };
}

// Test helper: wipe the in-memory store.
export function resetMemory() {
  for (const k of Object.keys(g.__saathiMem)) delete g.__saathiMem[k];
}
