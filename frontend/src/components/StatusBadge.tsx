import type { ReactNode } from 'react'

export type BadgeTone = 'up' | 'down' | 'unknown'

const toneClasses: Record<BadgeTone, string> = {
  up: 'bg-emerald-50 text-emerald-800 ring-emerald-600/30',
  down: 'bg-red-50 text-red-800 ring-red-600/30',
  unknown: 'bg-slate-100 text-slate-700 ring-slate-500/30',
}

const dotClasses: Record<BadgeTone, string> = {
  up: 'bg-emerald-500',
  down: 'bg-red-500',
  unknown: 'bg-slate-400',
}

/** Small coloured status pill. The text carries the meaning; colour is only a hint. */
export function StatusBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ring-1 ring-inset ${toneClasses[tone]}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dotClasses[tone]}`} />
      {children}
    </span>
  )
}
