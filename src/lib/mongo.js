import { MongoClient } from "mongodb";

const g = globalThis;
let failedAt = 0;

// Returns a Db, or null when MONGODB_URI is missing or unreachable.
// The store falls back to memory in that case, so demo login never waits on the database.
export async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    g.__saathiMode = "memory (MONGODB_URI not set)";
    return null;
  }
  if (failedAt && Date.now() - failedAt < 60_000) return null;

  try {
    if (!g.__mongoClientPromise) {
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 });
      g.__mongoClientPromise = client.connect();
    }
    const client = await g.__mongoClientPromise;
    g.__saathiMode = "mongodb";
    return client.db(process.env.MONGODB_DB || "saathi");
  } catch (err) {
    console.error("[saathi] MongoDB unavailable, using in-memory store:", err.message);
    g.__mongoClientPromise = null;
    failedAt = Date.now();
    g.__saathiMode = "memory (MongoDB unreachable)";
    return null;
  }
}

export function storageMode() {
  return g.__saathiMode || "unknown";
}
