import { describe, it, expect } from 'vitest'
import { estimatedRepayment } from './email-figures'

// The address and the existing loan are the BROKER'S boxes on the BC, and the
// portal does not fill them in for him - it tells him they are empty before he
// sends. See lib/bc-ready.ts. What lives here is the one figure that is pure
// arithmetic on numbers he has already typed.

describe('what it costs a month', () => {
  // $506,514 at 6.14% over 30 years, principal and interest.
  it('works out a principal and interest repayment', () => {
    expect(estimatedRepayment('506,514', '6.14', '30', 'P&I')).toBe('$3,083')
  })

  it('works out an interest only repayment', () => {
    expect(estimatedRepayment('506,514', '6.14', '30', 'Interest only')).toBe('$2,592')
  })

  it('counts the term in years, not months', () => {
    // 30 handed straight to a function expecting months gives about $34,000.
    const n = Number(estimatedRepayment('506,514', '6.14', '30', 'P&I').replace(/[^0-9]/g, ''))
    expect(n).toBeGreaterThan(2500)
    expect(n).toBeLessThan(4000)
  })

  it('says nothing when it cannot work one out', () => {
    expect(estimatedRepayment('', '6.14', '30', 'P&I')).toBe('')
    expect(estimatedRepayment('506,514', '', '30', 'P&I')).toBe('')
    expect(estimatedRepayment('506,514', '6.14', '', 'P&I')).toBe('')
    // Interest only needs no term.
    expect(estimatedRepayment('506,514', '6.14', '', 'Interest only')).toBe('$2,592')
  })
})
