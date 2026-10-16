import { describe, it, expect } from 'vitest'
import { estimatedRepayment } from './email-figures'
import { readFileSync } from 'fs'

// The address and the existing loan are the BROKER'S boxes on the BC, and the
// portal does not fill them in for him - it tells him they are empty before he
// sends. See lib/bc-ready.ts. What lives here is the one figure that is pure
// arithmetic on numbers he has already typed.

describe('what it costs a month', () => {
  it('works out an interest only repayment', () => {
    expect(estimatedRepayment('506,514', '6.14', '30', 'Interest only')).toBe('$2,592')
  })

  it('and needs no term to do it - it is the rate on the balance', () => {
    expect(estimatedRepayment('506,514', '6.14', '', 'Interest only')).toBe('$2,592')
    expect(estimatedRepayment('506,514', '6.14', '30', 'IO')).toBe('$2,592')
  })

  // 16 Oct 2026. This used to return $3,083 for the same numbers on P&I.
  //
  // Fabio: "I was very specific that only IO repayments are to be calculated,
  // why are you calculating P&I repayments?" He was, twice - 16 Sep, "our typed
  // repayments take over never calculate repayments", and 15 Oct, "if I select
  // IO calculate IO repayments there as well".
  //
  // Interest only is balance x rate / 12 and has one answer. A P&I repayment
  // depends on the term, the interest only period in front of it, and how the
  // lender amortises - so the portal's figure and the bank's disagree, and
  // somebody then has to decide which of two numbers on one screen is real.
  it('refuses principal and interest, however complete the figures are', () => {
    expect(estimatedRepayment('506,514', '6.14', '30', 'P&I')).toBe('')
    expect(estimatedRepayment('506,514', '6.14', '360', 'Principal and interest')).toBe('')
    expect(estimatedRepayment('506,514', '6.14', '30', '')).toBe('')
  })

  it('says nothing when it cannot work one out', () => {
    expect(estimatedRepayment('', '6.14', '30', 'Interest only')).toBe('')
    expect(estimatedRepayment('506,514', '', '30', 'Interest only')).toBe('')
  })
})

// THE RULE, WHERE IT IS ACTUALLY APPLIED. One function answers this, so there
// is nowhere else for a P&I figure to come from - the BC's repayment prefill,
// the lending options' lender splits, the client email and the alternative
// scenarios all read it. Both of the first two were added in the same week and
// both wrote calculated P&I into a box a broker types in.
describe('nothing else works out a repayment of its own', () => {
  it('only this file does the arithmetic', () => {
    const { readFileSync } = require('fs')
    const files = ['app/(app)/deals/[id]/BCForm.tsx', 'app/(app)/deals/[id]/LOForm.tsx',
                   'lib/alt-scenario.ts', 'app/api/generate-email/route.ts']
    for (const f of files) {
      const src = readFileSync(f, 'utf8').replace(/\/\/[^\n]*/g, '')
      expect(src, `${f} works out its own P&I repayment`).not.toContain('monthlyRepaymentPI(')
    }
  })

  // THE ONE EXCEPTION, AND IT NEVER WRITES. lib/split-cards.ts keeps the P&I
  // arithmetic for repaymentMismatch, which warns when a TYPED figure lands on
  // the other repayment type's answer - Arvind's $3,445 on a split marked
  // interest only. One use, inside that check, and no second one creeping in
  // to fill a box with it.
  it('except the check that warns a typed figure looks like the other type', () => {
    const src = readFileSync('lib/split-cards.ts', 'utf8').replace(/\/\/[^\n]*/g, '')
    expect((src.match(/monthlyRepaymentPI\(/g) || []).length).toBe(1)
    expect(src).toContain('export function repaymentMismatch')
  })
})
