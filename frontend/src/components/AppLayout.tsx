import { Activity, LogOut } from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

/**
 * Minimal header with the logout button (PULSE-110). The full app shell, navigation and layout
 * come with PULSE-101 (S2-04), which can replace this component.
 */
export function AppLayout() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    setLogoutFailed(false)
    try {
      await auth.logout()
      navigate('/login', { replace: true })
    } catch {
      // The cookie may still be valid, so stay signed in and say so.
      setLogoutFailed(true)
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900">
            <Activity aria-hidden="true" className="h-5 w-5 text-emerald-600" />
            PulseOps
          </Link>
          {auth.user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden text-slate-600 sm:inline">{auth.user.email}</span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                {loggingOut ? 'Logging out…' : 'Log out'}
              </button>
            </div>
          )}
        </div>
        {logoutFailed && (
          <p role="alert" className="mx-auto max-w-4xl px-4 pb-3 text-sm text-red-700">
            Could not log out because the API is unavailable. Please try again.
          </p>
        )}
      </header>
      <Outlet />
    </>
  )
}
