import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { seedFromGlobal } from './lo-splits'

// 17 Sep 2026. Dylan Smyth and Megan Isherwood: an investment purchase with
// Interest Only ticked on the product and P&I on the deal structure.
//
// The rows were there the whole time. Adding a lender option creates them on
// every scenario - it is only the box that draws them that was gated on a
// refinance. So on a purchase the rows nobody could see were the ones driving
// the deal structure, the client email, the handover and the compliance wording,
// and there was no way to correct them.

const src = readFileSync('app/(app)/deals/[id]/LOForm.tsx', 'utf8')
const GLOBALS = [{ id: 'a', label: 'Investment loan', amount: '540000' }]
const on = { enabled: true }

describe('the splits box is not a refinance feature', () => {
  it('is drawn on every scenario except bridging', () => {
    expect(src, 'the loan splits box is gated on a refinance again')
      .not.toMatch(/\{isRefinance && \(\s*\n\s*<div className="border-t border-gray-100 pt-4 mb-4">/)
    expect(src).toMatch(/\{!isBridging && \(/)
  })

  it('still leaves bridging its own structure', () => {
    expect(src).toMatch(/Bridging structure/)
  })

  it('says what to do when the deal has no splits yet', () => {
    expect(src).toMatch(/Add a split under/)
  })
})

describe('the interest only period belongs to the split', () => {
  it('comes across from a product with one rate module ticked', () => {
    const rows = seedFromGlobal(GLOBALS, { variableIO: { ...on, ioYears: '3' } } as any)
    expect(rows[0].ioYears).toBe('3')
    expect(rows[0].repaymentType).toBe('IO')
  })

  it('does not come across when two modules are ticked', () => {
    const rows = seedFromGlobal(GLOBALS,
      { variableIO: { ...on, ioYears: '3' }, variablePI: on } as any)
    expect(rows[0].ioYears).toBe('')
    expect(rows[0].repaymentType).toBe('')
  })

  it('never copies the rate or the repayment onto a split', () => {
    // A module's repayment is the figure for the whole loan. Putting it on each
    // split would be a number nobody typed, on a row a client email prints.
    const rows = seedFromGlobal(GLOBALS,
      { variableIO: { ...on, ioYears: '3', rate: '6.84', repayment: '3078' } } as any)
    expect(rows[0].rate).toBe('')
    expect(rows[0].repayment).toBe('')
  })

  it('is offered on the row only where the split is interest only', () => {
    expect(src).toMatch(/IO period \(years\)/)
    expect(src).toMatch(/test\(split\.repaymentType/)
  })
})
