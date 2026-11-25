import { useLocation } from 'react-router-dom'

/** Shows the current path so tests can check redirects. */
export function CurrentPath() {
  const location = useLocation()
  return <output data-testid="current-path">{location.pathname}</output>
}
