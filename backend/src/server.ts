import "dotenv/config";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createPrisma } from "./db/prisma.js";
import { PrismaUserRepository } from "./modules/auth/prismaUserRepository.js";

let env;
try {
  env = loadEnv();
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

const prisma = createPrisma(env.DATABASE_URL);

const app = createApp({
  frontendOrigin: env.FRONTEND_ORIGIN,
  auth: {
    users: new PrismaUserRepository(prisma),
    session: { jwtSecret: env.JWT_SECRET, secureCookies: env.NODE_ENV === "production" },
  },
});

const server = app.listen(env.PORT, () => {
  console.log(`PulseOps API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Stop cleanly on Ctrl+C or when the process manager asks.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
