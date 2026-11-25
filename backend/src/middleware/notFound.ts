import type { RequestHandler } from "express";

/** Unknown routes get the shared JSON error shape instead of Express's HTML page. */
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found", details: [] } });
};
