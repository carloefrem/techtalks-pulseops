import { useAuth } from '../auth/useAuth'

/** /dashboard placeholder until the monitor list arrives (PULSE-91, Sprint 3). */
export function DashboardPage() {
  const { user } = useAuth()
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
      <p className="mt-2 text-slate-600">
        Signed in as <span className="font-medium text-slate-900">{user?.displayName ?? user?.email}</span>.
      </p>
      <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Your monitors will appear here in Sprint 3.
      </p>
    </main>
  )
}
