import { useParams } from 'react-router-dom'
import { PlaceholderPage } from './PlaceholderPage'

/** /monitors/:id: check history, response-time chart, manual check (Sprint 3). */
export function MonitorDetailPage() {
  const { id } = useParams()
  return (
    <PlaceholderPage
      title="Monitor"
      description={<>Monitor #{id}: check history, response times and manual checks.</>}
      comingIn="Sprint 3"
    />
  )
}
