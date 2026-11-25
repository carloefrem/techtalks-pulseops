import { Activity, LogOut } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { NAV_ITEMS } from './navigation'
import { Button } from './ui/Button'

/**
 * App shell for signed-in pages (PULSE-101): header with the app name, main navigation and the
 * logout button (PULSE-110), then the page in <main>.
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
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900">
            <Activity aria-hidden="true" className="h-5 w-5 text-emerald-600" />
            PulseOps
          </Link>

          <nav aria-label="Main" className="order-last w-full sm:order-none sm:w-auto">
            <ul className="flex gap-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                        isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`
                    }
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {auth.user && (
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="hidden text-slate-600 md:inline">{auth.user.email}</span>
              <Button variant="secondary" size="sm" onClick={handleLogout} disabled={loggingOut}>
                <LogOut aria-hidden="true" className="h-4 w-4" />
                {loggingOut ? 'Logging out…' : 'Log out'}
              </Button>
            </div>
          )}
        </div>
        {logoutFailed && (
          <p role="alert" className="mx-auto max-w-5xl px-4 pb-3 text-sm text-red-700">
            Could not log out because the API is unavailable. Please try again.
          </p>
        )}
      </header>
      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
