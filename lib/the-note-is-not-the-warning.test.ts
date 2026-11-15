// THE WARNING COMES OUT OF THE NOTE AND GOES ABOVE IT.
//
// 17 Nov 2026. "** NOT RECORDED — ... **" was printing inside a document that
// goes to a lender. Fabio: put it in a red list on top, and "No, I don't want
// to block it because it makes it hard."
import { describe, it, expect } from 'vitest'
import { warningsIn, withoutWarnings, noteText, toFix } from './the-note-is-not-the-warning'

const NOTE = 'Split 2, $57,600 at 7.00%. ** NOT RECORDED — nothing has been recorded to '
  + 'explain the splits. Record the purpose on the borrowing capacity. ** The clients '
  + 'recorded a redraw facility. ** ONLY ONE LENDER RECORDED — not compared. ** Done.'

describe('the warnings', () => {
  it('are found, in order, without their asterisks', () => {
    const w = warningsIn(NOTE)
    expect(w).toHaveLength(2)
    expect(w[0]).toContain('nothing has been recorded to explain the splits')
    expect(w[1]).toBe('ONLY ONE LENDER RECORDED — not compared.')
    expect(w.join(' ')).not.toContain('**')
  })

  it('and a clean note has none', () => {
    expect(warningsIn('Nothing is wrong with this one.')).toEqual([])
    expect(warningsIn('')).toEqual([])
    expect(warningsIn(null)).toEqual([])
  })
})

describe('the note without them', () => {
  const clean = withoutWarnings(NOTE)

  it('carries no asterisks and no warning words', () => {
    expect(clean).not.toContain('**')
    expect(clean).not.toContain('NOT RECORDED')
    expect(clean).not.toContain('ONLY ONE LENDER')
  })

  it('and still reads as sentences', () => {
    expect(clean).toBe('Split 2, $57,600 at 7.00%. The clients recorded a redraw facility. Done.')
  })

  it('leaving no double spaces or stranded punctuation', () => {
    expect(withoutWarnings('He owns it. ** A WARNING. ** It is a house.'))
      .toBe('He owns it. It is a house.')
    expect(withoutWarnings('The value is ** NOT RECORDED — the value. **.'))
      .toBe('The value is.')
  })

  it('and a note with nothing in it stays empty', () => {
    expect(withoutWarnings('')).toBe('')
    expect(withoutWarnings(null)).toBe('')
  })
})

describe('the list above the note', () => {
  const gaps = [
    { what: 'Purpose of funds on each split', where: 'Borrowing capacity' },
    { what: 'Only one lender option recorded', where: 'Lending options' },
  ]

  it('says the warning in full, and where to fix it', () => {
    const list = toFix(NOTE, gaps)
    expect(list[0].what).toContain('nothing has been recorded to explain the splits')
    expect(list).toHaveLength(4)
  })

  it('and a gap nothing warned about is still on it', () => {
    const list = toFix('A clean note.', [{ what: 'Retirement age for Priya', where: 'Compliance → Risks' }])
    expect(list).toEqual([{ what: 'Retirement age for Priya', where: 'Compliance → Risks' }])
  })

  // THE SAME THING TWICE IS THE COMPLAINT THIS WHOLE DAY IS ABOUT.
  it('never says the same thing twice', () => {
    const list = toFix('** Retirement age for Priya is missing. **',
      [{ what: 'Retirement age for Priya', where: 'Compliance → Risks' }])
    expect(list).toHaveLength(1)
    expect(list[0].where, 'the warning takes the box from the gap').toBe('Compliance → Risks')
  })

  it('a clean note with no gaps has an empty list', () => {
    expect(toFix('All recorded.', [])).toEqual([])
    expect(toFix('All recorded.', null)).toEqual([])
  })
})

// 17 Nov 2026, FOUND BY THE BROWSER CHECK on the first ship after this file was
// written. Three boxes on a deal with nothing recorded said nothing but a
// warning, and lifting it out left an empty textarea - a person pressing Write
// from the deal and watching nothing happen.
describe('a box that is only a warning keeps it', () => {
  const ONLY = '** NOT RECORDED — this deal records neither a purchase price, an equity '
    + 'release nor any debt being paid out, so there is nothing to say about the deposit '
    + 'or the equity position. **'

  it('because an empty box reads as a broken button', () => {
    expect(withoutWarnings(ONLY)).toBe('')
    expect(noteText(ONLY)).toBe(ONLY)
  })

  // THE COMPLAINT THIS WAS BUILT FOR: a warning in the middle of a finished
  // paragraph that goes to a lender.
  it('and a box that says something without them still loses them', () => {
    const mixed = 'He owns the house. ** NOT RECORDED — the value. ** It is on a 30 year term.'
    expect(noteText(mixed)).toBe('He owns the house. It is on a 30 year term.')
  })

  it('a clean note is handed back as it is', () => {
    expect(noteText('All of it is recorded.')).toBe('All of it is recorded.')
  })

  it('and nothing at all is still nothing', () => {
    expect(noteText('')).toBe('')
    expect(noteText(null)).toBe('')
  })
})
