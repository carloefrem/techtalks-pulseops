import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../../src/app.js";
import { MemoryUserRepository } from "../support/memoryUserRepository.js";

/**
 * R1 over real HTTP (PULSE-105, PULSE-106, PULSE-107), using an in-memory user
 * store so it runs with `npm test` on any computer. The Prisma/PostgreSQL side
 * is covered by auth.db.test.ts (`npm run test:db`).
 */
const FRONTEND = "http://localhost:5173";
const SECRET = "integration-test-secret-at-least-32-chars";

let server: Server;
let baseUrl: string;
let users: MemoryUserRepository;

beforeAll(async () => {
  users = new MemoryUserRepository();
  const app = createApp({
    frontendOrigin: FRONTEND,
    auth: { users, session: { jwtSecret: SECRET, secureCookies: false }, bcryptCost: 4 },
  });
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

let counter = 0;
beforeEach(() => {
  counter += 1;
});
const uniqueEmail = () => `dev${counter}@example.com`;

async function post(path: string, body: unknown, cookie?: string) {
  return fetch(`${baseUrl}/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

async function me(cookie?: string) {
  return fetch(`${baseUrl}/api/auth/me`, { headers: cookie ? { cookie } : {} });
}

/** "pulseops_session=<token>" from a Set-Cookie header, ready to send back. */
function sessionCookie(res: Response): string {
  const header = res.headers.get("set-cookie") ?? "";
  const match = /pulseops_session=[^;]*/.exec(header);
  if (!match) throw new Error(`No session cookie in: ${header}`);
  return match[0];
}

describe("POST /api/auth/register (PULSE-105)", () => {
  it("creates the account, returns the public user and signs in", async () => {
    const email = uniqueEmail();
    const res = await post("/auth/register", { email, password: "correct-horse-battery", displayName: "  Dev  " });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      user: { id: expect.stringMatching(/^[1-9][0-9]*$/), email, displayName: "Dev", createdAt: expect.any(String) },
    });
    expect(JSON.stringify(body)).not.toMatch(/password/i);

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/pulseops_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\/api/i);
    expect(setCookie).not.toMatch(/Secure/i); // only in production

    // The cookie works straight away.
    expect((await me(sessionCookie(res))).status).toBe(200);
  });

  it("stores a bcrypt hash, never the password, and lowercases the email", async () => {
    const res = await post("/auth/register", { email: `  MixedCase${counter}@Example.COM `, password: "correct-horse-battery" });
    expect(res.status).toBe(201);
    const stored = users.stored(`mixedcase${counter}@example.com`);
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored?.passwordHash).not.toContain("correct-horse-battery");
    expect(stored?.displayName).toBeNull();
  });

  it("rejects a duplicate email in any case with 409 EMAIL_TAKEN", async () => {
    const email = uniqueEmail();
    expect((await post("/auth/register", { email, password: "correct-horse-battery" })).status).toBe(201);
    const res = await post("/auth/register", { email: email.toUpperCase(), password: "another-password" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: "EMAIL_TAKEN", message: expect.any(String), details: [{ field: "email", message: "is already registered" }] },
    });
  });

  it.each([
    ["missing email", { password: "correct-horse-battery" }, "email"],
    ["invalid email", { email: "not-an-email", password: "correct-horse-battery" }, "email"],
    ["short password", { email: "a@example.com", password: "short" }, "password"],
    ["password over 72 bytes", { email: "a@example.com", password: "é".repeat(40) }, "password"],
    ["empty displayName", { email: "a@example.com", password: "correct-horse-battery", displayName: "   " }, "displayName"],
    ["unknown field", { email: "a@example.com", password: "correct-horse-battery", isAdmin: true }, "(body)"],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_name, body, field) => {
    const res = await post("/auth/register", body);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.details.map((d: { field: string }) => d.field)).toContain(field);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("POST /api/auth/login and /logout (PULSE-106)", () => {
  it("signs in with the right password, in any email case", async () => {
    const email = uniqueEmail();
    await post("/auth/register", { email, password: "correct-horse-battery" });
    const res = await post("/auth/login", { email: email.toUpperCase(), password: "correct-horse-battery" });
    expect(res.status).toBe(200);
    expect((await res.json()).user.email).toBe(email);
    expect((await me(sessionCookie(res))).status).toBe(200);
  });

  it("gives the same 401 INVALID_CREDENTIALS for a wrong password and an unknown email", async () => {
    const email = uniqueEmail();
    await post("/auth/register", { email, password: "correct-horse-battery" });

    const wrongPassword = await post("/auth/login", { email, password: "wrong-password" });
    const unknownEmail = await post("/auth/login", { email: `nobody${counter}@example.com`, password: "wrong-password" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    const a = await wrongPassword.json();
    const b = await unknownEmail.json();
    expect(a).toEqual(b);
    expect(a.error.code).toBe("INVALID_CREDENTIALS");
    expect(wrongPassword.headers.get("set-cookie")).toBeNull();
  });

  it("rejects a malformed login body with 400 VALIDATION_ERROR", async () => {
    const res = await post("/auth/login", { email: "x@example.com" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("logout returns 204 and clears the cookie with the same attributes", async () => {
    const res = await post("/auth/logout", {});
    expect(res.status).toBe(204);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/pulseops_session=;/);
    expect(setCookie).toMatch(/Path=\/api/i);
    expect(setCookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });
});

describe("GET /api/auth/me and requireAuth (PULSE-107)", () => {
  it("returns 401 UNAUTHENTICATED without a cookie", async () => {
    const res = await me();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: "UNAUTHENTICATED", message: expect.any(String), details: [] } });
  });

  it("returns 401 for a forged or foreign token", async () => {
    expect((await me("pulseops_session=not.a.token")).status).toBe(401);

    const email = uniqueEmail();
    const reg = await post("/auth/register", { email, password: "correct-horse-battery" });
    const [h, , s] = sessionCookie(reg).replace("pulseops_session=", "").split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "1", iss: "pulseops-api", aud: "pulseops-web" })).toString("base64url");
    expect((await me(`pulseops_session=${h}.${forged}.${s}`)).status).toBe(401);
  });

  it("returns the signed-in user", async () => {
    const email = uniqueEmail();
    const reg = await post("/auth/register", { email, password: "correct-horse-battery", displayName: "Me" });
    const res = await me(sessionCookie(reg));
    expect(res.status).toBe(200);
    expect((await res.json()).user).toMatchObject({ email, displayName: "Me" });
  });

  it("returns 401 and clears the cookie when the account no longer exists", async () => {
    const email = uniqueEmail();
    const reg = await post("/auth/register", { email, password: "correct-horse-battery" });
    const { user } = await reg.json();
    users.delete(BigInt(user.id));
    const res = await me(sessionCookie(reg));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie") ?? "").toMatch(/pulseops_session=;/);
  });

  it("logout does not affect a later login", async () => {
    const email = uniqueEmail();
    await post("/auth/register", { email, password: "correct-horse-battery" });
    await post("/auth/logout", {});
    const res = await post("/auth/login", { email, password: "correct-horse-battery" });
    expect(res.status).toBe(200);
  });
});
