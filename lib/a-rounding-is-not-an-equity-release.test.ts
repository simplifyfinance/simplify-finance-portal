import { describe, it, expect } from 'vitest'
import {
  RELEASE_PCT, RELEASE_CAP, roundingAllowance, isJustRounding,
  releaseOnDeal, isEquityRelease, releaseOnBc,
} from './a-rounding-is-not-an-equity-release'
import { loanPurposeOf } from './order-a-valuation'
import { cashOut, numbersWorthSending } from './the-settlement-numbers'
import { milestoneRows } from './milestone-figures'

// A ROUNDING IS NOT AN EQUITY RELEASE.
//
// 19 Nov 2026. Fabio: "sometimes a loan 434500 and we refinance 436000 as we
// round the refinance and add an extra month of interest to avoid settlement
// shortfall. The system is treating that small amount as equity release."
//
// The line is HIS: "do 1% or 5K whichever is smaller." I had suggested three
// per cent and he was right that it was too much - three per cent of a million
// is thirty thousand, which is somebody's kitchen, not a rounding.

const refi = (loan: number, release: number) => ({
  id: 'd1',
  // isRefinance() reads the deal's own transaction type, not the template.
  transaction_type: 'refinance',
  fact_find_data: { applicants: [{ dob: '1990-01-01' }] },
  bc_data: {
    template: 'refinance_only',
    existingLoanBal: '434500',
    equityRelease: String(release),
    splits: [{ amount: String(loan) }],
  },
})

describe('where the line sits', () => {
  it('one per cent, capped at five thousand', () => {
    expect(RELEASE_PCT).toBe(0.01)
    expect(RELEASE_CAP).toBe(5000)
  })

  it('$436,000 is allowed $4,360', () => {
    expect(roundingAllowance(436_000)).toBe(4_360)
  })

  it('and a million-dollar loan is allowed $5,000, not $10,000', () => {
    // The cap is what keeps the rule honest on a big deal.
    expect(roundingAllowance(1_000_000)).toBe(5_000)
    expect(roundingAllowance(2_500_000)).toBe(5_000)
  })

  it('a loan nobody has recorded allows nothing', () => {
    expect(roundingAllowance(0)).toBe(0)
    expect(isJustRounding(1_500, 0)).toBe(false)
  })

  it('and a number that lands exactly on the line was chosen, not rounded to', () => {
    expect(isJustRounding(4_360, 436_000)).toBe(false)
    expect(isJustRounding(4_359, 436_000)).toBe(true)
  })
})

// FABIO'S OWN DEAL, THE ONE HE RANG ABOUT.
const hisDeal = refi(436_000, 1_500)
const realRelease = refi(436_000, 60_000)

describe('his deal: $434,500 paid out, $436,000 written', () => {
  it('the $1,500 is rounding, not a release', () => {
    expect(releaseOnDeal(hisDeal)).toBe(0)
    expect(isEquityRelease(hisDeal)).toBe(false)
  })

  it('and a real release on the same loan is still a release', () => {
    expect(releaseOnDeal(realRelease)).toBe(60_000)
    expect(isEquityRelease(realRelease)).toBe(true)
  })
})

describe('what stops happening to his deal', () => {
  it('the valuer is asked for a refinance, not an equity release', () => {
    const bc = hisDeal.bc_data
    const security = { id: 's1' }
    const ff = { properties: [{ id: 's1', loans: [] }] }
    expect(loanPurposeOf(security, bc, ff)).toBe('REFINANCE')
  })

  it('but a real release still reaches the valuer as one', () => {
    expect(loanPurposeOf({ id: 's1' }, realRelease.bc_data,
      { properties: [{ id: 's1', loans: [] }] })).toBe('EQUITY_RELEASE')
  })

  it('the client is not emailed a "Cash out" line about it', () => {
    const labels = milestoneRows(hisDeal).map(r => r.label)
    expect(labels).not.toContain('Cash out')
  })

  it('and the settlement numbers email does not fire', () => {
    // The spec: not sent on a dollar-for-dollar refinance. Rounded up by
    // $1,500 IS dollar for dollar as far as the client is concerned.
    expect(cashOut(hisDeal)).toBe(0)
    expect(numbersWorthSending(hisDeal)).toBe(false)
  })

  it('while a real release still sends it, with the figure on it', () => {
    expect(cashOut(realRelease)).toBe(60_000)
    expect(numbersWorthSending(realRelease)).toBe(true)
    expect(milestoneRows(realRelease).map(r => r.label)).toContain('Cash out')
  })
})

describe('not one dollar moved', () => {
  it('the loan is still the loan', () => {
    const rows = milestoneRows(hisDeal)
    const loan = rows.find(r => r.label === 'Loan amount')
    expect(loan?.value).toContain('436,000')
  })

  it('and the balance being refinanced is still printed', () => {
    expect(milestoneRows(hisDeal).map(r => r.label))
      .toContain('Balance being refinanced')
  })
})

describe('a borrowing capacity on its own works the loan out itself', () => {
  it('from its own splits, when nobody hands it one', () => {
    expect(releaseOnBc(hisDeal.bc_data)).toBe(0)
    expect(releaseOnBc(realRelease.bc_data)).toBe(60_000)
  })

  it('and a bc with no splits at all claims no allowance', () => {
    expect(releaseOnBc({ equityRelease: '1500' })).toBe(1_500)
  })
})

// WHAT THIS DELIBERATELY DOES NOT TOUCH.
describe('the lender is still told the true figure', () => {
  it('because a cash-out field on a serviceability request is theirs, not ours', () => {
    const src = require('fs').readFileSync('lib/serviceability-request.ts', 'utf8')
    expect(src).toContain("digits(bc?.equityRelease)")
    expect(src).not.toContain('releaseOnDeal')
  })
})
