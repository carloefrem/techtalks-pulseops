import { describe, expect, it } from 'vitest'
import { DEFAULT_API_BASE_URL, parseApiBaseUrl } from './env'

describe('parseApiBaseUrl (docs/frontend/README.md section 3)', () => {
  it('defaults to /api when missing or empty', () => {
    expect(parseApiBaseUrl(undefined)).toBe(DEFAULT_API_BASE_URL)
    expect(parseApiBaseUrl('  ')).toBe('/api')
  })

  it('accepts a path or an http(s) URL', () => {
    expect(parseApiBaseUrl('/api')).toBe('/api')
    expect(parseApiBaseUrl('http://localhost:3001/api')).toBe('http://localhost:3001/api')
    expect(parseApiBaseUrl('https://api.example.com')).toBe('https://api.example.com')
  })

  it('rejects other schemes, protocol-relative URLs and trailing slashes', () => {
    expect(() => parseApiBaseUrl('ftp://example.com')).toThrow(/VITE_API_BASE_URL/)
    expect(() => parseApiBaseUrl('//evil.example')).toThrow(/VITE_API_BASE_URL/)
    expect(() => parseApiBaseUrl('api')).toThrow(/VITE_API_BASE_URL/)
    expect(() => parseApiBaseUrl('/api/')).toThrow(/trailing slash/)
  })
})
