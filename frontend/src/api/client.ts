import { env } from '../config/env'
import type { ApiErrorBody } from './types'

/**
 * The only place that calls fetch (docs/frontend/README.md section 6).
 * Pages and components use the functions in api/*.ts instead.
 */

export const DEFAULT_TIMEOUT_MS = 15_000

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: ApiErrorBody['error']['details']

  constructor(status: number, code: string, message: string, details: ApiErrorBody['error']['details'] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  timeoutMs?: number
  /** Lets a caller cancel the request (e.g. when a component unmounts). */
  signal?: AbortSignal
  baseUrl?: string
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const error = (value as { error: unknown }).error
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  )
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/**
 * Sends a JSON request and returns the parsed 2xx body.
 * Throws ApiError for everything else, never a raw TypeError or DOMException.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS, signal, baseUrl = env.apiBaseUrl } = options

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onCallerAbort = () => controller.abort()
  signal?.addEventListener('abort', onCallerAbort, { once: true })

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (cause) {
    if (timedOut) throw new ApiError(0, 'TIMEOUT', `No response after ${timeoutMs} ms`)
    if (signal?.aborted) throw cause
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the API')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onCallerAbort)
  }

  const data = await readJson(response)
  if (response.ok) return data as T

  if (isApiErrorBody(data)) {
    throw new ApiError(response.status, data.error.code, data.error.message, data.error.details ?? [])
  }
  throw new ApiError(response.status, 'UNEXPECTED_RESPONSE', `Unexpected response (status ${response.status})`)
}
