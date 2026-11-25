import bcrypt from "bcryptjs";

/** Work factor for production. Tests pass a lower value to stay fast. */
export const DEFAULT_BCRYPT_COST = 12;

export function hashPassword(password: string, cost: number = DEFAULT_BCRYPT_COST): Promise<string> {
  return bcrypt.hash(password, cost);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * A real bcrypt hash of a random string, compared against when the email
 * doesn't exist. Login then takes about the same time either way, so response
 * timing doesn't reveal which emails have accounts.
 */
let dummyHash: Promise<string> | undefined;
export function dummyPasswordHash(cost: number = DEFAULT_BCRYPT_COST): Promise<string> {
  dummyHash ??= bcrypt.hash(`no-such-user-${Math.random()}`, cost);
  return dummyHash;
}
