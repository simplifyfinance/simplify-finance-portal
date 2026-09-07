import { describe, it, expect } from 'vitest'
import { shouldKeep, newHistoryClock, KEEP_EVERY_MS, describeVersion } from './deal-history'
import { canSeeHistory } from './permissions'

const full = () => ({ a: '1', b: '2', c: '3', d: '4', e: '5' })

describe('deciding when to keep a copy', () => {
  it('always keeps one when something is being removed - whatever the clock says', () => {
    const clock = { lastKeptAt: Date.now() }
    expect(shouldKeep(full(), { a: '1' }, clock, Date.now())).toBe(true)
  })

  // The case that started all of this.
  it('keeps a copy when a finished form is about to be emptied', () => {
    const clock = { lastKeptAt: Date.now() }
    expect(shouldKeep(full(), {}, clock, Date.now())).toBe(true)
  })

  it('does not keep a copy of every keystroke while somebody types', () => {
    const clock = { lastKeptAt: 1_000_000 }
    const growing = { ...full(), f: '6' }
    expect(shouldKeep(full(), growing, clock, 1_000_000 + 5_000)).toBe(false)
  })

  it('keeps one every few minutes even when the record is only growing', () => {
    const clock = { lastKeptAt: 1_000_000 }
    const growing = { ...full(), f: '6' }
    expect(shouldKeep(full(), growing, clock, 1_000_000 + KEEP_EVERY_MS)).toBe(true)
  })

  it('has nothing to keep before the record has anything in it', () => {
    expect(shouldKeep(null, full(), newHistoryClock(), Date.now())).toBe(false)
    expect(shouldKeep({}, full(), newHistoryClock(), Date.now())).toBe(false)
  })

  it('has nothing to keep when the save changes nothing', () => {
    expect(shouldKeep(full(), full(), newHistoryClock(), Date.now())).toBe(false)
  })
})

describe('reading the list of previous versions', () => {
  const at = (d: Date) => ({ id: 1, data: {}, filled: 41, replacedAt: d.toISOString(), replacedByName: 'Mellissa Sedin' })
  // Built from a fixed "now" rather than written out, so the test says the same
  // thing on a machine set to Sydney and one set to UTC.
  const now = new Date('2026-09-07T06:00:00Z')
  const hoursBefore = (h: number) => new Date(now.getTime() - h * 3600 * 1000)

  it('reads like a sentence', () => {
    const s = describeVersion(at(hoursBefore(3)), now)
    expect(s).toContain('Today at')
    expect(s).toContain('Mellissa Sedin')
    expect(s).toContain('41 things filled in')
  })

  it('says yesterday when it was yesterday', () => {
    expect(describeVersion(at(hoursBefore(24)), now)).toContain('Yesterday')
  })

  it('gives a date once it is older than that', () => {
    const s = describeVersion(at(hoursBefore(24 * 4)), now)
    expect(s).not.toContain('Today')
    expect(s).not.toContain('Yesterday')
    expect(s).toContain('Sep')
  })

  it('copes with a version nobody signed', () => {
    const s = describeVersion({ id: 2, data: {}, filled: null, replacedAt: hoursBefore(3).toISOString(), replacedByName: null }, now)
    expect(s).toContain('Today at')
    expect(s).not.toContain('—  —')
  })
})

describe('who may look at previous versions', () => {
  it('is the two people who asked for it', () => {
    expect(canSeeHistory('fabio@simplifyfinance.com.au')).toBe(true)
    expect(canSeeHistory('kylie@simplifyfinance.com.au')).toBe(true)
  })

  it('is nobody else, whatever their role', () => {
    expect(canSeeHistory('katie@simplifyfinance.com.au')).toBe(false)
    expect(canSeeHistory('')).toBe(false)
    expect(canSeeHistory(null)).toBe(false)
    expect(canSeeHistory(undefined)).toBe(false)
  })

  it('does not care about capitals or stray spaces', () => {
    expect(canSeeHistory('  Fabio@SimplifyFinance.com.au ')).toBe(true)
  })
})
