import { describe, it, expect } from 'vitest'
import { safeNextPath } from './safe-next-path'

describe('where to go after signing in', () => {
  it('keeps a normal path', () => {
    expect(safeNextPath('/deals/abc-123')).toBe('/deals/abc-123')
    expect(safeNextPath('/deals?stage=BC')).toBe('/deals?stage=BC')
  })

  it('falls back to the home page when there is nothing to go on', () => {
    expect(safeNextPath(null)).toBe('/')
    expect(safeNextPath('')).toBe('/')
    expect(safeNextPath('   ')).toBe('/')
  })

  // The one that matters: a link that would bounce a signed-in broker onto
  // somebody else's site while they still think they are signing in.
  it('refuses to send anybody off the portal', () => {
    expect(safeNextPath('//evil.example.com')).toBe('/')
    expect(safeNextPath('https://evil.example.com')).toBe('/')
    expect(safeNextPath('/\\evil.example.com')).toBe('/')
    expect(safeNextPath('javascript:alert(1)')).toBe('/')
  })
})
