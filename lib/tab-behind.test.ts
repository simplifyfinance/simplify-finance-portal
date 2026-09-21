import { describe, it, expect } from 'vitest'
import { tabIsBehind, behindLine, keepWhatTheyTyped } from './tab-behind'

// Build a record with n filled boxes, so the thresholds are tested on counts
// rather than on a hand-written blob that has to be recounted every time.
const withBoxes = (n: number) => {
  const o: Record<string, string> = {}
  for (let i = 0; i < n; i++) o['box' + i] = 'something'
  return o
}

describe('when a tab says it is behind', () => {
  // Richard Lake, 18 Sep 2026. The screen held six things; the record held 41.
  it('fires on the fault it was built for', () => {
    const b = tabIsBehind(withBoxes(6), withBoxes(41))
    expect(b).toEqual({ onScreen: 6, stored: 41, missing: 35 })
  })

  it('says nothing when the screen and the record agree', () => {
    expect(tabIsBehind(withBoxes(20), withBoxes(20))).toBeNull()
  })

  // Somebody halfway through a sentence has a couple fewer entries than the
  // record. Interrupting them is worse than saying nothing.
  it('says nothing over a handful of boxes', () => {
    expect(tabIsBehind(withBoxes(38), withBoxes(41))).toBeNull()
  })

  it('says nothing when the screen holds MORE than the record', () => {
    expect(tabIsBehind(withBoxes(41), withBoxes(6))).toBeNull()
  })

  // Two boxes against five is somebody who has just started.
  it('says nothing on a record too small to judge', () => {
    expect(tabIsBehind(withBoxes(0), withBoxes(5))).toBeNull()
  })

  it('needs both tests, not either', () => {
    // A big gap, but the screen still holds most of it.
    expect(tabIsBehind(withBoxes(90), withBoxes(100))).toBeNull()
    // A big proportion missing, but only four boxes.
    expect(tabIsBehind(withBoxes(4), withBoxes(8))).toBeNull()
    // Both, so it fires.
    expect(tabIsBehind(withBoxes(4), withBoxes(20))).not.toBeNull()
  })

  it('an empty screen against a full record fires', () => {
    expect(tabIsBehind({}, withBoxes(30))).not.toBeNull()
    expect(tabIsBehind(null, withBoxes(30))).not.toBeNull()
  })
})

describe('what it says', () => {
  const b = { onScreen: 6, stored: 41, missing: 35 }

  it('is in the past tense - it reports, it does not ask', () => {
    const line = behindLine(b, 'Mellissa Sedin', '2026-09-18T04:36:00.000Z')
    expect(line).toContain('35 things were saved')
    expect(line).toContain('have been put back')
    expect(line).toContain('Everything you typed has been kept')
    expect(line).toContain('Mellissa Sedin')
  })

  it('reads properly for a single missing thing', () => {
    const line = behindLine({ onScreen: 10, stored: 41, missing: 1 }, null, null)
    expect(line).toContain('One thing was')
    expect(line).toContain('it has been put back')
  })

  it('still reads properly with nobody named', () => {
    const line = behindLine(b, null, null)
    expect(line).toContain('35 things were saved')
    expect(line).not.toContain('Last saved by')
  })

  it('does not invent a time from a date it cannot read', () => {
    expect(behindLine(b, 'Kylie', 'not a date')).not.toContain(' at ')
  })
})

describe('putting the saved work back', () => {
  const atOpen  = { notes: '', expenses: '', retirement: '' }
  const stored  = { notes: 'A long compliance write-up', expenses: '4200', retirement: '' }
  const onScreen = { notes: '', expenses: '', retirement: '65' }

  it('brings back what was saved and keeps what was typed', () => {
    const out = keepWhatTheyTyped(atOpen, stored, onScreen)
    // Typed on this screen since it opened - untouched.
    expect(out.retirement).toBe('65')
    // Never touched here, and the record has it - it comes back.
    expect(out.notes).toBe('A long compliance write-up')
    expect(out.expenses).toBe('4200')
  })

  it('on a box both sides changed, what the person typed wins', () => {
    const out = keepWhatTheyTyped(
      { note: 'old' },
      { note: 'theirs' },
      { note: 'what I just typed' },
    )
    expect(out.note).toBe('what I just typed')
  })

  it('goes into nested records rather than choosing a whole branch', () => {
    const out = keepWhatTheyTyped(
      { risks: { a: '', b: '' } },
      { risks: { a: 'from the record', b: '' } },
      { risks: { a: '', b: 'typed here' } },
    )
    expect(out.risks).toEqual({ a: 'from the record', b: 'typed here' })
  })

  it('a screen that changed nothing gets the record back whole', () => {
    expect(keepWhatTheyTyped(atOpen, stored, atOpen)).toEqual(stored)
  })
})
