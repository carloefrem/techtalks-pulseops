import type { ReactNode } from 'react'
import { Card } from '../components/ui/Card'
import { PageTitle } from '../components/ui/PageTitle'

/** Stand-in for screens built in later sprints, so routes and navigation work now (PULSE-101). */
export function PlaceholderPage({ title, description, comingIn }: { title: string; description: ReactNode; comingIn: string }) {
  return (
    <>
      <PageTitle title={title} description={description} />
      <Card className="mt-6 border-dashed text-sm text-slate-500 shadow-none">This screen arrives in {comingIn}.</Card>
    </>
  )
}
