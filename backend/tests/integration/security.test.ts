import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../../src/app.js";
import { manualCheckRateLimiter } from "../../src/middleware/security.js";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { MemoryUserRepository } from "../support/memoryUserRepository.js";

/** PULSE-111: security headers, strict CORS, body size limit and rate limiting. */
const FRONTEND = "http://localhost:5173";

async function listen(app: express.Express): Promise<{ server: Server; url: string }> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = createApp({
    frontendOrigin: FRONTEND,
    auth: {
      users: new MemoryUserRepository(),
      session: { jwtSecret: "security-test-secret-at-least-32-chars!", secureCookies: false },
      bcryptCost: 4,
    },
    authRateLimit: { windowMs: 60_000, max: 3 },
  });
  ({ server, url: baseUrl } = await listen(app));
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const login = (body: unknown = { email: "x@example.com", password: "wrong-password" }) =>
  fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("security headers (helmet)", () => {
  it("sends safe headers and hides the framework", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toMatch(/default-src 'none'/);
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("strict-transport-security")).toMatch(/max-age=/);
    expect(res.headers.get("x-powered-by")).toBeNull();
  });
});

describe("strict CORS", () => {
  it("allows only FRONTEND_ORIGIN, with credentials", async () => {
    const ok = await fetch(`${baseUrl}/api/health`, { headers: { Origin: FRONTEND } });
    expect(ok.headers.get("access-control-allow-origin")).toBe(FRONTEND);
    expect(ok.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("sends no CORS headers to any other origin", async () => {
    const res = await fetch(`${baseUrl}/api/health`, { headers: { Origin: "http://evil.test" } });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("refuses preflight from other origins", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "OPTIONS",
      headers: { Origin: "http://evil.test", "Access-Control-Request-Method": "POST" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("JSON body size limit", () => {
  it("rejects bodies over 100kb with 413 PAYLOAD_TOO_LARGE", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@example.com", password: "x".repeat(120_000) }),
    });
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("auth rate limiting", () => {
  it("returns 429 RATE_LIMITED with Retry-After once the limit is reached", async () => {
    // Limit is 3 for login + register together in this app.
    for (let i = 0; i < 3; i += 1) expect((await login()).status).toBe(401);

    const blocked = await login();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(await blocked.json()).toEqual({
      error: { code: "RATE_LIMITED", message: expect.any(String), details: [] },
    });

    // Register shares the same budget.
    const register = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", password: "correct-horse-battery" }),
    });
    expect(register.status).toBe(429);
  });

  it("does not rate-limit other routes", async () => {
    expect((await fetch(`${baseUrl}/api/health`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/auth/me`)).status).toBe(401);
  });
});

describe("manual check rate limiter (for PULSE-92)", () => {
  it("limits per signed-in user, not per IP", async () => {
    const app = express();
    app.use((req, res, next) => {
      res.locals.userId = BigInt(req.header("x-user") ?? "1");
      next();
    });
    app.post("/check", manualCheckRateLimiter({ windowMs: 60_000, max: 2 }), (_req, res) => {
      res.status(201).json({ ok: true });
    });
    app.use(errorHandler);
    const { server: s, url } = await listen(app);
    try {
      const hit = (user: string) => fetch(`${url}/check`, { method: "POST", headers: { "x-user": user } });
      expect((await hit("1")).status).toBe(201);
      expect((await hit("1")).status).toBe(201);
      const third = await hit("1");
      expect(third.status).toBe(429);
      expect((await third.json()).error.code).toBe("RATE_LIMITED");
      // Another user from the same IP still has their own budget.
      expect((await hit("2")).status).toBe(201);
    } finally {
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
  });
});
