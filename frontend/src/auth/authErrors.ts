import { ApiError } from '../api/client'

/**
 * Turns an auth API error into what the form shows. Switches on the stable `code`, never on the
 * English `message` (docs/frontend/README.md section 6; codes from docs/api/README.md section 2).
 */
export type FieldErrors = Partial<Record<'email' | 'password' | 'displayName', string>>

export interface FormError {
  /** Shown above the form. */
  message: string
  /** Shown under each field (from VALIDATION_ERROR details). */
  fields: FieldErrors
  code: string
}

const FIELD_NAMES = new Set(['email', 'password', 'displayName'])

export const API_UNAVAILABLE_MESSAGE = 'The PulseOps API is unavailable right now. Please try again in a moment.'

export function toFormError(error: unknown): FormError {
  if (!(error instanceof ApiError)) {
    return { code: 'UNKNOWN', message: 'Something went wrong. Please try again.', fields: {} }
  }

  switch (error.code) {
    case 'VALIDATION_ERROR': {
      const fields: FieldErrors = {}
      for (const detail of error.details) {
        if (detail.field && FIELD_NAMES.has(detail.field) && !fields[detail.field as keyof FieldErrors]) {
          fields[detail.field as keyof FieldErrors] = detail.message
        }
      }
      return { code: error.code, message: 'Please fix the highlighted fields.', fields }
    }
    case 'INVALID_CREDENTIALS':
      // Same message for a wrong email or a wrong password (PULSE-87), so it doesn't reveal which one.
      return { code: error.code, message: 'Email or password is incorrect.', fields: {} }
    case 'EMAIL_TAKEN':
      return {
        code: error.code,
        message: 'An account with this email already exists.',
        fields: { email: 'This email is already registered. Try signing in instead.' },
      }
    case 'RATE_LIMITED':
      return { code: error.code, message: rateLimitedMessage(error.retryAfterSeconds), fields: {} }
    case 'NETWORK_ERROR':
    case 'TIMEOUT':
      return { code: error.code, message: API_UNAVAILABLE_MESSAGE, fields: {} }
    default:
      if (error.status === 0 || error.status >= 500) {
        return { code: error.code, message: API_UNAVAILABLE_MESSAGE, fields: {} }
      }
      return { code: error.code, message: 'Something went wrong. Please try again.', fields: {} }
  }
}

/** "Too many attempts" with the wait from Retry-After when the API sends it (10 attempts per 15 min, PR #17). */
export function rateLimitedMessage(retryAfterSeconds?: number): string {
  if (retryAfterSeconds === undefined || retryAfterSeconds <= 0) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  if (retryAfterSeconds < 60) {
    return `Too many attempts. Try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'}.`
  }
  const minutes = Math.ceil(retryAfterSeconds / 60)
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}

/** Client-side checks that mirror docs/api/README.md section 6.1. The backend stays the source of truth. */
export const EMAIL_MAX = 254
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72
export const DISPLAY_NAME_MAX = 100

export function validateEmail(email: string): string | undefined {
  const value = email.trim()
  if (!value) return 'Enter your email.'
  if (value.length > EMAIL_MAX) return `Email must be at most ${EMAIL_MAX} characters.`
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.'
  return undefined
}

export function validateNewPassword(password: string): string | undefined {
  if (!password) return 'Enter a password.'
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`
  if (password.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters.`
  return undefined
}

export function validateDisplayName(displayName: string): string | undefined {
  if (displayName.trim().length > DISPLAY_NAME_MAX) return `Name must be at most ${DISPLAY_NAME_MAX} characters.`
  return undefined
}
