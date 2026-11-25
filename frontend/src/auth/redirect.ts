import type { Location } from 'react-router-dom'

export const DEFAULT_AFTER_LOGIN = '/dashboard'

/** Where ProtectedRoute stores the page the user tried to open. */
export interface FromState {
  from?: Pick<Location, 'pathname' | 'search' | 'hash'>
}

/**
 * The page to open after login or register: the protected page the user was sent away from,
 * or /dashboard. Only same-app paths are accepted, never another origin.
 */
export function redirectTarget(state: unknown): string {
  const from = (state as FromState | null)?.from
  if (!from || typeof from.pathname !== 'string') return DEFAULT_AFTER_LOGIN
  if (!from.pathname.startsWith('/') || from.pathname.startsWith('//')) return DEFAULT_AFTER_LOGIN
  if (from.pathname === '/login' || from.pathname === '/register') return DEFAULT_AFTER_LOGIN
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
}
