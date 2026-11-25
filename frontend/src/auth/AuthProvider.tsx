import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as authApi from '../api/auth'
import { ApiError } from '../api/client'
import type { LoginInput, RegisterInput } from '../api/types'
import { AuthContext, type AuthContextValue, type AuthState } from './AuthContext'

/**
 * Loads the current user from GET /api/auth/me on start (PULSE-108) and shares it with the app.
 * Only the user object is kept in memory; no token is stored anywhere (docs/frontend/README.md section 9).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null })
  const controllerRef = useRef<AbortController | null>(null)

  const loadCurrentUser = useCallback(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    authApi.getCurrentUser({ signal: controller.signal }).then(
      (user) => {
        if (controller.signal.aborted) return
        setState(user ? { status: 'authenticated', user } : { status: 'unauthenticated', user: null })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        const apiError =
          error instanceof ApiError ? error : new ApiError(0, 'UNEXPECTED_RESPONSE', 'Could not load your session')
        setState({ status: 'error', user: null, error: apiError })
      },
    )
  }, [])

  useEffect(() => {
    loadCurrentUser()
    return () => controllerRef.current?.abort()
  }, [loadCurrentUser])

  const refresh = useCallback(() => {
    setState({ status: 'loading', user: null })
    loadCurrentUser()
  }, [loadCurrentUser])

  const login = useCallback(async (input: LoginInput) => {
    controllerRef.current?.abort()
    const user = await authApi.login(input)
    setState({ status: 'authenticated', user })
    return user
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    controllerRef.current?.abort()
    const user = await authApi.register(input)
    setState({ status: 'authenticated', user })
    return user
  }, [])

  const logout = useCallback(async () => {
    controllerRef.current?.abort()
    await authApi.logout()
    setState({ status: 'unauthenticated', user: null })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout, refresh }),
    [state, login, register, logout, refresh],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
