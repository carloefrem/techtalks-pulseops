import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeApi, jsonResponse, testUser, unauthenticated } from '../test/fakeApi'
import { renderApp } from '../test/renderApp'

describe('ProtectedRoute (PULSE-110)', () => {
  it('shows the protected page when GET /api/auth/me returns the user', async () => {
    const fetchMock = fakeApi({ 'GET /auth/me': jsonResponse(200, { user: testUser }) })
    renderApp('/dashboard')

    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/me')
  })

  it('redirects to /login on 401, then back to the page after signing in', async () => {
    fakeApi({
      'GET /auth/me': unauthenticated(),
      'POST /auth/login': jsonResponse(200, { user: testUser }),
    })
    const { user } = renderApp('/dashboard')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/login')

    await user.type(screen.getByLabelText('Email'), 'dev@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/dashboard')
  })

  it('shows "API unavailable" with Retry instead of redirecting when /me cannot be reached', async () => {
    let meAvailable = false
    fakeApi({
      'GET /auth/me': () => (meAvailable ? jsonResponse(200, { user: testUser }) : new TypeError('Failed to fetch')),
    })
    const { user } = renderApp('/dashboard')

    expect(await screen.findByRole('alert')).toHaveTextContent('The PulseOps API is unavailable right now.')
    expect(screen.getByTestId('current-path')).toHaveTextContent('/dashboard')

    meAvailable = true
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('keeps / public: no redirect for signed-out users', async () => {
    fakeApi({ 'GET /auth/me': unauthenticated(), 'GET /health': jsonResponse(200, { status: 'ok' }) })
    renderApp('/')
    expect(await screen.findByText('API: online')).toBeInTheDocument()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/')
  })
})
