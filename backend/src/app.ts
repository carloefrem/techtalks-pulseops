import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

export interface AppOptions {
  /** The only browser origin allowed by CORS (the React dev server or deployed frontend). */
  frontendOrigin: string;
}

/**
 * Builds the Express app without opening a port, so tests can use it directly.
 * server.ts is the only place that calls listen().
 */
export function createApp({ frontendOrigin }: AppOptions) {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: frontendOrigin, credentials: true }));
  app.use(express.json({ limit: "100kb" }));

  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
