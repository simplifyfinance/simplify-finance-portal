import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { PLEDGE_PROS, PLEDGE_CONS, PLEDGE_LOAN_1, PLEDGE_LOAN_2, GUARANTORS, guarantorPhrase } from './family-pledge-copy'

// THE FAMILY PLEDGE EMAIL.
//
// 15 Sep 2026. This template printed splits[0] and nothing else. Your team
// records two splits on every family pledge - the main loan and the pledge
// portion - so the part that IS the family pledge never reached the client, and
// the headline said "your borrowing capacity is sitting at around $408,000"
// when the two together were $527,500. Every one that has gone out understated
// the loan.
//
// The pros and cons were never in the portal at all. They came back off an old
// email Fabio had sent by hand.

describe('the wording is his, not mine', () => {
  it('keeps "your parent\'s" exactly as he wrote it', () => {
    // Not a typo to fix. It goes to a client and it is his to change.
    expect(PLEDGE_PROS[2]).toContain("your parent's current interest rates")
    expect(PLEDGE_LOAN_2).toContain("guaranteed by your parent's property")
  })

  it('keeps the first con as ONE bullet, both sentences together', () => {
    // I split it in two the first time. He put it back.
    expect(PLEDGE_CONS[0]).toContain('signing a legal contract to repay the guaranteed amount.')
    expect(PLEDGE_CONS[0]).toContain('the bank will seek to recover the debt from you first')
    expect(PLEDGE_CONS).toHaveLength(3)
  })

  it('has four pros and three cons', () => {
    expect(PLEDGE_PROS).toHaveLength(4)
    expect(PLEDGE_CONS).toHaveLength(3)
  })

  it('says who is responsible for each loan', () => {
    expect(PLEDGE_LOAN_1).toBe('This loan is in your name, and you are responsible to make repayments.')
    expect(PLEDGE_LOAN_2.startsWith('This loan is in your name, and you are responsible to make repayments, however,')).toBe(true)
  })
})

describe('the guarantor, dropped into a sentence', () => {
  it('offers the four he confirmed', () => {
    expect(GUARANTORS).toEqual(['Your parents', 'Your mother', 'Your father', 'Your parents-in-law'])
  })

  it('reads properly mid-sentence', () => {
    expect(guarantorPhrase('Your parents')).toBe("your parents'")
    expect(guarantorPhrase('Your mother')).toBe("your mother's")
    expect(guarantorPhrase('Your father')).toBe("your father's")
    expect(guarantorPhrase('Your parents-in-law')).toBe("your parents-in-law's")
  })

  it('keeps a typed name capitalised', () => {
    expect(guarantorPhrase('John and Mary Smith')).toBe("John and Mary Smith's")
    expect(guarantorPhrase('James Rogers')).toBe("James Rogers'")
  })

  it('still reads properly when nobody has chosen one', () => {
    expect(guarantorPhrase('')).toBe("your parents'")
    expect(guarantorPhrase('   ')).toBe("your parents'")
  })
})

describe('the email itself', () => {
  const src = () => readFileSync('app/api/generate-email/route.ts', 'utf8')
  const branch = () => {
    const s = src()
    const from = s.indexOf("template === 'family_pledge'")
    const to = s.indexOf("template === 'smsf'", from)
    expect(from, 'the family pledge branch has gone').toBeGreaterThan(-1)
    return s.slice(from, to)
  }

  it('PRINTS BOTH SPLITS, NOT JUST THE FIRST', () => {
    const b = branch()
    expect(b).toContain('d.splits?.[0]')
    expect(b, 'the pledge split is missing from the email again').toContain('d.splits?.[1]')
  })

  it('HEADLINES THE WHOLE LOAN, NOT ONE SPLIT', () => {
    const b = branch()
    expect(b).toContain('totalLending(d.splits)')
    expect(b).toMatch(/borrowing capacity is sitting at around[^\n]*money\(lending\)/)
  })

  it('carries the pros and the cons', () => {
    const b = branch()
    expect(b).toContain('PLEDGE_PROS')
    expect(b).toContain('PLEDGE_CONS')
  })

  it('puts the guarantee sentence on loan 2', () => {
    const b = branch()
    expect(b).toMatch(/pledgeLoan\('Loan 1', d\.splits\?\.\[0\][^\n]*PLEDGE_LOAN_1/)
    expect(b).toMatch(/pledgeLoan\('Loan 2', d\.splits\?\.\[1\][^\n]*PLEDGE_LOAN_2/)
  })

  it('asks for the contribution by the name this template uses', () => {
    expect(branch()).toContain('Your contribution required (coming from own savings)')
  })
})

describe('the box that had nowhere to type', () => {
  it('the family pledge template shows a contribution box', () => {
    // The deposit box was hidden here while the email printed it AND the
    // "what is missing" check asked for it.
    const bc = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
    expect(bc).toContain("Contribution required (from own savings)")
    expect(bc).toMatch(/template === 'family_pledge' && \(\s*\n\s*<Field label="Contribution required/)
  })

  it('the guarantor is a list, not a typed name', () => {
    const bc = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')
    expect(bc).toContain('GUARANTORS.map')
    expect(bc).toContain("Other — type it")
  })
})
