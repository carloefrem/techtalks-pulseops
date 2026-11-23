import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrisma } from "../../src/db/prisma.js";
import { checkDatabase, type DatabaseCheck } from "../../src/db/checkDatabase.js";
import { assertConnectedToTestDatabase, assertSafeTestDatabase } from "../setup/guard.js";

// Runs only when TEST_DATABASE_URL is set (npm run test:db). Without it, `npm test` skips this file,
// so the rest of the suite works on any computer.
const enabled = Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)("database connectivity (PULSE-73)", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let check: DatabaseCheck;

  // Guard first: nothing below runs unless this is really the separate *_test database.
  beforeAll(async () => {
    const url = assertSafeTestDatabase(process.env);
    prisma = createPrisma(url);
    check = await checkDatabase(prisma);
    if (!check.ok) throw new Error(`Database check failed: ${check.error}`);
    assertConnectedToTestDatabase(url, check.database);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("reaches PostgreSQL 18", () => {
    expect(check.ok && check.serverVersion).toMatch(/^18\./);
  });

  it("has the migrated tables", async () => {
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
    expect(rows.map((r) => r.table_name)).toEqual(
      expect.arrayContaining(["users", "monitors", "check_results", "incidents", "incident_notes"]),
    );
  });
});
