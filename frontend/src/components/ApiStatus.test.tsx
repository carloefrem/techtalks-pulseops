import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiStatus } from './ApiStatus'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function mockFetch(...responses: Array<Response | Error>) {
  const fn = vi.fn<typeof fetch>()
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r)
    else fn.mockResolvedValueOnce(r)
  }
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('ApiStatus (docs/frontend/README.md section 7)', () => {
  it('shows "Checking API…" while the request is in progress', () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => new Promise(() => {})))
    render(<ApiStatus apiBaseUrl="/api" />)
    expect(screen.getByText('Checking API…')).toBeInTheDocument()
  })

  it('shows "API: online" for 200 { status: "ok" } and calls /api/health with credentials', async () => {
    const fetchMock = mockFetch(jsonResponse(200, { status: 'ok' }))
    render(<ApiStatus apiBaseUrl="/api" />)

    expect(await screen.findByText('API: online')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/health')
    expect(init?.credentials).toBe('include')
  })

  it('shows "API: unavailable", the base URL and Retry when the backend is not reachable', async () => {
    mockFetch(new TypeError('Failed to fetch'))
    render(<ApiStatus apiBaseUrl="/api" />)

    expect(await screen.findByText('API: unavailable')).toBeInTheDocument()
    expect(screen.getByText('/api')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.queryByText(/TypeError|Failed to fetch/)).not.toBeInTheDocument()
  })

  it('treats a 5xx without our JSON error shape (dev proxy) as unavailable', async () => {
    mockFetch(new Response('', { status: 500 }))
    render(<ApiStatus apiBaseUrl="/api" />)
    expect(await screen.findByText('API: unavailable')).toBeInTheDocument()
  })

  it('shows "unexpected response (status N)" for other statuses or bodies', async () => {
    mockFetch(jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Not found', details: [] } }))
    render(<ApiStatus apiBaseUrl="/api" />)
    expect(await screen.findByText('API: unexpected response (status 404)')).toBeInTheDocument()
  })

  it('treats a 200 with the wrong body as unexpected', async () => {
    mockFetch(jsonResponse(200, { status: 'starting' }))
    render(<ApiStatus apiBaseUrl="/api" />)
    expect(await screen.findByText('API: unexpected response (status 200)')).toBeInTheDocument()
  })

  it('Retry checks again and shows online once the backend is up', async () => {
    const fetchMock = mockFetch(new TypeError('Failed to fetch'), jsonResponse(200, { status: 'ok' }))
    render(<ApiStatus apiBaseUrl="/api" />)

    await userEvent.click(await screen.findByRole('button', { name: /retry/i }))

    expect(await screen.findByText('API: online')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
