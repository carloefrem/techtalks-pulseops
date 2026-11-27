import { describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env.js";

const valid = {
  FRONTEND_ORIGIN: "http://localhost:5173",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/pulseops_dev",
  JWT_SECRET: "test-secret-that-is-at-least-32-characters-long",
};

describe("loadEnv", () => {
  it("applies defaults for NODE_ENV and PORT", () => {
    const env = loadEnv(valid);
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3001);
  });

  it("reads PORT as a number", () => {
    expect(loadEnv({ ...valid, PORT: "4000" }).PORT).toBe(4000);
  });

  it("fails clearly when FRONTEND_ORIGIN is missing", () => {
    expect(() => loadEnv({ DATABASE_URL: valid.DATABASE_URL })).toThrow(/FRONTEND_ORIGIN/);
  });

  it("rejects a DATABASE_URL that is not PostgreSQL", () => {
    expect(() => loadEnv({ ...valid, DATABASE_URL: "mysql://x" })).toThrow(/DATABASE_URL/);
  });

  it("fails clearly when JWT_SECRET is missing or too short", () => {
    const { JWT_SECRET: _omit, ...withoutSecret } = valid;
    expect(() => loadEnv(withoutSecret)).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ ...valid, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
  });

  it("rejects an invalid PORT", () => {
    expect(() => loadEnv({ ...valid, PORT: "abc" })).toThrow(/PORT/);
  });
});
