import { HttpError } from "../lib/errors.js";

// Security headers + no caching of API data (patient data must not linger in caches).
export function securityHeaders() {
  return async (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    await next();
  };
}

// Only needed if a browser talks to this API directly. Through the Next.js proxy it is bypassed.
export function cors(allowed) {
  return async (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowed.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") return res.status(204).end();
    await next();
  };
}

export function jsonBody(limitBytes = 1_000_000) {
  return async (req, res, next) => {
    req.body = {};
    if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return next();
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limitBytes) throw new HttpError(413, "Request is too large.");
      chunks.push(chunk);
    }
    if (size) {
      try {
        req.body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new HttpError(400, "Request body must be valid JSON.");
      }
    }
    await next();
  };
}

// Simple in-memory limiter, per IP and per bucket name.
export function rateLimit({ windowMs = 60_000, max = 60, name = "default" } = {}) {
  const hits = new Map();
  return async (req, res, next) => {
    const now = Date.now();
    const key = `${name}:${req.ip}`;
    let h = hits.get(key);
    if (!h || h.reset < now) {
      h = { count: 0, reset: now + windowMs };
      hits.set(key, h);
      if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    }
    if (++h.count > max) throw new HttpError(429, "Too many requests. Please wait a minute and try again.");
    await next();
  };
}
