/**
 * What the auth module needs from storage. The real implementation uses Prisma
 * (prismaUserRepository.ts); tests can pass an in-memory one, so the HTTP
 * behaviour is tested without a database and the SQL is tested separately.
 */
export interface UserRecord {
  id: bigint;
  email: string;
  passwordHash: string;
  displayName: string | null;
  createdAt: Date;
}

export interface NewUser {
  /** Already trimmed and lowercased. */
  email: string;
  passwordHash: string;
  displayName: string | null;
}

export interface UserRepository {
  /** Case-insensitive lookup. */
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: bigint): Promise<UserRecord | null>;
  /** Throws EmailTakenError when the email already exists (any case). */
  create(user: NewUser): Promise<UserRecord>;
}

export class EmailTakenError extends Error {
  constructor() {
    super("Email already registered");
    this.name = "EmailTakenError";
  }
}
