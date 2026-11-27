/**
 * IDs are BIGINT in PostgreSQL and arrive from Prisma as JavaScript bigint.
 * JSON can't represent bigint, and large numbers lose precision as JS numbers,
 * so the API always sends IDs as decimal strings (docs/api/README.md, C7).
 */
export function idToString(id: bigint): string {
  return id.toString();
}

/** Parses a decimal string ID. Returns null for anything that is not a positive integer. */
export function parseId(value: string): bigint | null {
  if (!/^[1-9][0-9]{0,18}$/.test(value)) return null;
  const id = BigInt(value);
  return id <= 9223372036854775807n ? id : null;
}
