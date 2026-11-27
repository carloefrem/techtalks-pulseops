import { Router } from "express";
import { ApiError } from "../../lib/apiError.js";
import { validate } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { LoginBody, RegisterBody } from "./auth.schemas.js";
import { AuthService, toPublicUser } from "./auth.service.js";
import { clearSessionCookie, setSessionCookie, type SessionConfig } from "./session.js";
import type { UserRepository } from "./user.repository.js";
import { DEFAULT_BCRYPT_COST } from "./password.js";

export interface AuthDeps {
  users: UserRepository;
  session: SessionConfig;
  /** Defaults to 12. Tests use a low value. */
  bcryptCost?: number;
}

/**
 * R1 — POST /auth/register, POST /auth/login, POST /auth/logout, GET /auth/me
 * (docs/api/README.md 5.2). Mounted under /api.
 */
export function createAuthRouter({ users, session, bcryptCost = DEFAULT_BCRYPT_COST }: AuthDeps): Router {
  const service = new AuthService(users, bcryptCost);
  const router = Router();

  // PULSE-105: create an account and sign in.
  router.post("/auth/register", async (req, res) => {
    const input = validate(RegisterBody, req.body);
    const user = await service.register(input);
    await setSessionCookie(res, user.id, session);
    res.status(201).json({ user: toPublicUser(user) });
  });

  // PULSE-106: sign in with email and password.
  router.post("/auth/login", async (req, res) => {
    const input = validate(LoginBody, req.body);
    const user = await service.login(input);
    await setSessionCookie(res, user.id, session);
    res.status(200).json({ user: toPublicUser(user) });
  });

  // PULSE-106: sign out. Always succeeds, even without a session.
  router.post("/auth/logout", (_req, res) => {
    clearSessionCookie(res, session);
    res.status(204).end();
  });

  // PULSE-107: the signed-in user.
  router.get("/auth/me", requireAuth(session), async (_req, res) => {
    const user = await service.findUser(res.locals.userId as bigint);
    if (!user) {
      // Valid token, but the account no longer exists.
      clearSessionCookie(res, session);
      throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue");
    }
    res.status(200).json({ user: toPublicUser(user) });
  });

  return router;
}
