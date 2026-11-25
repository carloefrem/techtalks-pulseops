import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../../src/app.js";

const FRONTEND = "http://localhost:5173";
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = createApp({ frontendOrigin: FRONTEND });
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s)); // port 0 = any free port
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("GET /api/health", () => {
  it("returns 200 with { status: 'ok' }", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("allows the configured frontend origin (CORS)", async () => {
    const res = await fetch(`${baseUrl}/api/health`, { headers: { Origin: FRONTEND } });
    expect(res.headers.get("access-control-allow-origin")).toBe(FRONTEND);
  });

  it("does not allow other origins", async () => {
    const res = await fetch(`${baseUrl}/api/health`, { headers: { Origin: "http://evil.test" } });
    expect(res.headers.get("access-control-allow-origin")).not.toBe("http://evil.test");
  });

  it("does not reveal the framework", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.headers.get("x-powered-by")).toBeNull();
  });
});

describe("errors use the shared JSON shape", () => {
  it("unknown route → 404 ROUTE_NOT_FOUND (docs/api/README.md §2)", async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ error: { code: "ROUTE_NOT_FOUND", message: "Route not found", details: [] } });
  });

  it("unknown method on a known path → 404 ROUTE_NOT_FOUND, not NOT_FOUND", async () => {
    const res = await fetch(`${baseUrl}/api/health`, { method: "DELETE" });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("path outside /api → 404 ROUTE_NOT_FOUND as JSON", async () => {
    const res = await fetch(`${baseUrl}/nope`);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("malformed JSON body → 400 INVALID_JSON", async () => {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_JSON");
  });
});
