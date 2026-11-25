import type { PrismaClient } from "../../generated/prisma/client.js";
import { EmailTakenError, type NewUser, type UserRecord, type UserRepository } from "./user.repository.js";

/**
 * True when PostgreSQL rejected the insert because of the unique index on
 * lower(email) (users_email_lower_uq, docs/database/schema.sql).
 * That index lives only in the migration SQL, so depending on how Prisma maps
 * the driver error we may see P2002 or the raw PostgreSQL code 23505.
 */
function isEmailUniqueViolation(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown; meta?: unknown };
  if (e?.code === "P2002") return true;
  const text = `${String(e?.message ?? "")} ${JSON.stringify(e?.meta ?? {})}`;
  return text.includes("users_email_lower_uq") || text.includes("23505");
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    // Same expression as the unique index users_email_lower_uq, so PostgreSQL uses
    // that index and the match is case-insensitive. Tagged template = parameterized query.
    const rows = await this.prisma.$queryRaw<
      { id: bigint; email: string; password_hash: string; display_name: string | null; created_at: Date }[]
    >`SELECT id, email, password_hash, display_name, created_at FROM users WHERE lower(email) = lower(${email}) LIMIT 1`;
    const row = rows[0];
    return row
      ? { id: row.id, email: row.email, passwordHash: row.password_hash, displayName: row.display_name, createdAt: row.created_at }
      : null;
  }

  async findById(id: bigint): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, passwordHash: true, displayName: true, createdAt: true },
    });
  }

  async create(user: NewUser): Promise<UserRecord> {
    try {
      return await this.prisma.user.create({
        data: { email: user.email, passwordHash: user.passwordHash, displayName: user.displayName },
        select: { id: true, email: true, passwordHash: true, displayName: true, createdAt: true },
      });
    } catch (error) {
      if (isEmailUniqueViolation(error)) throw new EmailTakenError();
      throw error;
    }
  }
}
