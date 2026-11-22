// npm run db:check — prints "db ok ..." or exits with code 1.
import "dotenv/config";
import { createPrisma } from "../src/db/prisma.js";
import { checkDatabase } from "../src/db/checkDatabase.js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("db error: DATABASE_URL is not set (check backend/.env)");
  process.exit(1);
}

const prisma = createPrisma(url);
const result = await checkDatabase(prisma);
await prisma.$disconnect();

if (result.ok) {
  console.log(`db ok: database=${result.database} postgres=${result.serverVersion} latency=${result.latencyMs}ms`);
} else {
  console.error(`db error: ${result.error}`);
  process.exit(1);
}
