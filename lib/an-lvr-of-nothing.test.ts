import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { securityWorth } from './complex-refinance'
import { altLvrEquity } from './alt-scenario'

// 18 Oct 2026, found by scripts/audit.sh on its second scheduled sweep - not by
// anybody looking at this file.
//
// pct() in lib/alt-scenario.ts returns 0 when it has no security value to
// divide by. propertyValue is empty on every deal whose values live on the
// securities. So the comparison column of a Refinance + equity release printed
// "LVR: 0%" to a client.
//
// AND IT TURNED A WARNING OFF. The LMI wording beside it is gated on
// lvrNum > 80, so a deal genuinely over 80% lost its LMI paragraph in silence.
// A zero that reads as "nothing owed" is bad; a zero that switches off a
// warning is the worst shape this fault takes.

const BC = {
  template: 'refinance_equity',
  securityIds: ['p1', 'p2'],
  existingLoanBal: '606,000',
  propertyValue: '',
  ffProperties: [
    { id: 'p1', address: '10 Example Road', value: '830,000' },
    { id: 'p2', address: '15 Sample Street', value: '995,000' },
    { id: 'p3', address: '2 Not Security Ave', value: '700,000' },
  ],
}

describe('what the securities are worth', () => {
  it('adds up only the ticked ones', () => {
    expect(securityWorth(BC)).toBe(1825000)
  })

  it('does not depend on a split being written against them', () => {
    // groupsOf() builds from splits; this must not. A security with no loan on
    // it yet is still the thing an LVR divides by.
    expect(securityWorth({ ...BC, splits: [] })).toBe(1825000)
  })

  it('is nothing when nobody has ticked anything, so the caller can fall back', () => {
    expect(securityWorth({ ...BC, securityIds: [] })).toBe(0)
    expect(securityWorth({})).toBe(0)
  })
})

describe('the alternative scenario LVR', () => {
  const opt = { equityReleaseAmount: '200,000' }

  it('was zero on a multi-security deal, which is what reached the client', () => {
    expect(altLvrEquity(opt, BC.existingLoanBal, BC.propertyValue).percent).toBe(0)
  })

  it('and is a real figure once it measures against the securities', () => {
    // (606,000 + 200,000) / 1,825,000
    expect(altLvrEquity(opt, BC.existingLoanBal, securityWorth(BC)).percent).toBe(44.2)
  })

  it('a single-security deal is untouched', () => {
    expect(altLvrEquity(opt, '400,000', '1,000,000').percent).toBe(60)
  })
})

describe('the email', () => {
  const SRC = readFileSync('app/api/generate-email/route.ts', 'utf8')

  it('divides by the securities, falling back to the old box', () => {
    expect(SRC).toContain('securityWorth(d) || d.propertyValue')
  })

  // AN LVR OF NOTHING IS NOT AN LVR. Even with the fix above, a deal with no
  // values recorded anywhere still comes back 0 - and 0% must never be printed
  // as though it were an answer.
  it('and prints no LVR line at all rather than a zero', () => {
    expect(SRC).toContain('${lvrNum > 0 ? `<p style="font-size:11px;color:#555;margin:3px 0">')
    expect(SRC).not.toContain('<span style="color:#555;">LVR: ${lvrNum}%</span></p>`$')
  })
})
