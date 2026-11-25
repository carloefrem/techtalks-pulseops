import { vi } from 'vitest'

/**
 * A fake backend for component tests: maps "METHOD /path" to a response.
 * A route set to an Error makes fetch reject (backend not running).
 * Unknown routes fail the test loudly instead of hanging.
 */
export type FakeRoute = Response | Error | (() => Response | Error | Promise<Response>)

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export function errorResponse(status: number, code: string, message = code, details: unknown[] = []): Response {
  return jsonResponse(status, { error: { code, message, details } })
}

export const unauthenticated = () => errorResponse(401, 'UNAUTHENTICATED', 'Sign in to continue')

export const testUser = {
  id: '1',
  email: 'dev@example.com',
  displayName: 'Dev',
  createdAt: '2026-11-20T09:00:00.000Z',
}

export function fakeApi(routes: Record<string, FakeRoute>) {
  const fn = vi.fn<typeof fetch>(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const path = url.replace(/^.*?\/api(?=\/)/, '')
    const key = `${(init?.method ?? 'GET').toUpperCase()} ${path}`
    const route = routes[key]
    if (route === undefined) throw new Error(`fakeApi: no route for ${key}`)
    const result = typeof route === 'function' ? await route() : route
    if (result instanceof Error) throw result
    return result.clone()
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

/** Request body sent to the nth call matching "METHOD /path". */
export function sentBody(fetchMock: ReturnType<typeof fakeApi>, key: string, nth = 0): unknown {
  const [method, path] = key.split(' ')
  const calls = fetchMock.mock.calls.filter(
    ([input, init]) => (init?.method ?? 'GET') === method && String(input).endsWith(`/api${path}`),
  )
  const body = calls[nth]?.[1]?.body
  return typeof body === 'string' ? JSON.parse(body) : undefined
}
