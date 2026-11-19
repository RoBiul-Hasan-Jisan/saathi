import { Router } from "../http/router.js";
import { config } from "../config.js";
import { col } from "../db/collections.js";
import { ensureSeed } from "../db/seed.js";
import { HttpError } from "../lib/errors.js";
import { newId } from "../lib/ids.js";
import { clean } from "../lib/validate.js";
import { nowIso } from "../lib/dates.js";
import { DEMO_USERS } from "../domain/demoUsers.js";
import { SELF_SIGNUP_ROLES, STAFF } from "../domain/constants.js";
import { COOKIE, issueSession, requireAuth } from "../middleware/auth.js";
import { verifyFirebaseToken } from "../services/firebase.js";
import { audit } from "../services/audit.js";

export const auth = Router();

// Tiles for the login page.
auth.get("/demo-users", async (req, res) => {
  if (!config.enableDemo) return res.json({ users: [] });
  res.json({ users: DEMO_USERS.map(({ role, title, blurb }) => ({ role, title, blurb })) });
});

// Instant login: signs the cookie from the demo list. No database, no Firebase.
auth.post("/demo", async (req, res) => {
  if (!config.enableDemo) throw new HttpError(403, "Demo accounts are disabled.");
  const user = DEMO_USERS.find((u) => u.role === req.body.role);
  if (!user) throw new HttpError(400, "Unknown demo role.");
  issueSession(res, user);
  res.json({ ok: true, user: publicUser(user) });
});

// Exchange a Firebase ID token for our own session cookie. Creates the MongoDB user on first sign-in.
auth.post("/firebase", async (req, res) => {
  const { idToken, role, name, orgId } = req.body || {};
  if (!idToken) throw new HttpError(400, "Missing token.");
  const fb = await verifyFirebaseToken(idToken);
  if (!fb.email) throw new HttpError(400, "This account has no email address.");

  await ensureSeed();
  const users = await col("users");
  let user = await users.findOne({ email: fb.email });

  if (!user) {
    const isAdmin = config.adminEmails.includes(fb.email);
    const chosen = SELF_SIGNUP_ROLES.includes(role) ? role : "patient";
    const finalRole = isAdmin ? "admin" : chosen;
    const needsApproval = STAFF.includes(finalRole) && !config.autoApproveStaff;
    let org = "unassigned";
    if (orgId) {
      const found = await (await col("orgs")).findOne({ id: String(orgId), active: true });
      if (found) org = found.id;
    }
    user = {
      id: newId(), uid: fb.uid, email: fb.email, name: clean(name || fb.name || fb.email.split("@")[0], 60),
      role: finalRole, org, demo: false, active: !needsApproval, sessionVersion: 0, createdAt: nowIso(),
    };
    await users.insertOne(user);
    await audit(user, "account_created", user.id, `role=${finalRole}${needsApproval ? " (awaiting approval)" : ""}`);
  }

  if (user.active === false) {
    return res.status(403).json({ error: "Your account is waiting for an admin to approve it.", pending: true });
  }
  issueSession(res, user);
  res.json({ ok: true, user: publicUser(user) });
});

auth.post("/logout", async (req, res) => {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: config.cookieSameSite, secure: config.cookieSecure });
  res.json({ ok: true });
});

// Lost or stolen shared device: invalidate every session of this account.
auth.post("/logout-all", requireAuth(), async (req, res) => {
  if (!req.user.demo) {
    const users = await col("users");
    const u = await users.findOne({ id: req.user.id });
    await users.updateOne({ id: u.id }, { sessionVersion: (u.sessionVersion || 0) + 1 });
    await audit(req.user, "sign_out_everywhere", req.user.id);
  }
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: config.cookieSameSite, secure: config.cookieSecure });
  res.json({ ok: true });
});

auth.get("/me", async (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null, demoEnabled: config.enableDemo });
});

export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, org: u.org, demo: !!u.demo });
