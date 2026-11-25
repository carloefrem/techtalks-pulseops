import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeApi, jsonResponse, unauthenticated } from './test/fakeApi'
import { renderApp } from './test/renderApp'

describe('App routes', () => {
  it('renders the starter page at /', async () => {
    fakeApi({ 'GET /health': jsonResponse(200, { status: 'ok' }), 'GET /auth/me': unauthenticated() })
    renderApp('/')
    expect(screen.getByRole('heading', { name: 'PulseOps' })).toBeInTheDocument()
    expect(await screen.findByText('API: online')).toBeInTheDocument()
  })

  it('renders the not-found page for unknown paths', () => {
    fakeApi({ 'GET /auth/me': unauthenticated() })
    renderApp('/nope')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
