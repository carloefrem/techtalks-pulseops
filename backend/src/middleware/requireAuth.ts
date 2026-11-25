import type { RequestHandler } from "express";
import { ApiError } from "../lib/apiError.js";
import { SESSION_COOKIE, readCookie, readSessionToken, type SessionConfig } from "../modules/auth/session.js";

/**
 * Protects a route: needs a valid pulseops_session cookie, otherwise
 * 401 UNAUTHENTICATED (docs/api/README.md section 3).
 * On success the signed-in user's ID is in res.locals.userId (a bigint).
 * Later modules (monitors, incidents) use it to enforce ownership (BR-01).
 */
export function requireAuth(config: SessionConfig): RequestHandler {
  return async (req, res, next) => {
    const token = readCookie(req, SESSION_COOKIE);
    const userId = token ? await readSessionToken(token, config) : null;
    if (userId === null) {
      next(new ApiError(401, "UNAUTHENTICATED", "Sign in to continue"));
      return;
    }
    res.locals.userId = userId;
    next();
  };
}
