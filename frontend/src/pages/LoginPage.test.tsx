import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { errorResponse, fakeApi, jsonResponse, sentBody, testUser, unauthenticated } from '../test/fakeApi'
import { renderApp } from '../test/renderApp'

async function fillAndSubmit(user: ReturnType<typeof renderApp>['user'], email: string, password: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('LoginPage (PULSE-109 / PULSE-110)', () => {
  it('signs in and redirects to /dashboard on success', async () => {
    const fetchMock = fakeApi({
      'GET /auth/me': unauthenticated(),
      'POST /auth/login': jsonResponse(200, { user: testUser }),
    })
    const { user } = renderApp('/login')

    await fillAndSubmit(user, '  dev@example.com ', 'correct-horse')

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/dashboard')
    expect(sentBody(fetchMock, 'POST /auth/login')).toEqual({ email: 'dev@example.com', password: 'correct-horse' })
  })

  it('shows one message for wrong credentials (INVALID_CREDENTIALS) and stays on /login', async () => {
    fakeApi({
      'GET /auth/me': unauthenticated(),
      'POST /auth/login': errorResponse(401, 'INVALID_CREDENTIALS', 'Email or password is wrong'),
    })
    const { user } = renderApp('/login')

    await fillAndSubmit(user, 'dev@example.com', 'wrong-password')

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
    expect(screen.getByTestId('current-path')).toHaveTextContent('/login')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('shows "API unavailable" when the backend cannot be reached', async () => {
    fakeApi({
      'GET /auth/me': new TypeError('Failed to fetch'),
      'POST /auth/login': new TypeError('Failed to fetch'),
    })
    const { user } = renderApp('/login')

    await fillAndSubmit(user, 'dev@example.com', 'correct-horse')

    expect(await screen.findByRole('alert')).toHaveTextContent('The PulseOps API is unavailable right now.')
    expect(screen.getByTestId('current-path')).toHaveTextContent('/login')
  })

  it('shows field messages from VALIDATION_ERROR details', async () => {
    fakeApi({
      'GET /auth/me': unauthenticated(),
      'POST /auth/login': errorResponse(400, 'VALIDATION_ERROR', 'Invalid input', [
        { field: 'email', message: 'must be a valid email' },
      ]),
    })
    const { user } = renderApp('/login')

    await fillAndSubmit(user, 'dev@example.com', 'correct-horse')

    expect(await screen.findByText('must be a valid email')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('checks empty fields before calling the API', async () => {
    const fetchMock = fakeApi({ 'GET /auth/me': unauthenticated() })
    const { user } = renderApp('/login')
    await screen.findByRole('button', { name: 'Sign in' })

    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByText('Enter your email.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('sends an already signed-in user straight to /dashboard', async () => {
    fakeApi({ 'GET /auth/me': jsonResponse(200, { user: testUser }) })
    renderApp('/login')
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
  })
})

describe('LoginPage rate limit (PULSE-88)', () => {
  it('shows how long to wait when the API answers 429 with Retry-After', async () => {
    fakeApi({
      'GET /auth/me': unauthenticated(),
      'POST /auth/login': () =>
        new Response(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests', details: [] } }), {
          status: 429,
          headers: { 'Retry-After': '840' },
        }),
    })
    const { user } = renderApp('/login')

    await fillAndSubmit(user, 'dev@example.com', 'correct-horse')

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Try again in 14 minutes.')
  })
})
