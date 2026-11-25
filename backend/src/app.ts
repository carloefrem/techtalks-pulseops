import express from "express";
import { apiRouter } from "./routes/index.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRateLimiter, securityHeaders, strictCors, type RateLimitSettings } from "./middleware/security.js";
import { createAuthRouter, type AuthDeps } from "./modules/auth/auth.routes.js";

/** JSON bodies above this size get 413 PAYLOAD_TOO_LARGE. */
export const JSON_BODY_LIMIT = "100kb";

export interface AppOptions {
  /** The only browser origin allowed by CORS (the React dev server or deployed frontend). */
  frontendOrigin: string;
  /**
   * Auth routes (R1). server.ts always passes them; a few tests (e.g. health)
   * build the app without them.
   */
  auth?: AuthDeps;
  /** Overrides the login/register rate limit (tests use a small one). */
  authRateLimit?: RateLimitSettings;
  /**
   * Number of reverse proxies in front of the API (TRUST_PROXY). Needed in
   * deployment so rate limits see the real client IP, not the proxy's.
   */
  trustProxy?: number;
}

/**
 * Builds the Express app without opening a port, so tests can use it directly.
 * server.ts is the only place that calls listen().
 */
export function createApp({ frontendOrigin, auth, authRateLimit, trustProxy = 0 }: AppOptions) {
  const app = express();

  app.disable("x-powered-by");
  if (trustProxy > 0) app.set("trust proxy", trustProxy);
  app.use(securityHeaders());
  app.use(strictCors(frontendOrigin));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use("/api", apiRouter);
  if (auth) {
    const limitAuth = authRateLimiter(authRateLimit);
    app.use(["/api/auth/login", "/api/auth/register"], limitAuth);
    app.use("/api", createAuthRouter(auth));
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
