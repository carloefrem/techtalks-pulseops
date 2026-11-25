import type { RequestHandler } from "express";

/**
 * Unknown routes get the shared JSON error shape instead of Express's HTML page.
 * `ROUTE_NOT_FOUND` (docs/api/README.md §2) is separate from `NOT_FOUND`, which means a resource
 * doesn't exist or belongs to another user, so the frontend can tell a wrong URL from a missing record.
 */
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: "ROUTE_NOT_FOUND", message: "Route not found", details: [] } });
};
