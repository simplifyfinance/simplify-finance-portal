import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { boxesFor, owedOnProperty, isBeingDischarged, firstDischargedBalance } from './security-figures'
import { BEING_PURCHASED } from './securities'

// THE BOXES SHOW WHAT THE DEAL ALREADY SAYS.
//
// 29 Oct 2026. Fabio, on the securities block of the Mawing deal: "owes now
// releasing still blank???"
//
// They were blank on a deal that holds every one of their figures. The house
// owes $700,000, on a loan the fact find marks Refinance, and $920,000 is being
// lent against it - which the row was already printing as "drawn $920,000" two
// columns across.
//
// Invented clients. The figures are Fabio's.

const FORM = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

const ff = { properties: [
  { id: 'p1', address: '35/10 Goodwin St, Narrabeen', value: '1,150,000',
    loans: [{ lenderName: 'ANZ', balance: '700,000', status: 'Refinance' }] },
] }

const bc = { template: 'investment_equity', securityIds: ['p1'], splits: [
  { label: 'Existing loan refinanced', amount: '700,000', securityId: 'p1' },
  { label: 'Equity access', amount: '220,000', securityId: 'p1' },
  { label: 'New purchase', amount: '1,310,000', securityId: BEING_PURCHASED },
] }

describe('THE THREE FIGURES', () => {
  const box = boxesFor(bc, ff, 'p1')

  it('owes now is the loan that goes at settlement', () => {
    expect(box.owes).toBe(700000)
  })

  it('releasing is what is lent beyond it', () => {
    expect(box.releasing).toBe(220000)
  })

  it('and the new limit is the two together', () => {
    expect(box.limit).toBe(920000)
    expect(box.owes + box.releasing).toBe(box.limit)
  })

  it('and the purchase is not folded into any of them', () => {
    expect(box.limit).not.toBe(2230000)
  })
})

describe('WHICH LOANS GO AT SETTLEMENT', () => {
  it('the two the fact find actually offers', () => {
    expect(isBeingDischarged('Refinance')).toBe(true)
    expect(isBeingDischarged('To be paid out')).toBe(true)
    expect(isBeingDischarged('Ongoing')).toBe(false)
    expect(isBeingDischarged('')).toBe(false)
  })

  it('AND THE PHRASE THAT HAS NEVER ONCE BEEN WRITTEN', () => {
    // The deal-level Existing loan balance auto-fill waited for exactly this
    // and the dropdown has never offered it. Still accepted, because a deal
    // somewhere may carry it, but it is no longer the only thing that counts.
    expect(isBeingDischarged('To be refinanced')).toBe(true)
  })

  it('and two loans on one house are added up', () => {
    expect(owedOnProperty({ loans: [
      { balance: '400,000', status: 'Refinance' },
      { balance: '120,000', status: 'To be paid out' },
      { balance: '90,000', status: 'Ongoing' },
    ] })).toBe(520000)
  })

  it('and a house with no loans owes nothing', () => {
    expect(owedOnProperty({})).toBe(0)
    expect(owedOnProperty(null)).toBe(0)
  })
})

describe('AND NOTHING IS INVENTED', () => {
  it('a house with nothing against it shows nothing', () => {
    const box = boxesFor({ splits: [] }, { properties: [{ id: 'p1' }] }, 'p1')
    expect(box).toEqual({ owes: 0, releasing: 0, limit: 0 })
  })

  it('a house owing more than is being lent does not show a negative release', () => {
    const tight = { splits: [{ amount: '500,000', securityId: 'p1' }] }
    expect(boxesFor(tight, ff, 'p1').releasing).toBe(0)
  })

  it('and an id nobody passed does not throw', () => {
    expect(() => boxesFor(bc, ff, '')).not.toThrow()
    expect(boxesFor(bc, ff, 'nobody')).toEqual({ owes: 0, releasing: 0, limit: 0 })
  })
})

describe('THE DEAL-LEVEL BOX IS FILLED BY THE SAME ANSWER', () => {
  it('and it reads the words the fact find actually writes', () => {
    expect(firstDischargedBalance(ff.properties)).toBe('700,000')
  })

  it('and finds nothing where every loan is staying', () => {
    expect(firstDischargedBalance([{ loans: [{ balance: '90,000', status: 'Ongoing' }] }])).toBe('')
    expect(firstDischargedBalance(null)).toBe('')
  })

  it('AND THE FORM NO LONGER WAITS FOR A PHRASE NOBODY WRITES', () => {
    expect(FORM).not.toContain("=== 'To be refinanced'")
    expect(FORM).toContain('firstDischargedBalance(ff.properties)')
  })
})

describe('AND THE SCREEN SHOWS THEM WITHOUT STORING THEM', () => {
  it('as a placeholder on each of the three boxes', () => {
    expect(FORM).toContain('placeholder={ghost(known.owes)}')
    expect(FORM).toContain('placeholder={ghost(known.releasing)}')
    expect(FORM).toContain('placeholder={ghost(known.limit)}')
  })

  it('and a nought is not shown at all, because a $0 reads as an answer', () => {
    expect(FORM).toContain('n > 0 ? formatNumber(String(Math.round(n))) : undefined')
  })

  it('AND NOTHING WRITES THEM INTO THE RECORD', () => {
    // A copy in a box goes a version behind the fact find the moment a balance
    // is corrected. The typed box still wins the instant somebody types.
    expect(FORM).not.toContain('setSecurityBalances({ ...securityBalances, [String(p.id)]: ghost')
    expect(FORM).not.toContain('[String(p.id)]: known.')
    // The only place the derived figures appear is as a placeholder.
    expect((FORM.match(/known\.(owes|releasing|limit)/g) || []).length).toBe(3)
  })
})
