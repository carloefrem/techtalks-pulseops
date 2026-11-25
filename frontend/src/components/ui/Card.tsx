import type { HTMLAttributes } from 'react'

/** White panel with a border and shadow (PULSE-101). */
export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`.trim()} {...props} />
}
