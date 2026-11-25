import type { Request, RequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit, ipKeyGenerator, type Options } from "express-rate-limit";

/**
 * API security hardening (PULSE-111).
 * - helmet: safe default headers for a JSON API.
 * - strictCors: only FRONTEND_ORIGIN gets CORS headers; any other origin gets none.
 * - rate limiters: 429 RATE_LIMITED in the shared error shape, with Retry-After
 *   (docs/api/README.md section 2).
 */

export function securityHeaders(): RequestHandler {
  // A JSON API serves no HTML, so the strictest CSP is fine.
  return helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: "same-site" },
  });
}

export function strictCors(frontendOrigin: string): RequestHandler {
  return cors({
    // true only for the exact configured origin; other origins get no Access-Control-* headers.
    origin: (origin, callback) => callback(null, origin === frontendOrigin),
    credentials: true,
  });
}

export interface RateLimitSettings {
  windowMs: number;
  max: number;
}

/** Defaults; tests pass smaller values. */
export const AUTH_RATE_LIMIT: RateLimitSettings = { windowMs: 15 * 60 * 1000, max: 10 };
export const MANUAL_CHECK_RATE_LIMIT: RateLimitSettings = { windowMs: 60 * 1000, max: 6 };

function limiter(settings: RateLimitSettings, keyGenerator: Options["keyGenerator"]): RequestHandler {
  return rateLimit({
    windowMs: settings.windowMs,
    limit: settings.max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator,
    // CORS preflights carry no credentials or body; they must not use up anyone's budget.
    skip: (req) => req.method === "OPTIONS",
    handler: (req, res) => {
      const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      const seconds = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000)) : 60;
      res.setHeader("Retry-After", String(seconds));
      res.status(429).json({
        error: { code: "RATE_LIMITED", message: "Too many requests. Try again later.", details: [] },
      });
    },
  });
}

const byIp: Options["keyGenerator"] = (req) => ipKeyGenerator(req.ip ?? "unknown");

/**
 * POST /api/auth/login and /api/auth/register: per client IP, counted together,
 * so password guessing and mass sign-ups are both slowed down.
 */
export function authRateLimiter(settings: RateLimitSettings = AUTH_RATE_LIMIT): RequestHandler {
  return limiter(settings, byIp);
}

/**
 * For POST /api/monitors/:id/checks (PULSE-92 mounts it after requireAuth).
 * Keyed by the signed-in user, so one account can't flood outbound requests.
 */
export function manualCheckRateLimiter(settings: RateLimitSettings = MANUAL_CHECK_RATE_LIMIT): RequestHandler {
  return limiter(settings, (req, res) => {
    const userId = res.locals.userId as bigint | undefined;
    return userId !== undefined ? `user:${userId.toString()}` : byIp(req, res);
  });
}
