import { describe, expect, it } from 'vitest'
import { rateLimitedMessage } from './authErrors'

describe('rateLimitedMessage', () => {
  it('falls back to a generic message without Retry-After', () => {
    expect(rateLimitedMessage()).toBe('Too many attempts. Please wait a moment and try again.')
    expect(rateLimitedMessage(0)).toBe('Too many attempts. Please wait a moment and try again.')
  })

  it('uses seconds under a minute and rounds minutes up', () => {
    expect(rateLimitedMessage(1)).toBe('Too many attempts. Try again in 1 second.')
    expect(rateLimitedMessage(45)).toBe('Too many attempts. Try again in 45 seconds.')
    expect(rateLimitedMessage(60)).toBe('Too many attempts. Try again in 1 minute.')
    expect(rateLimitedMessage(61)).toBe('Too many attempts. Try again in 2 minutes.')
    expect(rateLimitedMessage(900)).toBe('Too many attempts. Try again in 15 minutes.')
  })
})
