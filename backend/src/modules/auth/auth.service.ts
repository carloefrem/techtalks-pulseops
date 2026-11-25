import { ApiError } from "../../lib/apiError.js";
import { idToString } from "../../lib/ids.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";
import { dummyPasswordHash, hashPassword, verifyPassword } from "./password.js";
import { EmailTakenError, type UserRecord, type UserRepository } from "./user.repository.js";

/** The User object the API returns (docs/api/README.md 5.2). Never includes the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: idToString(user.id),
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}

const INVALID_CREDENTIALS = () =>
  new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly bcryptCost: number,
  ) {}

  async register(input: RegisterInput): Promise<UserRecord> {
    const passwordHash = await hashPassword(input.password, this.bcryptCost);
    try {
      return await this.users.create({
        email: input.email,
        passwordHash,
        displayName: input.displayName ?? null,
      });
    } catch (error) {
      if (error instanceof EmailTakenError) {
        throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists", [
          { field: "email", message: "is already registered" },
        ]);
      }
      throw error;
    }
  }

  /** Same error and similar timing whether the email or the password is wrong. */
  async login(input: LoginInput): Promise<UserRecord> {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      await verifyPassword(input.password, await dummyPasswordHash(this.bcryptCost));
      throw INVALID_CREDENTIALS();
    }
    if (!(await verifyPassword(input.password, user.passwordHash))) throw INVALID_CREDENTIALS();
    return user;
  }

  findUser(id: bigint): Promise<UserRecord | null> {
    return this.users.findById(id);
  }
}
