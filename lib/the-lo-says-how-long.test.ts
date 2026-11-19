import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// THE LENDING OPTIONS EMAIL SAYS HOW LONG.
//
// 19 Nov 2026. Mark Gallo, of a three-lender comparison that had gone to a
// client: "Is it possible to get loan terms and interest only terms added to
// the LO?"
//
// Both facts were already on the deal and neither was in the email. A client
// was reading three columns of monthly figures with nothing saying that one of
// them only lasts five years and then rises.
//
// WHERE EACH ONE COMES FROM, and neither is new:
//   the IO years   the lender's own split. They have to be per lender and per
//                  split - a home loan on P&I beside an investment split on IO
//                  is two answers to one question. See lib/lo-splits.ts.
//   the term       the borrowing capacity's split, falling back to the one
//                  term the BC holds for the whole deal. The LO prices the
//                  structure; it does not own how long the loan runs.
//
// WHY THE TERM IS ON THE GREY LINE. Fabio, shown it on the headline: "it's
// just too much wording". Four things on one line in a column a third of an
// email wide wraps, and a wrapped line reads as broken.
//
//   End Debt
//   $485,000 · 6.54% · P&I
//   $3,079 / month · 30 yr term
//
//   Split 2
//   $250,000 · 6.84% · IO 5 yrs
//   $1,456 / month · 30 yr term

const ROUTE = readFileSync('app/api/generate-lo-email/route.ts', 'utf8')

describe('the interest only years are on the split', () => {
  it('read off the lender’s own split, not off a rate module', () => {
    expect(ROUTE).toContain('const io = txt(sp.ioYears)')
  })

  it('and only where the split actually is interest only', () => {
    expect(ROUTE).toContain('/io|interest only/i.test(txt(sp.repaymentType)) && io')
  })

  it('one year is a year, not 1 yrs', () => {
    expect(ROUTE).toContain("io === '1' ? 'yr' : 'yrs'")
  })
})

describe('the term is the borrowing capacity’s answer', () => {
  it('per split, falling back to the one the BC holds for the deal', () => {
    expect(ROUTE).toContain("return txt(own?.termYears) || txt(loanTerm)")
  })

  it('read live off bcData, never copied onto the lending options', () => {
    // The stale-copy fault this codebase spent 8 Oct undoing on the loan
    // amount. See the note at the top of the handler.
    expect(ROUTE).toContain("bcData?.splits || [], bcData?.loanTerm || ''")
  })
})

describe('what the cell draws', () => {
  it('three things on the headline, never four', () => {
    expect(ROUTE).toContain("const line2 = [sp.rate ? `${sp.rate}%` : '', type]")
  })

  it('and the term rides with the repayment it qualifies', () => {
    expect(ROUTE).toContain("term ? `${term} yr term` : ''")
  })

  it('a split with neither still draws, rather than leaving an empty line', () => {
    expect(ROUTE).toContain('under ? `<p style="font-size:11px;color:#777777;margin:0">')
  })
})
