import type { ButtonHTMLAttributes } from 'react'
import { buttonClasses, type ButtonSize, type ButtonVariant } from './buttonStyles'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

/** The one button style for the app (PULSE-101). Defaults to type="button" so it never submits a form by accident. */
export function Button({ variant = 'primary', size = 'md', fullWidth = false, className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, `${fullWidth ? 'w-full' : ''} ${className}`.trim())} {...props} />
}
