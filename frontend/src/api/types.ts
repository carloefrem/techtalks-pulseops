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

/** The signed-in user (docs/api/README.md section 5.2). Never contains password_hash. IDs are strings. */
export interface AuthUser {
  id: string
  email: string
  displayName: string | null
  createdAt: string
}

/** POST /api/auth/register → 201, POST /api/auth/login → 200, GET /api/auth/me → 200 */
export interface AuthResponse {
  user: AuthUser
}

/** POST /api/auth/register body. Unknown fields are rejected by the backend (Zod .strict()). */
export interface RegisterInput {
  email: string
  password: string
  displayName?: string
}

/** POST /api/auth/login body. */
export interface LoginInput {
  email: string
  password: string
}
