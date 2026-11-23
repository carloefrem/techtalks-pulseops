import { Router } from "express";
import { healthRouter } from "./health.routes.js";

/** Every API route is mounted under /api (see app.ts). */
export const apiRouter = Router();

apiRouter.use(healthRouter);
