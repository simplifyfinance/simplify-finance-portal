// "YES CHECK YEAR AND MONTHS IF IT IS PI OR IO." — Fabio, 17 Nov 2026.
//
// A CBA schedule says "30 years". A Bankwest one says "360 months". Compared as
// written, every contract stating months would flag against every handover
// stating years, on every deal in the book.
import { describe, it, expect } from 'vitest'
import { readMonths, termWords, sameTerm, readRepayment, repaymentWords } from './years-and-months'

describe('a term, in months, however it was written', () => {
  it('years', () => {
    expect(readMonths('30 years')).toBe(360)
    expect(readMonths('30yr')).toBe(360)
    expect(readMonths('30 y')).toBe(360)
  })

  it('months', () => {
    expect(readMonths('360 months')).toBe(360)
    expect(readMonths('360 mths')).toBe(360)
  })

  it('and both together', () => {
    expect(readMonths('29 years 6 months')).toBe(354)
    expect(readMonths('29y 6m')).toBe(354)
  })

  // EVERY TERM BOX IN THIS PORTAL IS IN YEARS, and a bare 30 has never meant
  // thirty months.
  it('a bare number is years', () => {
    expect(readMonths('30')).toBe(360)
    expect(readMonths(30)).toBe(360)
  })

  // A LOAN WITH NO TERM AND A LOAN OF NOUGHT MONTHS ARE NOT THE SAME THING,
  // and one of them does not exist.
  it('and nothing recorded is null, never nought', () => {
    expect(readMonths('')).toBe(null)
    expect(readMonths(null)).toBe(null)
    expect(readMonths('as agreed')).toBe(null)
    expect(readMonths('0')).toBe(null)
  })
})

// THE WHOLE POINT. A check that cries wolf on half the book is a check the
// team turns off in a fortnight.
describe('the same term written two ways is not a difference', () => {
  it('360 months is 30 years', () => {
    expect(sameTerm('360 months', '30 years')).toBe(true)
    expect(sameTerm('30 years', '30')).toBe(true)
  })

  it('and a real difference still is one', () => {
    expect(sameTerm('25 years', '30 years')).toBe(false)
    expect(sameTerm('354 months', '30 years')).toBe(false)
  })

  // A GAP IS REPORTED AS A GAP, not as the contract disagreeing with the deal.
  it('nothing recorded on either side is not a disagreement', () => {
    expect(sameTerm('', '30 years')).toBe(true)
    expect(sameTerm('30 years', '')).toBe(true)
  })
})

describe('months back into words', () => {
  it('reads the way a person would say it', () => {
    expect(termWords(360)).toBe('30 years')
    expect(termWords(354)).toBe('29 years 6 months')
    expect(termWords(12)).toBe('1 year')
    expect(termWords(1)).toBe('1 month')
  })

  it('and nothing is nothing', () => {
    expect(termWords(0)).toBe('')
    expect(termWords(null)).toBe('')
  })
})

describe('principal and interest, or interest only', () => {
  it('however the lender wrote it', () => {
    for (const io of ['Interest Only', 'IO', 'interest-only', 'I/O repayments']) {
      expect(readRepayment(io), io).toBe('IO')
    }
    for (const pi of ['Principal and Interest', 'P&I', 'P & I', 'principal & interest']) {
      expect(readRepayment(pi), pi).toBe('PI')
    }
  })

  it('and nobody saying is null, not a guess at the commoner one', () => {
    expect(readRepayment('')).toBe(null)
    expect(readRepayment('repayments monthly')).toBe(null)
    expect(readRepayment(null)).toBe(null)
  })

  it('written back out with how long it is interest only for', () => {
    expect(repaymentWords('IO', 60)).toBe('Interest only — 5 years')
    expect(repaymentWords('IO', 18)).toBe('Interest only — 1 year 6 months')
    expect(repaymentWords('IO', null)).toBe('Interest only')
    expect(repaymentWords('PI', 60)).toBe('Principal & interest')
    expect(repaymentWords(null, 60)).toBe('')
  })
})
