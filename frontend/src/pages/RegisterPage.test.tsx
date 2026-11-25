import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { errorResponse, fakeApi, jsonResponse, sentBody, testUser, unauthenticated } from '../test/fakeApi'
import { renderApp } from '../test/renderApp'

type User = ReturnType<typeof renderApp>['user']

async function fill(user: User, fields: { name?: string; email?: string; password?: string }) {
  if (fields.name) await user.type(screen.getByLabelText('Name (optional)'), fields.name)
  if (fields.email) await user.type(screen.getByLabelText('Email'), fields.email)
  if (fields.password) await user.type(screen.getByLabelText('Password'), fields.password)
  await user.click(screen.getByRole('button', { name: 'Create account' }))
}

describe('RegisterPage (PULSE-109)', () => {
  it('creates the account and redirects to /dashboard', async () => {
    const fetchMock = fakeApi({
      'GET /auth/me': unauthenticated(),
      'POST /auth/register': jsonResponse(201, { user: testUser }),
    })
    const { user } = renderApp('/register')

    await fill(user, { name: ' Dev ', email: 'dev@example.com', password: 'correct-horse' })

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(sentBody(fetchMock, 'POST /auth/register')).toEqual({
      email: 'dev@example.com',
      password: 'correct-horse',
      displayName: 'Dev',
    })
  })

  it('leaves displayName out when the name is empty (the backend rejects unknown or empty fields)', async () => {
    const fetchMock = fakeApi({
      'GET /auth/me': unauthenticated(),
      'POST /auth/register': jsonResponse(201, { user: { ...testUser, displayName: null } }),
    })
    const { user } = renderApp('/register')

    await fill(user, { email: 'dev@example.com', password: 'correct-horse' })

    await screen.findByRole('heading', { name: 'Dashboard' })
    expect(sentBody(fetchMock, 'POST /auth/register')).toEqual({ email: 'dev@example.com', password: 'correct-horse' })
  })

  it('shows the duplicate email message for EMAIL_TAKEN with a link to sign in', async () => {
    fakeApi({
      'GET /auth/me': unauthenticated(),
      'POST /auth/register': errorResponse(409, 'EMAIL_TAKEN', 'Email already registered'),
    })
    const { user } = renderApp('/register')

    await fill(user, { email: 'dev@example.com', password: 'correct-horse' })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('An account with this email already exists.')
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByTestId('current-path')).toHaveTextContent('/register')
  })

  it('shows field messages from VALIDATION_ERROR details', async () => {
    fakeApi({
      'GET /auth/me': unauthenticated(),
      'POST /auth/register': errorResponse(400, 'VALIDATION_ERROR', 'Invalid input', [
        { field: 'password', message: 'password must be 8 to 72 characters' },
      ]),
    })
    const { user } = renderApp('/register')

    await fill(user, { email: 'dev@example.com', password: 'correct-horse' })

    expect(await screen.findByText('password must be 8 to 72 characters')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Please fix the highlighted fields.')
  })

  it('checks email format and password length (8–72) before calling the API', async () => {
    const fetchMock = fakeApi({ 'GET /auth/me': unauthenticated() })
    const { user } = renderApp('/register')
    await screen.findByRole('button', { name: 'Create account' })

    await fill(user, { email: 'not-an-email', password: 'short' })

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('shows "API unavailable" when the dev proxy answers 502 (backend not running)', async () => {
    fakeApi({
      'GET /auth/me': unauthenticated(),
      'POST /auth/register': new Response('Bad gateway', { status: 502 }),
    })
    const { user } = renderApp('/register')

    await fill(user, { email: 'dev@example.com', password: 'correct-horse' })

    expect(await screen.findByRole('alert')).toHaveTextContent('The PulseOps API is unavailable right now.')
  })
})
