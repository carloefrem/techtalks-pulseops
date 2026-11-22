import type { PrismaClient } from "../generated/prisma/client.js";

export type DatabaseCheck =
  | { ok: true; database: string; serverVersion: string; latencyMs: number }
  | { ok: false; error: string };

/**
 * Reproducible database connectivity check (PULSE-69 / PULSE-73).
 * Runs one read-only query and reports which database it reached.
 */
export async function checkDatabase(prisma: PrismaClient): Promise<DatabaseCheck> {
  const started = performance.now();
  try {
    const rows = await prisma.$queryRaw<{ database: string; version: string }[]>`
      SELECT current_database() AS database, current_setting('server_version') AS version`;
    const row = rows[0];
    return {
      ok: true,
      database: row?.database ?? "unknown",
      serverVersion: row?.version ?? "unknown",
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    // Never echo the connection string: it contains the password.
    return { ok: false, error: (error as Error).message.replace(/postgres(ql)?:\/\/[^\s]+/g, "postgresql://***") };
  }
}
