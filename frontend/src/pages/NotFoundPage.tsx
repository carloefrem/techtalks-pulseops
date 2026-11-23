import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-3 text-slate-600">This page doesn't exist.</p>
      <Link to="/" className="mt-6 inline-block font-medium text-emerald-700 underline hover:text-emerald-900">
        Back to the start page
      </Link>
    </main>
  )
}
