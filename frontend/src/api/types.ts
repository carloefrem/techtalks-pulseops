/**
 * Types from docs/api/openapi.yaml. Add new ones here as routes are implemented.
 */

/** GET /api/health → 200 */
export interface HealthResponse {
  status: 'ok'
}

/** Shared error body (docs/api/README.md section 1). */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details: Array<{ field?: string; message: string }>
  }
}

/**
 * Frontend-only codes, never sent by the backend:
 * - NETWORK_ERROR: no HTTP response at all (backend not running, connection refused)
 * - TIMEOUT: no response before the client timeout
 * - UNEXPECTED_RESPONSE: a response that is not our JSON shape (e.g. a proxy error page)
 */
export type ClientErrorCode = 'NETWORK_ERROR' | 'TIMEOUT' | 'UNEXPECTED_RESPONSE'
