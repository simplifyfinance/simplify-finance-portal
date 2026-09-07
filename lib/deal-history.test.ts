import { describe, it, expect } from 'vitest'
import { shouldKeep, newHistoryClock, KEEP_EVERY_MS } from './deal-history'

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
