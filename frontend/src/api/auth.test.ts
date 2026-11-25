import { describe, expect, it } from 'vitest'
import { errorResponse, fakeApi, jsonResponse, sentBody, testUser, unauthenticated } from '../test/fakeApi'
import { getCurrentUser, login, logout, register } from './auth'
import { ApiError } from './client'

describe('api/auth (docs/api/README.md section 5.2)', () => {
  it('logs in with POST /api/auth/login, credentials included, and returns the user', async () => {
    const fetchMock = fakeApi({ 'POST /auth/login': jsonResponse(200, { user: testUser }) })

    await expect(login({ email: 'dev@example.com', password: 'correct-horse' })).resolves.toEqual(testUser)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(sentBody(fetchMock, 'POST /auth/login')).toEqual({ email: 'dev@example.com', password: 'correct-horse' })
  })

  it('registers with POST /api/auth/register and returns the user', async () => {
    const fetchMock = fakeApi({ 'POST /auth/register': jsonResponse(201, { user: testUser }) })
    const input = { email: 'dev@example.com', password: 'correct-horse', displayName: 'Dev' }

    await expect(register(input)).resolves.toEqual(testUser)
    expect(sentBody(fetchMock, 'POST /auth/register')).toEqual(input)
  })

  it('passes the API error code through (INVALID_CREDENTIALS)', async () => {
    fakeApi({ 'POST /auth/login': errorResponse(401, 'INVALID_CREDENTIALS', 'Email or password is wrong') })
    const error = await login({ email: 'dev@example.com', password: 'nope-nope' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })
  })

  it('logs out with POST /api/auth/logout (204, no body)', async () => {
    const fetchMock = fakeApi({ 'POST /auth/logout': new Response(null, { status: 204 }) })
    await expect(logout()).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include' })
  })

  it('getCurrentUser returns the user, or null on 401', async () => {
    fakeApi({ 'GET /auth/me': jsonResponse(200, { user: testUser }) })
    await expect(getCurrentUser()).resolves.toEqual(testUser)

    fakeApi({ 'GET /auth/me': unauthenticated() })
    await expect(getCurrentUser()).resolves.toBeNull()
  })

  it('getCurrentUser still throws when the API is unavailable', async () => {
    fakeApi({ 'GET /auth/me': new TypeError('Failed to fetch') })
    await expect(getCurrentUser()).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })

  it('never stores anything in localStorage or sessionStorage', async () => {
    fakeApi({
      'POST /auth/login': jsonResponse(200, { user: testUser }),
      'GET /auth/me': jsonResponse(200, { user: testUser }),
    })
    await login({ email: 'dev@example.com', password: 'correct-horse' })
    await getCurrentUser()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})
