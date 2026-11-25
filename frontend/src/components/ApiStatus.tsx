import { RefreshCw } from 'lucide-react'
import { Button } from './ui/Button'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getHealth, type HealthResult } from '../api/health'
import { env } from '../config/env'
import { StatusBadge } from './StatusBadge'

type ViewState = { state: 'checking' } | HealthResult

/** Shows the GET /api/health result, or the unavailable state with a Retry button (PULSE-72). */
export function ApiStatus({ apiBaseUrl = env.apiBaseUrl }: { apiBaseUrl?: string }) {
  const [view, setView] = useState<ViewState>({ state: 'checking' })
  const controllerRef = useRef<AbortController | null>(null)

  // Starts a request and stores its result. State starts as "checking", so the first run doesn't reset it.
  const runCheck = useCallback(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    getHealth({ signal: controller.signal }).then(
      (result) => {
        if (!controller.signal.aborted) setView(result)
      },
      () => {
        // Only a caller abort (unmount or a newer Retry) gets here; nothing to show.
      },
    )
  }, [])

  const retry = () => {
    setView({ state: 'checking' })
    runCheck()
  }

  useEffect(() => {
    runCheck()
    return () => controllerRef.current?.abort()
  }, [runCheck])

  return (
    <section aria-labelledby="api-status-heading" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 id="api-status-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Backend status
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-3" role="status" aria-live="polite">
        {view.state === 'checking' && <StatusBadge tone="unknown">Checking API…</StatusBadge>}
        {view.state === 'online' && <StatusBadge tone="up">API: online</StatusBadge>}
        {view.state === 'unavailable' && <StatusBadge tone="down">API: unavailable</StatusBadge>}
        {view.state === 'unexpected' && (
          <StatusBadge tone="down">API: unexpected response (status {view.status})</StatusBadge>
        )}
      </div>

      {view.state === 'online' && (
        <p className="mt-3 text-sm text-slate-600">
          The API process is running. This check does not test the database.
        </p>
      )}

      {(view.state === 'unavailable' || view.state === 'unexpected') && (
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          {view.state === 'unavailable' && <p>{view.reason}. Is the backend running?</p>}
          <p>
            API base URL: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-800">{apiBaseUrl}</code>
          </p>
          <Button size="sm" onClick={retry}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Retry
          </Button>
        </div>
      )}
    </section>
  )
}
