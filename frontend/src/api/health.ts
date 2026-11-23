import { ApiError, apiRequest } from './client'
import type { HealthResponse } from './types'

/**
 * The three results the starter page shows (docs/frontend/README.md section 7).
 * GET /api/health is liveness only: "online" means the API process answers, not that PostgreSQL is reachable.
 */
export type HealthResult =
  | { state: 'online' }
  | { state: 'unavailable'; reason: string }
  | { state: 'unexpected'; status: number }

export async function getHealth(options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<HealthResult> {
  try {
    const body = await apiRequest<HealthResponse | undefined>('/health', options)
    if (body?.status === 'ok') return { state: 'online' }
    return { state: 'unexpected', status: 200 }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
      return { state: 'unavailable', reason: error.message }
    }
    // A 5xx that isn't our JSON error shape comes from the dev proxy (or a gateway), not from Express.
    if (error.code === 'UNEXPECTED_RESPONSE' && error.status >= 500) {
      return { state: 'unavailable', reason: `The proxy answered with status ${error.status}` }
    }
    return { state: 'unexpected', status: error.status }
  }
}
