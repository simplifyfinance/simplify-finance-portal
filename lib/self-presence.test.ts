import { describe, it, expect } from 'vitest'
import { otherWindows, selfMessage, SELF_STALE_AFTER_MS } from './self-presence'

const NOW = 1_000_000
const w = (sessionId: string, tab: string, ageMs = 0): any => ({ sessionId, tab, at: NOW - ageMs })

describe('which of my own windows are still open', () => {
  it('never counts the window doing the asking', () => {
    expect(otherWindows([w('me', 'Fact Find')], 'me', NOW)).toEqual([])
  })

  it('counts another window of mine', () => {
    expect(otherWindows([w('other', 'BC')], 'me', NOW)).toHaveLength(1)
  })

  it('forgets a window that has gone quiet', () => {
    expect(otherWindows([w('other', 'BC', SELF_STALE_AFTER_MS + 1)], 'me', NOW)).toEqual([])
  })

  it('counts a window once, however many times it has called out', () => {
    const rows = [w('other', 'BC', 6000), w('other', 'Fact Find', 1000)]
    const out = otherWindows(rows, 'me', NOW)
    expect(out).toHaveLength(1)
    // The most recent thing it said is the true one.
    expect(out[0].tab).toBe('Fact Find')
  })

  it('ignores a row with no window id', () => {
    expect(otherWindows([w('', 'BC')], 'me', NOW)).toEqual([])
  })
})

describe('what it says', () => {
  it('says nothing when there is only one window', () => {
    expect(selfMessage([], 'Fact Find')).toBeNull()
  })

  it('is direct when the other window is on the same tab', () => {
    const m = selfMessage([w('other', 'Fact Find')], 'Fact Find')!
    expect(m).toContain('this same tab')
    expect(m).toContain('close one of them')
  })

  it('is a note, not a warning, when the other window is elsewhere', () => {
    expect(selfMessage([w('other', 'BC')], 'Fact Find')).toBe('You also have this deal open in another window, on BC.')
  })

  it('lists more than one', () => {
    const m = selfMessage([w('a', 'BC'), w('b', 'Compliance')], 'Fact Find')!
    expect(m).toContain('BC and Compliance')
  })

  it('copes with a window that never said which tab it was on', () => {
    expect(selfMessage([w('a', '')], 'Fact Find')).toContain('another tab')
  })
})
