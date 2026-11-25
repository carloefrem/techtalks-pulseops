import { RefreshCw } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { API_UNAVAILABLE_MESSAGE } from './authErrors'
import type { FromState } from './redirect'
import { useAuth } from './useAuth'

/**
 * Guards every route except /, /login and /register (docs/frontend/README.md section 5, PULSE-110).
 * Uses the GET /api/auth/me result from AuthProvider; a 401 sends the user to /login and remembers
 * where they were going. This is a convenience only: the backend's ownership checks protect the data.
 */
export function ProtectedRoute() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') {
    return (
      <p role="status" className="mx-auto max-w-4xl px-4 py-12 text-slate-600">
        Checking your session…
      </p>
    )
  }

  if (auth.status === 'error') {
    // We don't know if the user is signed in, so don't pretend they're signed out.
    return (
      <div role="alert" className="mx-auto max-w-4xl space-y-3 px-4 py-12 text-slate-700">
        <p>{API_UNAVAILABLE_MESSAGE}</p>
        <button
          type="button"
          onClick={auth.refresh}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Retry
        </button>
      </div>
    )
  }

  if (auth.status === 'unauthenticated') {
    const state: FromState = { from: { pathname: location.pathname, search: location.search, hash: location.hash } }
    return <Navigate to="/login" state={state} replace />
  }

  return <Outlet />
}
