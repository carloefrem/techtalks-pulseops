import { Activity } from 'lucide-react'
import type { ReactNode } from 'react'

/** Shared frame for /login and /register. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-12">
      <div className="flex items-center gap-2 text-emerald-700">
        <Activity aria-hidden="true" className="h-6 w-6" />
        <span className="font-semibold">PulseOps</span>
      </div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
    </main>
  )
}
