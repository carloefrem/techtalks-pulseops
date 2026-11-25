/**
 * An error the API sends to the client on purpose, in the shared shape from
 * docs/api/README.md section 1:
 *   { "error": { "code", "message", "details": [{ "field", "message" }] } }
 * errorHandler.ts turns it into the JSON response. Anything that is not an
 * ApiError becomes a generic 500 INTERNAL_ERROR.
 */
export interface ErrorDetail {
  field: string;
  message: string;
}

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
