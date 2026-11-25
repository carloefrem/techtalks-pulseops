import { ApiError, apiRequest } from './client'
import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from './types'

/**
 * Auth routes (docs/api/README.md sections 3 and 5.2, implemented in PULSE-87).
 * The session lives only in the HttpOnly `pulseops_session` cookie: apiRequest sends it with
 * `credentials: "include"`, and nothing here reads or stores a token.
 */

type CallOptions = { signal?: AbortSignal }

export async function register(input: RegisterInput, options: CallOptions = {}): Promise<AuthUser> {
  const body = await apiRequest<AuthResponse>('/auth/register', { ...options, method: 'POST', body: input })
  return body.user
}

export async function login(input: LoginInput, options: CallOptions = {}): Promise<AuthUser> {
  const body = await apiRequest<AuthResponse>('/auth/login', { ...options, method: 'POST', body: input })
  return body.user
}

/** POST /api/auth/logout → 204. The backend clears the cookie. */
export async function logout(options: CallOptions = {}): Promise<void> {
  await apiRequest<undefined>('/auth/logout', { ...options, method: 'POST' })
}

/**
 * GET /api/auth/me. Returns null when there is no valid session (401), so callers can tell
 * "signed out" apart from "API unavailable", which still throws an ApiError.
 */
export async function getCurrentUser(options: CallOptions = {}): Promise<AuthUser | null> {
  try {
    const body = await apiRequest<AuthResponse>('/auth/me', options)
    return body.user
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}
