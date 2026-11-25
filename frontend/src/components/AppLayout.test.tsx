import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeApi, jsonResponse, testUser } from '../test/fakeApi'
import { renderApp } from '../test/renderApp'

describe('AppLayout logout button (PULSE-110)', () => {
  it('calls POST /api/auth/logout and returns to /login', async () => {
    const fetchMock = fakeApi({
      'GET /auth/me': jsonResponse(200, { user: testUser }),
      'POST /auth/logout': new Response(null, { status: 204 }),
    })
    const { user } = renderApp('/dashboard')
    expect(await screen.findByText('dev@example.com')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/login')
    expect(fetchMock.mock.calls.some(([url, init]) => url === '/api/auth/logout' && init?.method === 'POST')).toBe(true)
  })

  it('stays signed in and says so when logout fails (API unavailable)', async () => {
    fakeApi({
      'GET /auth/me': jsonResponse(200, { user: testUser }),
      'POST /auth/logout': new TypeError('Failed to fetch'),
    })
    const { user } = renderApp('/dashboard')
    await screen.findByText('dev@example.com')

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not log out')
    expect(screen.getByTestId('current-path')).toHaveTextContent('/dashboard')
  })
})
