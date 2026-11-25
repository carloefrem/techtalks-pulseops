import { useAuth } from '../auth/useAuth'
import { Card } from '../components/ui/Card'
import { PageTitle } from '../components/ui/PageTitle'

/** /dashboard placeholder until the monitor list arrives (PULSE-91, Sprint 3). */
export function DashboardPage() {
  const { user } = useAuth()
  return (
    <>
      <PageTitle
        title="Dashboard"
        description={
          <>
            Signed in as <span className="font-medium text-slate-900">{user?.displayName ?? user?.email}</span>.
          </>
        }
      />
      <Card className="mt-6 border-dashed text-sm text-slate-500 shadow-none">
        Your monitors with their status and latest response time will appear here in Sprint 3.
      </Card>
    </>
  )
}
