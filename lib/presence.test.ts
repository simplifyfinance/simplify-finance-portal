import { describe, it, expect } from 'vitest'
import { stillHere, presenceState, presenceMessage, STALE_AFTER_MS, type Presence } from './presence'

const NOW = Date.parse('2026-09-04T10:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const p = (userId: string, name: string, tab: string, msAgo = 0): Presence =>
  ({ userId, name, tab, lastSeen: ago(msAgo) })

describe('who is still here', () => {
  it('leaves me out of my own banner', () => {
    expect(stillHere([p('me', 'Fabio', 'LO'), p('k', 'Katie', 'LO')], 'me', NOW).map(x => x.name))
      .toEqual(['Katie'])
  })

  it('drops somebody whose heartbeat stopped', () => {
    expect(stillHere([p('k', 'Katie', 'LO', STALE_AFTER_MS + 1000)], 'me', NOW)).toEqual([])
  })

  // Three missed beats before somebody disappears, so a slow network does not
  // make people flicker in and out of the banner.
  it('keeps somebody who missed a beat or two', () => {
    expect(stillHere([p('k', 'Katie', 'LO', 45_000)], 'me', NOW)).toHaveLength(1)
  })

  it('reads the most recently active person first', () => {
    const rows = [p('a', 'Ann', 'BC', 30_000), p('b', 'Ben', 'BC', 2_000)]
    expect(stillHere(rows, 'me', NOW).map(x => x.name)).toEqual(['Ben', 'Ann'])
  })

  it('copes with nothing at all', () => {
    expect(stillHere(null, 'me', NOW)).toEqual([])
    expect(stillHere([], 'me', NOW)).toEqual([])
  })
})

describe('which state the banner is in', () => {
  it('is quiet when nobody else is here', () => {
    expect(presenceState([], 'LO')).toEqual({ level: 'none' })
  })

  // Different tabs write different columns, so nobody is in anybody's way.
  it('is informational when they are on another tab', () => {
    const s = presenceState([p('k', 'Katie Amos', 'Fact Find')], 'Lending options')
    expect(s).toEqual({ level: 'elsewhere', who: 'Katie Amos', where: 'Fact Find' })
    expect(presenceMessage(s)!.text).toBe('Katie Amos is also in this deal, on Fact Find.')
    expect(presenceMessage(s)!.detail).toBeUndefined()
  })

  // The case that cost an afternoon.
  it('warns when they are on the same tab, and says what will happen', () => {
    const s = presenceState([p('k', 'Katie Amos', 'Lending options')], 'Lending options')
    expect(s.level).toBe('same-tab')
    const m = presenceMessage(s)!
    expect(m.text).toBe('Katie Amos is on this same tab right now.')
    expect(m.detail).toContain('only the first save lands')
  })

  it('takes the same tab seriously even when others are elsewhere', () => {
    const s = presenceState([p('a', 'Ann', 'BC'), p('k', 'Katie', 'Lending options')], 'Lending options')
    expect(s).toEqual({ level: 'same-tab', who: 'Katie' })
  })

  it('names several people properly', () => {
    const s = presenceState([p('a', 'Ann', 'BC'), p('b', 'Ben', 'Fact Find')], 'Lending options')
    expect(presenceMessage(s)!.text).toBe('Ann and Ben are also in this deal, on BC and Fact Find.')
  })

  it('says something sensible when a name is missing', () => {
    const s = presenceState([p('x', '', 'BC')], 'Lending options')
    expect(presenceMessage(s)!.text).toBe('Somebody else is also in this deal, on BC.')
  })
})
