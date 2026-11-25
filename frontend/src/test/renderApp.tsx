import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import App from '../App'

/** Shows the current path so tests can check redirects. */
function CurrentPath() {
  const location = useLocation()
  return <output data-testid="current-path">{location.pathname}</output>
}

/** Renders the whole app at `path`, with the real routes and AuthProvider. Mock fetch first (fakeApi). */
export function renderApp(path: string) {
  const user = userEvent.setup()
  const result = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <CurrentPath />
    </MemoryRouter>,
  )
  return { user, ...result }
}
