import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  reviewFor, reviewAll, confirmationLine, namesInTheQuestion, nothingToWrite,
} from './what-goes-on-the-client-record'

// "THAT NEEDS TO BE A SERIOUS QUESTION."
//
// 26 Nov 2026. Catherine hit an error closing three of Mark Gallo's deals as
// lost. Chasing it turned up something nobody had asked about: closing a deal
// ALSO overwrote every applicant's client record - their properties, their
// liabilities, their assets - from a tick box that was ticked for you, with
// nothing on screen saying which figures.
//
// Fabio:
//
//   "If we're marking a deal as lost, we got to ask the question, do you want
//    to update the current assets and liabilities? And the preference is
//    normally we don't because we lost the deal, but just that needs to be a
//    serious question... please create a habit that you show what the A&L is
//    and say, are you confirming this is the current position?"
//
// A LOST DEAL USUALLY CHANGES NOTHING ABOUT WHAT SOMEBODY OWNS. They did not
// buy the house and they did not take the loan. So no is the default, and yes
// has to be chosen, read, and confirmed by name.

const FF = {
  applicants: [
    { id: 'a1', clientId: 'c1', firstName: 'Harrison', lastName: 'Hastie' },
    { id: 'a2', clientId: 'c2', firstName: 'Jacob', lastName: 'Hastie' },
  ],
  properties: [
    { address: '14 Example St, Wyoming', value: '880000', purpose: 'owner occupied',
      ownership: { a1: 'Yes' } },
  ],
  liabilities: [
    { liabilityType: 'Home loan', lenderName: 'Macquarie', balance: '430000',
      ownership: { a1: 'Yes' } },
    { liabilityType: 'Credit card', limitAmount: '6000', balance: '900',
      ownership: { a2: 'Yes' } },
  ],
  assets: [
    { assetType: 'Savings', value: '62000', ownership: { a1: 'Yes' } },
    { assetType: 'Superannuation', value: '', ownership: { a2: 'Yes' } },
  ],
}

describe('what goes on the record is read out, item by item', () => {
  const [harrison, jacob] = reviewAll(FF, FF.applicants)

  it('names the person, not "applicant 1"', () => {
    expect(harrison.name).toBe('Harrison Hastie')
    expect(jacob.name).toBe('Jacob Hastie')
  })

  it('and only what is actually theirs', () => {
    expect(harrison.properties).toHaveLength(1)
    expect(jacob.properties).toHaveLength(0)
    expect(harrison.liabilities.map(l => l.what)).toEqual(['Home loan - Macquarie'])
    expect(jacob.liabilities.map(l => l.what)).toEqual(['Credit card'])
  })

  it('with the address and the figure on the line', () => {
    expect(harrison.properties[0].what).toContain('14 Example St, Wyoming')
    expect(harrison.properties[0].amount).toBe('$880,000')
  })

  // A LENDER READS THE LIMIT, NOT THE BALANCE. Showing $900 against a $6,000
  // card flatters the position on the one line that most often decides whether
  // a deal works.
  it('a credit card shows its LIMIT, and says so', () => {
    expect(jacob.liabilities[0].amount).toBe('$6,000 limit')
  })

  // NEVER INVENT A FIGURE. A blank super balance is a gap, not a zero.
  it('a missing figure prints as missing, never as nothing owed', () => {
    expect(jacob.assets[0].what).toBe('Superannuation')
    expect(jacob.assets[0].amount).toBe('not recorded')
  })
})

describe('the line somebody has to tick', () => {
  it('has their names in it, so it cannot be ticked without reading it', () => {
    expect(confirmationLine(FF.applicants))
      .toBe("I confirm this is Harrison and Jacob's current position.")
  })

  it('and still reads properly for one applicant', () => {
    expect(namesInTheQuestion([FF.applicants[0]])).toBe('Harrison')
    expect(confirmationLine([FF.applicants[0]]))
      .toBe("I confirm this is Harrison's current position.")
  })

  it('and for three', () => {
    expect(namesInTheQuestion([...FF.applicants, { firstName: 'Mia', lastName: 'Hastie' }]))
      .toBe('Harrison, Jacob and Mia')
  })
})

describe('a Fact Find with nothing in it is not a position', () => {
  it('is recognised before anything is read or written', () => {
    const empty = { applicants: FF.applicants }
    expect(nothingToWrite(reviewAll(empty, empty.applicants))).toBe(true)
  })

  it('and a real one is not', () => {
    expect(nothingToWrite(reviewAll(FF, FF.applicants))).toBe(false)
  })

  it('one applicant holding nothing is flagged on their own, not the whole deal', () => {
    const r = reviewFor({ ...FF, applicants: FF.applicants },
                        { id: 'a9', clientId: 'c9', firstName: 'Nobody', lastName: 'Here' })
    expect(r.holdsNothing).toBe(true)
  })
})

describe('THE DIALOG ITSELF', () => {
  const src = readFileSync('app/(app)/deals/[id]/CloseDeal.tsx', 'utf8')

  it('asks the question with No already chosen', () => {
    expect(src).toContain('useState(false)\n  // And having said yes')
    expect(src).toContain('Does losing this deal change what')
    expect(src).toContain('No &mdash; leave their client records alone')
  })

  it('and will not go until the line is ticked', () => {
    expect(src).toContain('disabled={busy || (savePosition && (!confirmedPosition || blankFactFind))}')
  })

  // THE ORDER IS THE FIX FOR WHAT CATHERINE ACTUALLY SAW.
  //
  // It used to close the deal and THEN write the records, so a failure on the
  // second half left the deal closed behind a box saying "Nothing has been
  // recorded". Records first means a failure stops before anything happens.
  it('writes the client records BEFORE it closes the deal', () => {
    const positions = src.indexOf('if (savePosition && linked.length > 0) await writePositions()')
    const close = src.indexOf("supabase.from('deals').update(patch)")
    expect(positions).toBeGreaterThan(-1)
    expect(close).toBeGreaterThan(-1)
    expect(positions).toBeLessThan(close)
  })

  it('and says so honestly if the deal is the half that fails', () => {
    expect(src).toContain('Their records were updated, but the deal did not close')
  })
})
