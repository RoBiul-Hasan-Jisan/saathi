import { config } from "../config.js";
import { signJwt, verifyJwt } from "../lib/jwt.js";
import { col } from "../db/collections.js";
import { HttpError } from "../lib/errors.js";

export const COOKIE = "saathi_session";
const MAX_AGE = 7 * 24 * 3600;

export function issueSession(res, user) {
  const token = signJwt(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      org: user.org,
      demo: !!user.demo,
      sv: user.sessionVersion || 0,
    },
    config.sessionSecret,
    MAX_AGE
  );
  res.cookie(COOKIE, token, {
    maxAge: MAX_AGE,
    httpOnly: true,
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure,
  });
  return token;
}

// Runs on every request: sets req.user (or null). Real accounts are re-checked against the
// database each time, so a role change, deactivation or "sign out everywhere" takes effect at once.
export async function authenticate(req, res, next) {
  req.user = null;
  const header = req.headers.authorization;
  const token = req.cookies[COOKIE] || (header?.startsWith("Bearer ") ? header.slice(7) : null);
  const p = token ? verifyJwt(token, config.sessionSecret) : null;
  if (p) {
    if (p.demo) {
      if (config.enableDemo) req.user = { id: p.sub, name: p.name, email: p.email, role: p.role, org: p.org, demo: true };
    } else {
      const u = await (await col("users")).findOne({ id: p.sub });
      if (u && u.active !== false && (u.sessionVersion || 0) === (p.sv || 0)) {
        req.user = { id: u.id, name: u.name, email: u.email, role: u.role, org: u.org, demo: false };
      }
    }
  }
  await next();
}

export const requireAuth =
  (...roles) =>
  async (req, res, next) => {
    if (!req.user) throw new HttpError(401, "Please sign in.");
    if (roles.length && !roles.includes(req.user.role)) throw new HttpError(403, "You do not have permission to do this.");
    await next();
  };

// Pharmacists / health workers must belong to a pharmacy or clinic before they can create cards.
export function requireOrg(user) {
  if (!user.org || user.org === "unassigned") {
    throw new HttpError(403, "Your account has not been assigned to a pharmacy or clinic yet. Ask an admin.");
  }
}
