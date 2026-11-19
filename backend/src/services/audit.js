import { col } from "../db/collections.js";
import { newId } from "../lib/ids.js";
import { nowIso } from "../lib/dates.js";

// Append-only trail of administrative and safety-relevant actions.
export async function audit(user, action, target = null, detail = null) {
  await (await col("audit")).insertOne({
    id: newId(),
    at: nowIso(),
    actor: user ? { id: user.id, name: user.name, role: user.role } : null,
    action,
    target,
    detail,
  });
}
