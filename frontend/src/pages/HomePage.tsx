import { Activity } from 'lucide-react'
import { ApiStatus } from '../components/ApiStatus'

/** Starter page (PULSE-65): proves the frontend runs and can reach the backend (PULSE-72). */
export function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <header className="flex items-center gap-3">
        <Activity aria-hidden="true" className="h-8 w-8 text-emerald-600" />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">PulseOps</h1>
      </header>
      <p className="mt-3 text-slate-600">
        Uptime monitoring for small teams. Sign-in and monitors arrive in Sprint 2 and 3.
      </p>
      <div className="mt-8">
        <ApiStatus />
      </div>
    </main>
  )
}
