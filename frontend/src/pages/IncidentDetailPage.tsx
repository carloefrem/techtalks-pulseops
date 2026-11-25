import { useParams } from 'react-router-dom'
import { PlaceholderPage } from './PlaceholderPage'

/** /incidents/:id: details, notes and resolve (Sprint 4). */
export function IncidentDetailPage() {
  const { id } = useParams()
  return (
    <PlaceholderPage
      title="Incident"
      description={<>Incident #{id}: timeline, notes and resolve.</>}
      comingIn="Sprint 4"
    />
  )
}
