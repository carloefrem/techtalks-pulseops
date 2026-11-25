/** One entry of the `details` array in the shared error shape (docs/api/README.md section 1). */
export interface ErrorDetail {
  field: string;
  message: string;
}

/**
 * An error the API reports to the client as-is, using the shared JSON shape:
 * `{ error: { code, message, details } }`. errorHandler.ts turns it into the response.
 * Anything that is not an ApiError becomes a generic 500.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[];

  constructor(status: number, code: string, message: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
