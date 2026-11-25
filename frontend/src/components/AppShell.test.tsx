import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fakeApi, jsonResponse, testUser, unauthenticated } from '../test/fakeApi'
import { renderApp } from '../test/renderApp'

const signedIn = () => fakeApi({ 'GET /auth/me': jsonResponse(200, { user: testUser }) })

describe('App shell (PULSE-101)', () => {
  it('renders the header with the app name, main navigation and the logout button', async () => {
    signedIn()
    renderApp('/dashboard')

    const nav = await screen.findByRole('navigation', { name: 'Main' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['Dashboard', 'Monitors', 'Incidents'])
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'PulseOps' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: 'Dashboard', level: 1 }))
  })

  it('navigates between sections and marks the current one', async () => {
    signedIn()
    const { user } = renderApp('/dashboard')
    const nav = await screen.findByRole('navigation', { name: 'Main' })

    await user.click(within(nav).getByRole('link', { name: 'Monitors' }))
    expect(screen.getByRole('heading', { name: 'Monitors', level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/monitors')
    expect(within(nav).getByRole('link', { name: 'Monitors' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')

    await user.click(within(nav).getByRole('link', { name: 'Incidents' }))
    expect(screen.getByRole('heading', { name: 'Incidents', level: 1 })).toBeInTheDocument()
  })

  it.each([
    ['/monitors', 'Monitors'],
    ['/monitors/42', 'Monitor'],
    ['/incidents', 'Incidents'],
    ['/incidents/7', 'Incident'],
  ])('%s renders its page inside the shell', async (path, heading) => {
    signedIn()
    renderApp(path)
    expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
  })

  it('keeps the detail route id as a string (docs/api/README.md section 1)', async () => {
    signedIn()
    renderApp('/monitors/9007199254740993')
    expect(await screen.findByText(/Monitor #9007199254740993/)).toBeInTheDocument()
  })

  it('marks the parent section active on a detail page', async () => {
    signedIn()
    renderApp('/incidents/7')
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Incidents' })).toHaveAttribute('aria-current', 'page')
  })

  it.each(['/monitors', '/monitors/42', '/incidents', '/incidents/7'])('%s is protected: signed-out users go to /login', async (path) => {
    fakeApi({ 'GET /auth/me': unauthenticated() })
    renderApp(path)
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/login')
  })

  it('shows the 404 page for an unknown route, signed in or out', async () => {
    signedIn()
    renderApp('/does/not/exist')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Back to the start page' })).toHaveAttribute('href', '/')
  })
})
