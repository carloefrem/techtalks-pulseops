import { Router } from "express";

/**
 * GET /api/health → 200 { "status": "ok" }
 * Liveness only: it does not touch the database, so it stays fast and still
 * answers while PostgreSQL is down. Database connectivity has its own check
 * (PULSE-69 / PULSE-73).
 */
export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
