import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrisma } from "../../src/db/prisma.js";
import { checkDatabase } from "../../src/db/checkDatabase.js";
import { PrismaUserRepository } from "../../src/modules/auth/prismaUserRepository.js";
import { EmailTakenError } from "../../src/modules/auth/user.repository.js";
import { assertConnectedToTestDatabase, assertSafeTestDatabase } from "../setup/guard.js";

// PrismaUserRepository against the real PostgreSQL test database (PULSE-105/106/107).
// Runs only with TEST_DATABASE_URL set (npm run test:db), behind the same guard as database.test.ts.
const enabled = Boolean(process.env.TEST_DATABASE_URL);

describe.runIf(enabled)("PrismaUserRepository on PostgreSQL (PULSE-87)", () => {
  let prisma: ReturnType<typeof createPrisma>;
  let repo: PrismaUserRepository;
  const prefix = `authdb-${Date.now()}`;

  beforeAll(async () => {
    const url = assertSafeTestDatabase(process.env);
    prisma = createPrisma(url);
    const check = await checkDatabase(prisma);
    if (!check.ok) throw new Error(`Database check failed: ${check.error}`);
    assertConnectedToTestDatabase(url, check.database);
    repo = new PrismaUserRepository(prisma);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
      await prisma.$disconnect();
    }
  });

  it("creates a user and returns a bigint id", async () => {
    const user = await repo.create({ email: `${prefix}-a@example.com`, passwordHash: "$2b$04$hash", displayName: "A" });
    expect(typeof user.id).toBe("bigint");
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(await repo.findById(user.id)).toMatchObject({ email: `${prefix}-a@example.com`, displayName: "A" });
  });

  it("finds users by email case-insensitively", async () => {
    await repo.create({ email: `${prefix}-b@example.com`, passwordHash: "$2b$04$hash", displayName: null });
    expect((await repo.findByEmail(`${prefix.toUpperCase()}-B@EXAMPLE.COM`))?.email).toBe(`${prefix}-b@example.com`);
  });

  it("maps the lower(email) unique index to EmailTakenError", async () => {
    await repo.create({ email: `${prefix}-c@example.com`, passwordHash: "$2b$04$hash", displayName: null });
    // Bypasses the app's lowercasing to prove the database itself enforces it.
    await expect(
      repo.create({ email: `${prefix}-C@EXAMPLE.com`, passwordHash: "$2b$04$hash", displayName: null }),
    ).rejects.toBeInstanceOf(EmailTakenError);
  });

  it("returns null for unknown users", async () => {
    expect(await repo.findByEmail(`${prefix}-missing@example.com`)).toBeNull();
    expect(await repo.findById(999999999999n)).toBeNull();
  });
});
