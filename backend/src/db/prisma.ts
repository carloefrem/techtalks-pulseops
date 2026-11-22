import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Creates a Prisma Client that connects with the node-postgres driver adapter (Prisma 7).
 * Create ONE per process and reuse it. Call $disconnect() on shutdown.
 * Prisma returns BIGINT ids as JavaScript bigint; convert them to strings at the API boundary.
 */
export function createPrisma(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}
