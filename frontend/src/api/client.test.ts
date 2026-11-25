import { describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest, parseRetryAfter } from './client'

describe('apiRequest (docs/frontend/README.md section 6)', () => {
  it('turns our JSON error shape into ApiError with code and details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: 'VALIDATION_ERROR', message: 'bad url', details: [{ field: 'url', message: 'bad' }] },
          }),
          { status: 400 },
        ),
      ),
    )

    const error = await apiRequest('/monitors', { baseUrl: '/api' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', details: [{ field: 'url', message: 'bad' }] })
  })

  it('turns a connection failure into NETWORK_ERROR with status 0', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(apiRequest('/health', { baseUrl: '/api' })).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })

  it('gives up after the timeout with TIMEOUT', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
          }),
      ),
    )
    await expect(apiRequest('/health', { baseUrl: '/api', timeoutMs: 20 })).rejects.toMatchObject({
      status: 0,
      code: 'TIMEOUT',
    })
  })

  it('sends JSON bodies with credentials', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/auth/login', { baseUrl: '/api', method: 'POST', body: { email: 'a@b.c' } })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', body: '{"email":"a@b.c"}' })
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })
})

describe('Retry-After (PULSE-88, Carlo review on PR #12)', () => {
  it('keeps Retry-After seconds on a 429 RATE_LIMITED error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests', details: [] } }), {
          status: 429,
          headers: { 'Retry-After': '840' },
        }),
      ),
    )
    await expect(apiRequest('/auth/login', { baseUrl: '/api', method: 'POST', body: {} })).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      retryAfterSeconds: 840,
    })
  })

  it('parses delay-seconds and HTTP dates, and ignores junk', () => {
    const now = Date.parse('2026-11-25T18:00:00Z')
    expect(parseRetryAfter('120', now)).toBe(120)
    expect(parseRetryAfter('Wed, 25 Nov 2026 18:02:00 GMT', now)).toBe(120)
    expect(parseRetryAfter('Wed, 25 Nov 2026 17:00:00 GMT', now)).toBe(0)
    expect(parseRetryAfter('soon', now)).toBeUndefined()
    expect(parseRetryAfter(null, now)).toBeUndefined()
  })
})
