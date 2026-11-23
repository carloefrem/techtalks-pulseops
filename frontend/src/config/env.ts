/**
 * Frontend configuration, read once (docs/frontend/README.md section 3).
 * VITE_ variables are public: they end up in the built JavaScript.
 */

export const DEFAULT_API_BASE_URL = '/api'

/**
 * Validates VITE_API_BASE_URL: a path starting with "/" or an http(s):// URL, without a trailing slash.
 * An empty or missing value falls back to the default. An invalid value throws, so a typo is obvious.
 */
export function parseApiBaseUrl(raw: string | undefined): string {
  const value = raw?.trim()
  if (!value) return DEFAULT_API_BASE_URL

  const isPath = value.startsWith('/') && !value.startsWith('//')
  const isHttpUrl = /^https?:\/\/[^/\s]+/i.test(value)
  if (!isPath && !isHttpUrl) {
    throw new Error(
      `Invalid VITE_API_BASE_URL "${value}": use a path like "/api" or an http(s):// URL (check frontend/.env.local)`,
    )
  }
  if (value.length > 1 && value.endsWith('/')) {
    throw new Error(`Invalid VITE_API_BASE_URL "${value}": remove the trailing slash`)
  }
  return value
}

export const env = {
  apiBaseUrl: parseApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
} as const
