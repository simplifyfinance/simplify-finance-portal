// "IO" TOLD THE CREDIT ASSESSOR NOTHING.
//
// Fabio, 27 Sep 2026, on the Loughlin-Walsh handover: "The handover doesnt have
// any indication of IO term..."
//
// Three splits, two of them interest only, both printed as the two letters "IO"
// and nothing else. One year and ten years came out of the printer identically,
// on the sheet that goes to the bank.
//
// The number was never missing from the deal. It sits on the recommended
// product - the interest only years on the IO rate module - and no split had
// ever been asked for it.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { splitsOf, repaymentLine, isInterestOnly, withSplitDetail } from './deal-structure'

const lender = (over: any = {}) => ({
  id: 'L1', lenderName: 'St George', productName: 'Advantage Package',
  variablePI: { enabled: true, rate: '5.95' },
  variableIO: { enabled: true, rate: '6.27', ioYears: '5' },
  ...over,
})

const deal = (over: any = {}) => ({
  lo_data: {
    recommendedOptionId: 'L1',
    recommendedLender: 'St George',
    lenders: [lender()],
    refinanceSplits: [
      { id: 's1', label: 'Split 1 - Owner-occupied Loan', amount: '675,000', repaymentType: 'P&I' },
      { id: 's2', label: 'Split 2 - Investment', amount: '235,000', repaymentType: 'IO' },
    ],
  },
  bc_data: { loanTerm: '28' },
  ...over,
})

describe('which splits are interest only', () => {
  it('knows the four repayment types apart', () => {
    expect(isInterestOnly('IO')).toBe(true)
    expect(isInterestOnly('Fixed IO')).toBe(true)
    expect(isInterestOnly('P&I')).toBe(false)
    expect(isInterestOnly('Fixed P&I')).toBe(false)
    expect(isInterestOnly('')).toBe(false)
    expect(isInterestOnly(undefined)).toBe(false)
  })
})

describe('the IO term reaches the split', () => {
  it('comes off the recommended product', () => {
    const splits = splitsOf(deal())
    expect(splits[1].repaymentType).toBe('IO')
    expect(splits[1].ioYears).toBe('5')
  })

  it('and is not put on a split that is not interest only', () => {
    // It is carried, but nothing prints it - see the line test below.
    expect(repaymentLine(splitsOf(deal())[0])).toBe('P&I')
  })

  it('a split that runs differently can be set on the block, and wins', () => {
    const d = deal()
    d.compliance_data = withSplitDetail({}, 's2', { ioYears: '3' })
    expect(splitsOf(d)[1].ioYears).toBe('3')
  })

  it('is blank when the product has no IO years recorded', () => {
    const d = deal()
    d.lo_data.lenders = [lender({ variableIO: { enabled: true, rate: '6.27' } })]
    expect(splitsOf(d)[1].ioYears).toBe('')
  })

  // NOTHING IS INVENTED. Two IO products ticked with different periods and
  // there is no way to know which one a split follows. A wrong IO term on a
  // submission is worse than a missing one.
  it('is blank when two IO products are ticked and disagree', () => {
    const d = deal()
    d.lo_data.lenders = [lender({
      variableIO: { enabled: true, ioYears: '5' },
      fixedIO: { enabled: true, ioYears: '3' },
    })]
    expect(splitsOf(d)[1].ioYears).toBe('')
  })

  it('but not when they agree', () => {
    const d = deal()
    d.lo_data.lenders = [lender({
      variableIO: { enabled: true, ioYears: '5' },
      fixedIO: { enabled: true, ioYears: '5' },
    })]
    expect(splitsOf(d)[1].ioYears).toBe('5')
  })

  it('and an IO module that is not ticked is not read', () => {
    const d = deal()
    d.lo_data.lenders = [lender({ variableIO: { enabled: false, ioYears: '10' } })]
    expect(splitsOf(d)[1].ioYears).toBe('')
  })
})

describe('how it reads on the sheet', () => {
  it('THE FIX: an interest only split says how long', () => {
    expect(repaymentLine({ repaymentType: 'IO', ioYears: '5' })).toBe('IO · 5 yrs')
    expect(repaymentLine({ repaymentType: 'Fixed IO', ioYears: '3' })).toBe('Fixed IO · 3 yrs')
  })

  it('and says so out loud when nobody recorded it', () => {
    // Silence is what caused this. "IO" on its own is the thing a credit
    // assessor cannot act on.
    expect(repaymentLine({ repaymentType: 'IO' })).toBe('IO · term not recorded')
    expect(repaymentLine({ repaymentType: 'IO', ioYears: '  ' })).toBe('IO · term not recorded')
  })

  it('a P&I split is left exactly as it was', () => {
    expect(repaymentLine({ repaymentType: 'P&I', ioYears: '5' })).toBe('P&I')
    expect(repaymentLine({ repaymentType: 'Fixed P&I' })).toBe('Fixed P&I')
  })

  it('and nothing at all where no type is recorded', () => {
    expect(repaymentLine({})).toBe('')
    expect(repaymentLine(null)).toBe('')
  })
})

describe('the handover actually prints it', () => {
  const pdf = readFileSync(new URL('../app/api/generate-broker-notes-pdf/route.tsx', import.meta.url), 'utf8')

  it('the splits table asks for the line, not the bare type', () => {
    expect(pdf).toContain('repaymentLine(sp)')
    expect(pdf, 'still printing the two letters on their own')
      .not.toContain('{sp.repaymentType || ')
  })
})

describe('and there is somewhere to change it', () => {
  const block = readFileSync(new URL('../components/DealStructure.tsx', import.meta.url), 'utf8')

  it('the deal structure block has a box for it', () => {
    expect(block).toContain("'IO years'")
    expect(block).toContain('ioYears: e.target.value')
  })

  it('shown only on a split that is interest only', () => {
    expect(block).toContain('isInterestOnly(s.repaymentType)')
  })
})
