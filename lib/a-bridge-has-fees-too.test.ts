import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// A BRIDGE HAS FEES TOO.
//
// 30 Oct 2026, the audit Fabio asked for after the Bankwest settlement fee:
// "all I'm asking you is to audit to make sure this is not happening anywhere
// else."
//
// It was, and worse. On a bridging deal the lending options screen shows eight
// fee boxes - application, annual, valuation, settlement, rate lock, early
// repayment, discharge, offset - all auto-filled from the library and all
// editable. The email's bridging branch printed none of them. It printed the
// rate, the term, "interest only capitalised" and the three fees that belong to
// a bridge: establishment, monthly loan account, document processing.
//
// A broker filled in eight fees and the client saw none. The same fault as the
// settlement fee, on every fee, every time.
//
// WHY NOBODY SAW IT: the fee lines were written inside the "not bridging" half
// of the email, so there was nothing to compare the bridge against.

const ROUTE = readFileSync('app/api/generate-lo-email/route.ts', 'utf8')
const LO = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')

describe('ONE FEE LIST, BOTH SHAPES OF EMAIL', () => {
  it('the fees are written once', () => {
    expect(ROUTE).toContain('function feeCells(list: any[], skipMonthly = false)')
    expect((ROUTE.match(/Application fee: /g) || []).length).toBe(1)
    expect((ROUTE.match(/Discharge fee: /g) || []).length).toBe(1)
  })

  it('AND A BRIDGE PRINTS THEM', () => {
    const bridge = ROUTE.slice(ROUTE.indexOf('if (isBridging) {'),
                               ROUTE.indexOf('function feeCells'))
    expect(bridge).toContain('feeCells(lenders, true)')
  })

  it('and every other scenario still does', () => {
    expect(ROUTE).toContain('const feeRows = feeCells(lenders)')
  })

  it('AND THE MONTHLY FEE IS NOT SAID TWICE ON A BRIDGE', () => {
    // The bridge already prints that same box in its own words - "Monthly Loan
    // Account Fee of $15". Two wordings of one box is how a client comes to
    // think there are two of them.
    expect(ROUTE).toContain('if (l.monthlyFee && !skipMonthly)')
    expect(ROUTE).toContain('Monthly Loan Account Fee of')
  })

  it('and the bridge keeps its own three', () => {
    const bridge = ROUTE.slice(ROUTE.indexOf('if (isBridging) {'),
                               ROUTE.indexOf('function feeCells'))
    expect(bridge).toContain('Establishment Fee of')
    expect(bridge).toContain('Document Processing Fee of')
  })
})

describe('AND EVERY BOX ON THE SCREEN REACHES THE EMAIL', () => {
  // The screen shows these on every scenario, bridging included. Each one has
  // to come out the other end, or a broker fills in a figure for nobody.
  const boxes: [string, string][] = [
    ['Application fee', 'applicationFee'],
    ['Annual fee', 'annualFee'],
    ['Valuation fee', 'valuationFee'],
    ['Rate lock fee', 'rateLockFee'],
    ['Early repayment fee', 'earlyRepaymentFee'],
    ['Discharge fee', 'dischargeFee'],
    ['Offset account', 'offsetAccount'],
  ]

  it.each(boxes)('%s', (label, field) => {
    expect(LO, `${label} is not on the screen any more`).toContain(`label="${label}"`)
    expect(ROUTE, `${label} never reaches the client`).toContain(`l.${field}`)
  })

  it('and the settlement fee, which is named per lender', () => {
    expect(LO).toContain('label={rowLegalFeeLabel(lender)}')
    expect(ROUTE).toContain('rowLegalFeeLabel(l)')
  })
})
