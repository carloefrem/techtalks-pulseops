import { createContext } from 'react'
import type { ApiError } from '../api/client'
import type { AuthUser, LoginInput, RegisterInput } from '../api/types'

/**
 * - loading: GET /api/auth/me hasn't answered yet
 * - authenticated / unauthenticated: the answer
 * - error: /me failed for another reason (API unavailable), so we don't know yet
 */
export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated'; user: null }
  | { status: 'error'; user: null; error: ApiError }

export type AuthContextValue = AuthState & {
  login: (input: LoginInput) => Promise<AuthUser>
  register: (input: RegisterInput) => Promise<AuthUser>
  logout: () => Promise<void>
  /** Asks GET /api/auth/me again, e.g. after "API unavailable". */
  refresh: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
