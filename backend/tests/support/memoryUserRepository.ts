import { EmailTakenError, type NewUser, type UserRecord, type UserRepository } from "../../src/modules/auth/user.repository.js";

/**
 * In-memory UserRepository for HTTP tests. Mirrors the database rules that
 * matter for auth: case-insensitive unique email and BIGINT ids.
 * The real SQL behaviour is covered by tests/integration/auth.db.test.ts.
 */
export class MemoryUserRepository implements UserRepository {
  private readonly users = new Map<bigint, UserRecord>();
  private nextId = 1n;

  async findByEmail(email: string): Promise<UserRecord | null> {
    const wanted = email.toLowerCase();
    for (const user of this.users.values()) if (user.email.toLowerCase() === wanted) return { ...user };
    return null;
  }

  async findById(id: bigint): Promise<UserRecord | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async create(user: NewUser): Promise<UserRecord> {
    if (await this.findByEmail(user.email)) throw new EmailTakenError();
    const record: UserRecord = { id: this.nextId++, ...user, createdAt: new Date() };
    this.users.set(record.id, record);
    return { ...record };
  }

  /** Test helper: simulates an account that was deleted after the cookie was issued. */
  delete(id: bigint): void {
    this.users.delete(id);
  }

  /** Test helper: the stored row, to check what was saved. */
  stored(email: string): UserRecord | undefined {
    return [...this.users.values()].find((u) => u.email === email);
  }
}
