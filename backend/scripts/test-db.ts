// npm run db:test:prepare — guard, then apply migrations to the TEST database only.
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { assertSafeTestDatabase } from "../tests/setup/guard.js";

let url: string;
try {
  url = assertSafeTestDatabase(process.env);
} catch (error) {
  console.error(`test db guard: ${(error as Error).message}`);
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(result.status ?? 1);
