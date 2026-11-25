import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { buttonClasses } from '../components/ui/buttonStyles'

/** 404 for unknown routes (PULSE-101). Public, so it works signed in or out. */
export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Card>
        <p className="text-sm font-semibold text-emerald-700">404</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Page not found</h1>
        <p className="mt-2 text-slate-600">This page doesn't exist. Check the address, or go back to a page you know.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/dashboard" className={buttonClasses('primary', 'sm')}>
            Go to the dashboard
          </Link>
          <Link to="/" className={buttonClasses('secondary', 'sm')}>
            Back to the start page
          </Link>
        </div>
      </Card>
    </main>
  )
}
