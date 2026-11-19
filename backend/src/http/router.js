import http from "node:http";
import { HttpError } from "../lib/errors.js";

// A tiny Express-style framework so the backend needs no web-framework dependency.
// Handlers look like Express:  (req, res, next) => { ... res.json({...}) }
//   req.params  req.query  req.body  req.cookies  req.ip
//   res.status(n)  res.json(obj)  res.send(data, type)  res.cookie(...)  res.clearCookie(...)

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function compile(path) {
  const keys = [];
  const src = path
    .split("/")
    .filter(Boolean)
    .map((seg) => {
      if (seg.startsWith(":")) {
        keys.push(seg.slice(1));
        return "([^/]+)";
      }
      return esc(seg);
    })
    .join("/");
  return { re: new RegExp(`^/${src}/?$`), keys };
}

export function Router() {
  const routes = [];
  const middleware = [];
  const add = (method) => (path, ...handlers) => routes.push({ method, path, handlers });
  return {
    routes,
    middleware,
    use: (...fns) => middleware.push(...fns),
    get: add("GET"),
    post: add("POST"),
    patch: add("PATCH"),
    put: add("PUT"),
    delete: add("DELETE"),
  };
}

async function runChain(fns, req, res) {
  let i = 0;
  const next = async (err) => {
    if (err) throw err;
    const fn = fns[i++];
    if (fn) await fn(req, res, next);
  };
  await next();
}

function decorate(req, res) {
  const url = new URL(req.url, "http://localhost");
  req.path = url.pathname;
  req.query = Object.fromEntries(url.searchParams);
  req.params = {};
  req.cookies = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) {
      try {
        req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        /* ignore malformed cookie */
      }
    }
  }
  req.ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

  res.status = (n) => {
    res.statusCode = n;
    return res;
  };
  res.json = (obj) => {
    const body = JSON.stringify(obj);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Length", Buffer.byteLength(body));
    res.end(body);
    return res;
  };
  res.send = (data, type = "text/plain; charset=utf-8") => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
    res.setHeader("Content-Type", type);
    res.setHeader("Content-Length", buf.length);
    res.end(buf);
    return res;
  };
  res.cookie = (name, value, o = {}) => {
    let c = `${name}=${encodeURIComponent(value)}; Path=${o.path || "/"}`;
    if (o.maxAge != null) c += `; Max-Age=${o.maxAge}`;
    if (o.httpOnly) c += "; HttpOnly";
    if (o.secure) c += "; Secure";
    c += `; SameSite=${o.sameSite || "Lax"}`;
    res.appendHeader("Set-Cookie", c);
    return res;
  };
  res.clearCookie = (name, o = {}) => res.cookie(name, "", { ...o, maxAge: 0 });
}

export function createApp() {
  const globalMw = [];
  const routes = [];

  const dispatch = async (req, res) => {
    let pathMatched = false;
    for (const r of routes) {
      const m = r.re.exec(req.path);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== req.method) continue;
      r.keys.forEach((k, i) => {
        try {
          req.params[k] = decodeURIComponent(m[i + 1]);
        } catch {
          req.params[k] = m[i + 1];
        }
      });
      return runChain(r.handlers, req, res);
    }
    throw new HttpError(pathMatched ? 405 : 404, pathMatched ? "Method not allowed." : "Not found.");
  };

  const app = {
    use: (...fns) => globalMw.push(...fns),
    mount(prefix, router) {
      for (const r of router.routes) {
        const full = prefix.replace(/\/+$/, "") + (r.path === "/" ? "" : r.path);
        routes.push({
          method: r.method,
          ...compile(full || "/"),
          handlers: [...router.middleware, ...r.handlers],
        });
      }
    },
    async handler(req, res) {
      try {
        decorate(req, res);
        await runChain([...globalMw, dispatch], req, res);
      } catch (err) {
        if (res.headersSent) return res.end();
        if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
        console.error("[saathi] unexpected error:", err);
        res.status(500).json({ error: "Something went wrong on the server." });
      }
    },
    listen(port, cb) {
      const server = http.createServer((req, res) => app.handler(req, res));
      return server.listen(port, cb);
    },
  };
  return app;
}
