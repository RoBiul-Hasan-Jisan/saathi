import { createApp } from "./http/router.js";
import { cors, jsonBody, rateLimit, securityHeaders } from "./http/middleware.js";
import { config } from "./config.js";
import { authenticate } from "./middleware/auth.js";
import { auth } from "./routes/auth.js";
import { misc } from "./routes/misc.js";
import { cards } from "./routes/cards.js";
import { publicRoutes } from "./routes/public.js";
import { patients } from "./routes/patients.js";
import { library } from "./routes/library.js";
import { erx } from "./routes/eprescriptions.js";
import { incidents } from "./routes/incidents.js";
import { voices } from "./routes/voices.js";
import { admin } from "./routes/admin.js";
import { dashboard } from "./routes/dashboard.js";

export function buildApp() {
  const app = createApp();
  // Order matters: headers, CORS, body, then who-is-calling, then routes.
  app.use(securityHeaders(), cors(config.corsOrigins), jsonBody(1_000_000), authenticate);

  const authLimit = Router401();
  app.mount("/api/auth", withLimit(auth, authLimit));
  app.mount("/api", misc);
  app.mount("/api/dashboard", dashboard);
  app.mount("/api/cards", cards);
  app.mount("/api/public", publicRoutes);
  app.mount("/api/patients", patients);
  app.mount("/api/library", library);
  app.mount("/api/eprescriptions", erx);
  app.mount("/api/incidents", incidents);
  app.mount("/api/voices", voices);
  app.mount("/api/admin", admin);
  return app;
}

// Sign-in endpoints get a stricter request limit (guards against password-guessing style abuse).
function Router401() {
  return rateLimit({ name: "auth", max: config.authRateMax });
}
function withLimit(router, limiter) {
  router.middleware.unshift(limiter);
  return router;
}
