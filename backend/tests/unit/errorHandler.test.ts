import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { ApiError } from "../../src/lib/apiError.js";
import { UnsafeUrlError } from "../../src/monitoring/urlPolicy.js";

function run(err: unknown) {
  const res = { headersSent: false, status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  const next = vi.fn();
  errorHandler(err, {} as Request, res as unknown as Response, next);
  return { status: res.status.mock.calls[0]?.[0], body: res.json.mock.calls[0]?.[0], next };
}

describe("errorHandler", () => {
  it("sends an ApiError with its own status, code and details", () => {
    const { status, body } = run(new ApiError(409, "DUPLICATE_MONITOR_URL", "Already monitored", []));
    expect(status).toBe(409);
    expect(body).toEqual({ error: { code: "DUPLICATE_MONITOR_URL", message: "Already monitored", details: [] } });
  });

  it("sends UnsafeUrlError as 400 UNSAFE_URL", () => {
    const { status, body } = run(new UnsafeUrlError("BLOCKED_ADDRESS", "URL points to a private address"));
    expect(status).toBe(400);
    expect(body.error.code).toBe("UNSAFE_URL");
    expect(body.error.details).toEqual([{ field: "url", message: "URL points to a private address" }]);
  });

  it("still hides unexpected errors behind 500 INTERNAL_ERROR", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = run(new Error("db password is hunter2"));
    expect(status).toBe(500);
    expect(body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Something went wrong", details: [] } });
    spy.mockRestore();
  });
});
