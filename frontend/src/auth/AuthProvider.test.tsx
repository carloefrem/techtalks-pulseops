import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeApi, jsonResponse, testUser, unauthenticated } from '../test/fakeApi'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

function ShowAuth() {
  const auth = useAuth()
  return (
    <p>
      {auth.status}
      {auth.user ? `:${auth.user.email}` : ''}
      {auth.status === 'error' ? `:${auth.error.code}` : ''}
    </p>
  )
}

describe('AuthProvider (PULSE-108)', () => {
  it('loads the signed-in user from GET /api/auth/me on start', async () => {
    const fetchMock = fakeApi({ 'GET /auth/me': jsonResponse(200, { user: testUser }) })
    render(
      <AuthProvider>
        <ShowAuth />
      </AuthProvider>,
    )
    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(await screen.findByText('authenticated:dev@example.com')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' })
  })

  it('is unauthenticated when /me answers 401', async () => {
    fakeApi({ 'GET /auth/me': unauthenticated() })
    render(
      <AuthProvider>
        <ShowAuth />
      </AuthProvider>,
    )
    expect(await screen.findByText('unauthenticated')).toBeInTheDocument()
  })

  it('reports an error (not "signed out") when the API is unavailable', async () => {
    fakeApi({ 'GET /auth/me': new TypeError('Failed to fetch') })
    render(
      <AuthProvider>
        <ShowAuth />
      </AuthProvider>,
    )
    expect(await screen.findByText('error:NETWORK_ERROR')).toBeInTheDocument()
  })

  it('throws a clear error when useAuth is used outside the provider', () => {
    const consoleError = console.error
    console.error = () => {}
    try {
      expect(() => render(<ShowAuth />)).toThrow('useAuth must be used inside <AuthProvider>')
    } finally {
      console.error = consoleError
    }
  })

  it('updates the user after login and clears it after logout', async () => {
    fakeApi({
      'GET /auth/me': unauthenticated(),
      'POST /auth/login': jsonResponse(200, { user: testUser }),
      'POST /auth/logout': new Response(null, { status: 204 }),
    })
    let auth: ReturnType<typeof useAuth> | undefined
    function Capture() {
      auth = useAuth()
      return <ShowAuth />
    }
    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    )
    await screen.findByText('unauthenticated')

    await act(() => auth!.login({ email: 'dev@example.com', password: 'correct-horse' }))
    expect(screen.getByText('authenticated:dev@example.com')).toBeInTheDocument()

    await act(() => auth!.logout())
    expect(screen.getByText('unauthenticated')).toBeInTheDocument()
  })
})
