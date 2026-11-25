import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toFormError, validateEmail, type FieldErrors, type FormError } from '../auth/authErrors'
import { redirectTarget } from '../auth/redirect'
import { useAuth } from '../auth/useAuth'
import { FormAlert } from '../components/forms/FormAlert'
import { TextField } from '../components/forms/TextField'
import { Button } from '../components/ui/Button'
import { AuthCard } from './AuthCard'

/** /login (PULSE-109): POST /api/auth/login, then the page the user wanted or /dashboard. */
export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<FormError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (auth.status === 'authenticated' && !submitting) {
    return <Navigate to={redirectTarget(location.state)} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors: FieldErrors = { email: validateEmail(email), password: password ? undefined : 'Enter your password.' }
    setFieldErrors(errors)
    setFormError(null)
    if (errors.email || errors.password) return

    setSubmitting(true)
    try {
      await auth.login({ email: email.trim(), password })
      navigate(redirectTarget(location.state), { replace: true })
    } catch (error) {
      const formErr = toFormError(error)
      setFormError(formErr)
      setFieldErrors(formErr.fields)
      setSubmitting(false)
    }
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle={
        <>
          New to PulseOps?{' '}
          <Link to="/register" state={location.state} className="font-medium text-emerald-700 underline">
            Create an account
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4" aria-label="Sign in">
        {formError && <FormAlert>{formError.message}</FormAlert>}
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <Button type="submit" disabled={submitting} fullWidth>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  )
}
