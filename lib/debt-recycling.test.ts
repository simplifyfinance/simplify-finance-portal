import { describe, it, expect } from 'vitest'
import {
  isDebtRecycling, purposeOf, purposeLabel, purposeLine, fundsUsedFor,
  splitsTotal, totalLimit, limitCheck, byPurpose, everySplitHasAPurpose,
  whySplitThisWay, openingLine, ACCOUNTANT_NOTE, complianceLines, undrawnNote,
  offsetSplitLabels,
} from './debt-recycling'

// THE WORKED EXAMPLE Fabio was shown on 1 Oct 2026 and said "love it" to.
// $1,000,000 today, $1,000,000 after, split three ways by purpose.
const bc = {
  template: 'debt_recycling',
  existingLoanBal: '1,000,000',
  totalLimit: '1,000,000',
  splits: [
    { label: 'Home', amount: '620,000', rate: '6.14', type: 'P&I',
      purpose: 'owner_occupied', repayment: '3,773' },
    { label: 'Investment property', amount: '300,000', rate: '6.39', type: 'Interest only',
      purpose: 'investment', fundsUsedFor: 'purchase 12 Example Road', repayment: '1,598' },
    { label: 'Share portfolio', amount: '80,000', rate: '6.39', type: 'Interest only',
      purpose: 'investment', fundsUsedFor: 'purchase listed shares', repayment: '426' },
  ],
}

describe('the purpose of a split', () => {
  it('reads the two we offer', () => {
    expect(purposeOf(bc.splits[0])).toBe('owner_occupied')
    expect(purposeLabel(purposeOf(bc.splits[1]))).toBe('Investment')
  })

  // THE GUARD THAT MATTERS. A default would print "Owner-occupied" against a
  // split nobody has labelled, in an email, to a client.
  it('and never guesses one that is not there', () => {
    expect(purposeOf({ amount: '100,000' })).toBe('')
    expect(purposeOf({ purpose: 'deductible' })).toBe('')
    expect(purposeLine({ amount: '100,000', fundsUsedFor: 'buy shares' })).toBe('')
  })

  it('says what the funds did when somebody has written it down', () => {
    expect(purposeLine(bc.splits[1])).toBe('Investment — funds used to purchase 12 Example Road')
    expect(purposeLine(bc.splits[0])).toBe('Owner-occupied')
    expect(fundsUsedFor(bc.splits[0])).toBe('')
  })
})

describe('the limit is the container', () => {
  it('adds the splits up', () => {
    expect(splitsTotal(bc)).toBe(1000000)
    expect(totalLimit(bc)).toBe(1000000)
  })

  it('and says so plainly when they fill it', () => {
    const c = limitCheck(bc)
    expect(c.matches).toBe(true)
    expect(c.words).toBe('Splits total $1,000,000 — matches the limit.')
  })

  it('names the gap, both ways, in dollars', () => {
    const over = limitCheck({ ...bc, totalLimit: '950,000' })
    expect(over.matches).toBe(false)
    expect(over.difference).toBe(50000)
    expect(over.words).toBe('Splits total $1,000,000, and the limit is $950,000 — $50,000 over.')

    const short = limitCheck({ ...bc, totalLimit: '1,100,000' })
    expect(short.difference).toBe(-100000)
    expect(short.words).toContain('$100,000 short.')
  })

  it('treats a dollar of rounding as a match, not a fault', () => {
    expect(limitCheck({ ...bc, totalLimit: '1,000,000.40' }).matches).toBe(true)
  })

  // No limit typed is not a mismatch. There is nothing to disagree with.
  it('and falls back to the splits when no limit is typed', () => {
    const none = { ...bc, totalLimit: '' }
    expect(totalLimit(none)).toBe(1000000)
    expect(limitCheck(none).matches).toBe(true)
    expect(limitCheck(none).words).toBe('Splits total $1,000,000.')
  })
})

describe('what moves, by purpose', () => {
  it('splits the limit the way the purposes do', () => {
    const p = byPurpose(bc)
    expect(p.ownerOccupied).toBe(620000)
    expect(p.investment).toBe(380000)
    expect(p.complete).toBe(true)
    expect(p.ownerOccupied + p.investment).toBe(splitsTotal(bc))
  })

  // HALF A PICTURE IS WORSE THAN NONE. $300,000 of investment purpose printed
  // under a structure holding $380,000 of it is a figure a client plans around.
  it('and refuses to be complete while a split has no purpose on it', () => {
    const d = { ...bc, splits: [...bc.splits, { label: 'Fourth', amount: '50,000' }] }
    const p = byPurpose(d)
    expect(p.unassigned).toBe(50000)
    expect(p.complete).toBe(false)
    expect(everySplitHasAPurpose(d)).toBe(false)
    expect(everySplitHasAPurpose(bc)).toBe(true)
  })

  it('ignores the empty split rows the form always carries', () => {
    const d = { ...bc, splits: [...bc.splits, { label: '', amount: '', rate: '' }] }
    expect(everySplitHasAPurpose(d)).toBe(true)
    expect(splitsTotal(d)).toBe(1000000)
  })
})

describe('the words the client reads', () => {
  it('says the total is unchanged only when it is', () => {
    expect(openingLine(bc)).toContain('does not change')
    const more = { ...bc, totalLimit: '1,280,000' }
    expect(openingLine(more)).not.toContain('does not change')
    expect(openingLine(more)).toContain('$1,280,000')
  })

  it('explains the structure from the structure, not from a script', () => {
    const lines = whySplitThisWay(bc)
    expect(lines.join(' ')).toContain('one purpose and nothing else')
    expect(lines.join(' ')).toContain('interest only')

    // All P&I, so the interest-only sentence would be a lie.
    const pi = { ...bc, splits: bc.splits.map(s => ({ ...s, type: 'P&I' })) }
    expect(whySplitThisWay(pi).join(' ')).not.toContain('interest only')
  })

  // THE SENTENCE THAT CARRIES THE CALL FABIO MADE.
  //
  // 1 Oct 2026 he read the flag - credit licence, not a tax agent - and decided:
  // "say deductible to client as long as disclaimer is there htta we are not
  // giving tax advice". So the note may use the word, and three things have to
  // be true of it every time somebody edits it.
  it('names the condition, sends it to the accountant, and disclaims advice', () => {
    const n = ACCOUNTANT_NOTE
    // 1. It is conditional, never a statement that the money IS deductible.
    expect(n).toContain('depends on your own circumstances')
    // 2. It names who decides.
    expect(n).toContain('accountant')
    // 3. It says what this is not, in his words.
    expect(n).toContain('This is not tax advice.')
  })

  // Deductibility is said in ONE place - the note - and nowhere else. A split's
  // own line says what the money was used for, which is a fact about the loan.
  it('and nothing else in the email claims a tax treatment', () => {
    const elsewhere = [openingLine(bc), ...whySplitThisWay(bc),
                       purposeLine(bc.splits[1]), purposeLabel('investment')].join(' ')
    expect(elsewhere.toLowerCase()).not.toContain('deductib')
    expect(elsewhere.toLowerCase()).not.toContain('tax benefit')
  })
})

describe('the scenario knows its own name', () => {
  it('and nothing else answers to it', () => {
    expect(isDebtRecycling('debt_recycling')).toBe(true)
    expect(isDebtRecycling('refinance_equity')).toBe(false)
    expect(isDebtRecycling('')).toBe(false)
  })
})

describe('the part of the limit nobody draws', () => {
  it('is named, so the column adds up', () => {
    expect(undrawnNote({ ...bc, totalLimit: '1,100,000' }))
      .toBe('$100,000 of the limit above is not drawn at settlement and remains available.')
  })

  it('and there is nothing to say when the splits fill it', () => {
    expect(undrawnNote(bc)).toBe('')
    expect(undrawnNote({ ...bc, totalLimit: '900,000' })).toBe('')
    expect(undrawnNote({ ...bc, totalLimit: '' })).toBe('')
  })
})

describe('what goes on the compliance file', () => {
  it('states the restructure, the purposes and the accountant', () => {
    const lines = complianceLines(bc).join(' ')
    expect(lines).toContain('restructures the lending into a facility of $1,000,000')
    expect(lines).toContain('3 separate splits')
    expect(lines).toContain('$620,000 is for owner-occupied purposes')
    expect(lines).toContain('$380,000 relates to funds used for investment purposes')
    expect(lines).toContain('No taxation advice has been provided by Simplify Finance.')
  })

  // Fabio, 1 Oct 2026: "remove this The total borrowing is unchanged; in case we
  // need to increase or reduce". A restructure that also raises or lowers the
  // facility is normal, and the sentence must be true of all three.
  it('never claims the borrowing is unchanged, whichever way the limit moved', () => {
    for (const limit of ['1,000,000', '1,280,000', '900,000']) {
      const lines = complianceLines({ ...bc, totalLimit: limit }).join(' ')
      expect(lines.toLowerCase(), `claims unchanged at ${limit}`).not.toContain('unchanged')
      expect(lines).toContain(`facility of $${limit}`)
      // The two-branch version it replaced read "into a facility of $X into 3".
      expect(lines).not.toContain('into 3 separate')
    }
  })

  // The accountant sentence is the one that does not depend on anything being
  // filled in. It is on the file either way.
  it('and says the accountant line even when the purposes are not all recorded', () => {
    const half = { ...bc, splits: [...bc.splits, { label: 'Fourth', amount: '50,000' }] }
    const lines = complianceLines(half).join(' ')
    expect(lines).not.toContain('is for owner-occupied purposes')
    expect(lines).toContain('No taxation advice has been provided by Simplify Finance.')
  })

  it('says nothing at all on a scenario with no splits yet', () => {
    expect(complianceLines({ template: 'debt_recycling', splits: [] })).toEqual([])
  })
})

describe('where the offsets sit', () => {
  const one = { ...bc, offsetSplits: ['Home'] }
  const two = { ...bc, offsetSplits: ['Home', 'Share portfolio'] }

  it('names the one, in the singular', () => {
    expect(offsetSplitLabels(one)).toEqual(['Home'])
    expect(whySplitThisWay(one).join(' '))
      .toContain('Your offset account sits against Home,')
    expect(complianceLines(one).join(' '))
      .toContain('An offset account has been placed against Home only.')
  })

  // "the Home and Equity split splits" is what appending the word produced on a
  // complex refinance, because a label may contain it already.
  it('and names them all, in the plural, with no noun bolted on', () => {
    expect(whySplitThisWay(two).join(' '))
      .toContain('Your offset accounts sit against Home and Share portfolio,')
    expect(complianceLines(two).join(' '))
      .toContain('Offset accounts have been placed against Home and Share portfolio.')
  })

  // Named in the order the splits are in, because the email lists them beside
  // figures that are already in that order.
  it('in the order the splits are in, not the order they were ticked', () => {
    expect(offsetSplitLabels({ ...bc, offsetSplits: ['Share portfolio', 'Home'] }))
      .toEqual(['Home', 'Share portfolio'])
  })

  it('ignores a name ticked twice', () => {
    expect(offsetSplitLabels({ ...bc, offsetSplits: ['Home', 'Home'] })).toEqual(['Home'])
  })

  // The single value shipped on the morning of 1 Oct 2026. A deal saved in the
  // hour before this change has to keep saying the same thing.
  it('still reads the single value that shipped before it', () => {
    expect(offsetSplitLabels({ ...bc, offsetSplit: 'Home' })).toEqual(['Home'])
  })

  it('and nothing is said while nobody has ticked anything', () => {
    expect(offsetSplitLabels(bc)).toEqual([])
    expect(whySplitThisWay(bc).join(' ').toLowerCase()).not.toContain('offset')
    expect(complianceLines(bc).join(' ').toLowerCase()).not.toContain('offset')
  })

  // A SPLIT THAT NO LONGER ANSWERS TO THE NAME. Renamed or removed, the stored
  // label would otherwise have the email naming an account that is not there.
  it('goes quiet when a split it named is gone', () => {
    const renamed = { ...two, splits: bc.splits.map(x => ({ ...x, label: x.label + ' loan' })) }
    expect(offsetSplitLabels(renamed)).toEqual([])
    expect(complianceLines(renamed).join(' ').toLowerCase()).not.toContain('offset')
  })
})
