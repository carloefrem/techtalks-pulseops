import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { SignJWT } from "jose";
import { createSessionToken, readCookie, readSessionToken } from "../../src/modules/auth/session.js";

const config = { jwtSecret: "unit-test-secret-that-is-at-least-32-chars", secureCookies: false };

describe("session token (PULSE-106/107)", () => {
  it("round-trips the user id", async () => {
    const token = await createSessionToken(42n, config);
    expect(await readSessionToken(token, config)).toBe(42n);
  });

  it("rejects a token signed with another secret", async () => {
    const token = await createSessionToken(42n, { ...config, jwtSecret: "a-different-secret-of-32-characters!!" });
    expect(await readSessionToken(token, config)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken(42n, config);
    const [h, , s] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "1" })).toString("base64url");
    expect(await readSessionToken(`${h}.${forgedPayload}.${s}`, config)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const key = new TextEncoder().encode(config.jwtSecret);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("42")
      .setIssuer("pulseops-api")
      .setAudience("pulseops-web")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(key);
    expect(await readSessionToken(token, config)).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await readSessionToken("not-a-jwt", config)).toBeNull();
  });
});

describe("readCookie", () => {
  const req = (cookie?: string) => ({ headers: cookie === undefined ? {} : { cookie } }) as Request;

  it("finds the named cookie among others", () => {
    expect(readCookie(req("a=1; pulseops_session=abc.def; b=2"), "pulseops_session")).toBe("abc.def");
  });

  it("returns null when missing or malformed", () => {
    expect(readCookie(req(), "pulseops_session")).toBeNull();
    expect(readCookie(req("other=1"), "pulseops_session")).toBeNull();
    expect(readCookie(req("pulseops_session=%E0%A4%A"), "pulseops_session")).toBeNull();
  });
});
