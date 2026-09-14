import { describe, it, expect } from 'vitest'
import { mergeNotes, addedLines, removesAnything } from './notes-merge'

// The rule, tested in the words it is explained in: start from what is on YOUR
// screen, add any line the other person wrote that you have not got, and never
// delete anything.

describe('two people writing notes on the same deal', () => {
  it('keeps both when each adds a different line', () => {
    // The ordinary case, and the one that was destroying work.
    const base = 'Spoke to the agent.'
    const theirs = 'Spoke to the agent.\nValuation came back at 1.38M.'
    const mine = 'Spoke to the agent.\nClient wants to settle before Christmas.'
    const out = mergeNotes(base, theirs, mine)
    expect(out.text).toContain('Client wants to settle before Christmas.')
    expect(out.text).toContain('Valuation came back at 1.38M.')
    expect(out.broughtIn).toEqual(['Valuation came back at 1.38M.'])
  })

  it('KYLIE DOES NOT LOSE HER NOTE TO ONE CHARACTER', () => {
    // Exactly what the robot reproduced: an empty box, one space typed, and the
    // whole note gone.
    const out = mergeNotes('', ' ', 'Spoke to Erienne - she needs the discharge form before we can submit.')
    expect(out.text).toContain('Spoke to Erienne')
  })

  it('takes their version when this screen has not been touched', () => {
    const out = mergeNotes('A', 'A\nB', 'A')
    expect(out.text).toBe('A\nB')
    expect(out.broughtIn).toEqual(['B'])
  })

  it('keeps this screen when only this person has written', () => {
    const out = mergeNotes('A', 'A', 'A\nmine')
    expect(out.text).toBe('A\nmine')
    expect(out.broughtIn).toEqual([])
  })

  it('does nothing when both screens already say the same thing', () => {
    const out = mergeNotes('A', 'A\nB', 'A\nB')
    expect(out.text).toBe('A\nB')
    expect(out.broughtIn).toEqual([])
  })

  it('does not add their line twice when this screen already has it', () => {
    const out = mergeNotes('A', 'A\nB', 'A\nB\nC')
    expect(out.text).toBe('A\nB\nC')
    expect(out.broughtIn).toEqual([])
  })

  it('ignores blank lines rather than collecting them', () => {
    const out = mergeNotes('A', 'A\n\n\n', 'A\nmine')
    expect(out.broughtIn).toEqual([])
    expect(out.text).toBe('A\nmine')
  })

  it('MERGING NEVER DELETES', () => {
    // They deleted a line this screen still has. Their delete does not travel -
    // removing a note stays something a person does on their own screen.
    const out = mergeNotes('A\nB', 'A', 'A\nB\nC')
    expect(out.text).toContain('B')
    expect(out.text).toContain('C')
  })

  it('survives nothing at all', () => {
    expect(mergeNotes(null, null, null).text).toBe('')
    expect(mergeNotes(undefined, '', 'x').text).toBe('x')
  })
})

describe('what changed', () => {
  it('names the lines that appeared', () => {
    expect(addedLines('A', 'A\nB\nC')).toEqual(['B', 'C'])
  })

  it('says when a save takes something away', () => {
    expect(removesAnything('A\nB', 'A')).toBe(true)
    expect(removesAnything('A', 'A\nB')).toBe(false)
    expect(removesAnything('A', 'A  ')).toBe(false)
    expect(removesAnything('', 'anything')).toBe(false)
  })
})
