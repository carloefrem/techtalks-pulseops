import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'
import { buttonClasses } from './buttonStyles'
import { Card } from './Card'
import { PageTitle } from './PageTitle'

describe('base components (PULSE-101)', () => {
  it('Button defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button')
  })

  it('Button keeps an explicit type and the disabled state', () => {
    render(
      <Button type="submit" disabled>
        Send
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Send' })
    expect(button).toHaveAttribute('type', 'submit')
    expect(button).toBeDisabled()
  })

  it('buttonClasses gives each variant its own colours', () => {
    expect(buttonClasses('primary')).toContain('bg-slate-900')
    expect(buttonClasses('secondary')).toContain('border-slate-300')
    expect(buttonClasses('danger')).toContain('bg-red-600')
  })

  it('PageTitle renders one h1 with its description and actions', () => {
    render(<PageTitle title="Monitors" description="The endpoints you check." actions={<Button>Add</Button>} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Monitors' })).toBeInTheDocument()
    expect(screen.getByText('The endpoints you check.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('Card passes through extra classes and attributes', () => {
    render(<Card data-testid="card" className="mt-6" />)
    expect(screen.getByTestId('card')).toHaveClass('mt-6', 'rounded-xl')
  })
})
