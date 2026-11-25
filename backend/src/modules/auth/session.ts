import type { CookieOptions, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";

/**
 * Session decision (PULSE-87): a stateless JWT (HS256) stored in an HttpOnly
 * cookie. The browser never sees the token in JavaScript, and the API needs
 * no session table. Cookie rules come from docs/api/README.md section 3.
 */
export const SESSION_COOKIE = "pulseops_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const ISSUER = "pulseops-api";
const AUDIENCE = "pulseops-web";

export interface SessionConfig {
  /** At least 32 characters; from JWT_SECRET. */
  jwtSecret: string;
  /** Adds the Secure flag. True in production (HTTPS only). */
  secureCookies: boolean;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

function cookieOptions(config: SessionConfig): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: config.secureCookies, path: "/api" };
}

export async function createSessionToken(userId: bigint, config: SessionConfig): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId.toString())
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key(config.jwtSecret));
}

/** Returns the user ID inside a valid, unexpired token, or null for anything else. */
export async function readSessionToken(token: string, config: SessionConfig): Promise<bigint | null> {
  try {
    const { payload } = await jwtVerify(token, key(config.jwtSecret), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return typeof payload.sub === "string" && /^[1-9][0-9]*$/.test(payload.sub) ? BigInt(payload.sub) : null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(res: Response, userId: bigint, config: SessionConfig): Promise<void> {
  const token = await createSessionToken(userId, config);
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(config), maxAge: SESSION_TTL_SECONDS * 1000 });
}

export function clearSessionCookie(res: Response, config: SessionConfig): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions(config));
}

/** Reads one cookie from the Cookie header without an extra dependency. */
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}
