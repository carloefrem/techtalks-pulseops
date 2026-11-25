import type { z } from "zod";
import { ApiError } from "./apiError.js";

/**
 * Validates input with a Zod schema. On failure it throws
 * 400 VALIDATION_ERROR with one { field, message } entry per problem,
 * matching docs/api/README.md section 1.
 */
export function validate<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const details = result.error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "(body)",
    message: issue.message,
  }));
  const first = details[0];
  const message = first ? `${first.field}: ${first.message}` : "Invalid request";
  throw new ApiError(400, "VALIDATION_ERROR", message, details);
}
