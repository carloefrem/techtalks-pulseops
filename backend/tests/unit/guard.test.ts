import { describe, expect, it } from "vitest";
import { assertConnectedToTestDatabase, assertSafeTestDatabase } from "../setup/guard.js";

const DEV = "postgresql://me:pw@localhost:5432/pulseops_dev";
const TEST = "postgresql://me:pw@localhost:5432/pulseops_test";

describe("assertSafeTestDatabase", () => {
  it("accepts a separate local *_test database", () => {
    expect(assertSafeTestDatabase({ TEST_DATABASE_URL: TEST, DATABASE_URL: DEV })).toBe(TEST);
  });
  it("rejects when TEST_DATABASE_URL is missing", () => {
    expect(() => assertSafeTestDatabase({ DATABASE_URL: DEV })).toThrow(/not set/);
  });
  it("rejects the dev database", () => {
    expect(() => assertSafeTestDatabase({ TEST_DATABASE_URL: DEV, DATABASE_URL: DEV })).toThrow(/_test/);
  });
  it("rejects a name that does not end with _test", () => {
    expect(() => assertSafeTestDatabase({ TEST_DATABASE_URL: "postgresql://me:pw@localhost/pulseops" })).toThrow(/_test/);
  });
  it("rejects a remote host", () => {
    expect(() => assertSafeTestDatabase({ TEST_DATABASE_URL: "postgresql://me:pw@db.example.com/pulseops_test" })).toThrow(/this computer/);
  });
  it("rejects the same database as DATABASE_URL even if named *_test", () => {
    expect(() => assertSafeTestDatabase({ TEST_DATABASE_URL: TEST, DATABASE_URL: "postgresql://x:y@localhost:5432/pulseops_test" })).toThrow(/same database/);
  });
  it("rejects production mode", () => {
    expect(() => assertSafeTestDatabase({ TEST_DATABASE_URL: TEST, NODE_ENV: "production" })).toThrow(/production/);
  });
  it("rejects a non-PostgreSQL URL", () => {
    expect(() => assertSafeTestDatabase({ TEST_DATABASE_URL: "mysql://me:pw@localhost/x_test" })).toThrow(/postgresql/);
  });
});

describe("assertConnectedToTestDatabase", () => {
  it("passes when the server reports the expected database", () => {
    expect(() => assertConnectedToTestDatabase(TEST, "pulseops_test")).not.toThrow();
  });
  it("fails when the server is actually serving another database", () => {
    expect(() => assertConnectedToTestDatabase(TEST, "pulseops_dev")).toThrow(/refusing/);
  });
});
