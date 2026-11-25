import type { ErrorRequestHandler } from "express";
import { ApiError } from "../lib/apiError.js";

/**
 * Turns any error into the shared JSON error shape.
 * Express 5 forwards errors from async handlers here automatically.
 * Unexpected errors get a generic message; details are only logged on the server.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  // Errors the API raises on purpose (e.g. 400 UNSAFE_URL) keep their status, code and details.
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  // Malformed JSON body or a body over the size limit (from express.json()).
  const status = typeof err?.status === "number" ? err.status : 500;
  if (status === 400 && err?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "Request body is not valid JSON", details: [] } });
    return;
  }
  if (status === 413) {
    res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large", details: [] } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong", details: [] } });
};
