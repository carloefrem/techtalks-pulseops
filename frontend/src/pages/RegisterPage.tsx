import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  toFormError,
  validateDisplayName,
  validateEmail,
  validateNewPassword,
  type FieldErrors,
  type FormError,
} from '../auth/authErrors'
import { redirectTarget } from '../auth/redirect'
import { useAuth } from '../auth/useAuth'
import { FormAlert } from '../components/forms/FormAlert'
import { TextField } from '../components/forms/TextField'
import { AuthCard } from './AuthCard'

/** /register (PULSE-109): POST /api/auth/register signs the user in, then /dashboard. */
export function RegisterPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [displayName, setDisplayName] = useState('')
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
    const errors: FieldErrors = {
      displayName: validateDisplayName(displayName),
      email: validateEmail(email),
      password: validateNewPassword(password),
    }
    setFieldErrors(errors)
    setFormError(null)
    if (errors.displayName || errors.email || errors.password) return

    setSubmitting(true)
    try {
      const name = displayName.trim()
      await auth.register({ email: email.trim(), password, ...(name ? { displayName: name } : {}) })
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
      title="Create your account"
      subtitle={
        <>
          Already have an account?{' '}
          <Link to="/login" state={location.state} className="font-medium text-emerald-700 underline">
            Sign in
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4" aria-label="Create account">
        {formError && (
          <FormAlert>
            {formError.message}
            {formError.code === 'EMAIL_TAKEN' && (
              <>
                {' '}
                <Link to="/login" state={location.state} className="font-medium underline">
                  Sign in
                </Link>
              </>
            )}
          </FormAlert>
        )}
        <TextField
          label="Name (optional)"
          name="displayName"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={fieldErrors.displayName}
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          hint={`${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`}
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  )
}
