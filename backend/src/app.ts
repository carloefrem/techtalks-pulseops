import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createAuthRouter, type AuthDeps } from "./modules/auth/auth.routes.js";

export interface AppOptions {
  /** The only browser origin allowed by CORS (the React dev server or deployed frontend). */
  frontendOrigin: string;
  /**
   * Auth routes (R1). server.ts always passes them; a few tests (e.g. health)
   * build the app without them.
   */
  auth?: AuthDeps;
}

/**
 * Builds the Express app without opening a port, so tests can use it directly.
 * server.ts is the only place that calls listen().
 */
export function createApp({ frontendOrigin, auth }: AppOptions) {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: frontendOrigin, credentials: true }));
  app.use(express.json({ limit: "100kb" }));

  app.use("/api", apiRouter);
  if (auth) app.use("/api", createAuthRouter(auth));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
