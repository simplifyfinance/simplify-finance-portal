import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { canHaveManySecurities, isComplexRefinance } from './complex-refinance'

// 15 Oct 2026. "I would like to add the ability of adding another property into
// the template ... and then under the loan split sections, we will then tag
// which property relates to which. We had this already done in the complex
// scenario." It was. This is that, turned on for Equity release + purchase.

describe('which scenarios can be secured by more than one house', () => {
  it('equity release + purchase can, which is the whole change', () => {
    expect(canHaveManySecurities('investment_equity')).toBe(true)
  })

  it('complex refinance still can', () => {
    expect(canHaveManySecurities('complex_refinance')).toBe(true)
  })

  it('a straight purchase cannot - there is one house and it is being bought', () => {
    expect(canHaveManySecurities('oo_purchase')).toBe(false)
    expect(canHaveManySecurities('investment_purchase')).toBe(false)
    expect(canHaveManySecurities('fhb')).toBe(false)
  })

  it('and it is not the same question as "is this complex refinance"', () => {
    expect(isComplexRefinance('investment_equity')).toBe(false)
  })

  it('survives nothing at all', () => {
    expect(canHaveManySecurities(null)).toBe(false)
    expect(canHaveManySecurities('')).toBe(false)
  })
})

describe('the screen asks this one question, not the old one', () => {
  const src = readFileSync('app/(app)/deals/[id]/BCForm.tsx', 'utf8')

  it('the securities block and the per-split Security box read the same answer', () => {
    // Three now: the securities block, the per-split Security box, and the
    // `manySecurities` flag that hides the single-property figures. If one is
    // left on isComplexRefinance you can tick securities and then have nowhere
    // to point a split at them.
    const gates = src.match(/canHaveManySecurities\(template\)/g) || []
    expect(gates.length, 'every gate must ask the same question').toBe(3)
  })

  it('and the per-property figures replace the single set', () => {
    // One Existing loan balance under two ticked houses belonged to neither.
    expect(src).toContain('securityBalances')
    expect(src).toContain('securityReleases')
    expect(src).toContain('const manySecurities =')
  })

  it('and the heading says which property the figures are about', () => {
    expect(src).toContain("'Property being refinanced'")
  })
})
