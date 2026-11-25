import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { CurrentPath } from './CurrentPath'

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
