import { describe, it, expect } from 'vitest'
import { dayHasChanged, saveWords, NOT_SENT, type DaySaid } from './a-day-can-change'

const said: DaySaid = { dealIds: ['a', 'b'], notes: { a: 'chase CBA at 11' }, onItNow: 'a' }

describe('a day that moved after she told them', () => {
  it('a file ticked on is a change', () => {
    expect(dayHasChanged(said, { ...said, dealIds: ['a', 'b', 'c'] })).toBe(true)
  })

  it('a file crossed off is a change', () => {
    expect(dayHasChanged(said, { ...said, dealIds: ['a'] })).toBe(true)
  })

  // THE ORDER IS THE PLAN. First is first, and moving it is a decision.
  it('reordering is a change', () => {
    expect(dayHasChanged(said, { ...said, dealIds: ['b', 'a'] })).toBe(true)
  })

  it('a note is a change', () => {
    expect(dayHasChanged(said, { ...said, notes: { a: 'chase CBA at 2' } })).toBe(true)
  })

  it('and so is the one she is on now', () => {
    expect(dayHasChanged(said, { ...said, onItNow: 'b' })).toBe(true)
  })

  it('but nothing moving is not a change', () => {
    expect(dayHasChanged(said, { dealIds: ['a', 'b'], notes: { a: 'chase CBA at 11' }, onItNow: 'a' }))
      .toBe(false)
  })

  it('whitespace in a note is not a change', () => {
    expect(dayHasChanged(said, { ...said, notes: { a: '  chase CBA at 11 ' } })).toBe(false)
  })

  it('an empty note and no note are the same thing', () => {
    expect(dayHasChanged(
      { dealIds: ['a'], notes: {}, onItNow: null },
      { dealIds: ['a'], notes: { a: '' }, onItNow: null })).toBe(false)
  })

  // NOTHING TOLD YET IS NOT A CHANGE - the button is on screen regardless.
  it('says no when she has told them nothing yet', () => {
    expect(dayHasChanged(null, { dealIds: ['a'], notes: {}, onItNow: null })).toBe(false)
  })
})

describe('what the button says', () => {
  it('asks for the day the first time', () => {
    expect(saveWords(false, false)).toBe('Yes — this is my day')
  })

  it('and offers to save what moved after that', () => {
    expect(saveWords(false, true)).toBe('Save the change')
  })

  it('says what it is doing while it does it', () => {
    expect(saveWords(true, true)).toBe('Telling them...')
  })

  it('the chip never claims a changed day was sent', () => {
    expect(NOT_SENT).toBe('Changed since you told them')
  })
})
