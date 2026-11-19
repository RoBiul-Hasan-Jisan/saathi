import { config } from "./config.js";
import { buildApp } from "./app.js";
import { ensureSeed } from "./db/seed.js";
import { storageMode } from "./db/collections.js";

const app = buildApp();

ensureSeed()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`Saathi API listening on http://localhost:${config.port}`);
      console.log(`  storage : ${storageMode()}`);
      console.log(`  demo    : ${config.enableDemo ? "enabled" : "disabled"}`);
      console.log(`  firebase: ${config.firebaseProjectId || "NOT configured (email sign-in will not work)"}`);
      if (!config.isProd && !process.env.SESSION_SECRET) console.log("  warning : SESSION_SECRET is not set (using an insecure development value)");
    });
  })
  .catch((err) => {
    console.error("Could not start:", err);
    process.exit(1);
  });
