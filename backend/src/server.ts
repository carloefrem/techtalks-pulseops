import "dotenv/config";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";

let env;
try {
  env = loadEnv();
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const app = createApp({ frontendOrigin: env.FRONTEND_ORIGIN });

const server = app.listen(env.PORT, () => {
  console.log(`PulseOps API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Stop cleanly on Ctrl+C or when the process manager asks.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
