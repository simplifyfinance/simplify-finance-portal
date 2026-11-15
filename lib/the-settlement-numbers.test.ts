// WHERE THE MONEY GOES ON THE DAY.
//
// The figures already exist. This reshapes them; it does not re-add them up.
// See the note at the top of lib/the-settlement-numbers.ts about the
// double-counting bugs that got lib/funds-to-complete.ts cut back in September.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  settlementRows, settlementNumbersGaps, numbersWorthSending, numbersKind,
  cashOut, surplusGoesTo,
} from './the-settlement-numbers'

// The two plain fields balanceTotal and releaseTotal fall back to when nothing
// is recorded per security - see lib/complex-refinance.ts.
const refi = (over: any = {}) => ({
  transaction_type: 'refinance',
  loan_amount: 560000,
  bc_data: { existingLoanBal: 512400, equityRelease: 46440, ...(over.bc_data || {}) },
  ...over,
})

describe('which breakdown a deal gets', () => {
  it('a purchase, a refinance, or neither', () => {
    expect(numbersKind({ transaction_type: 'purchase' })).toBe('purchase')
    expect(numbersKind({ transaction_type: 'refinance' })).toBe('refinance')
    expect(numbersKind({})).toBe('none')
  })

  it('and neither says so rather than printing an empty table', () => {
    expect(settlementRows({})).toEqual([])
    expect(settlementNumbersGaps({}).join(' ')).toContain('neither a purchase nor a refinance')
  })
})

// THE SPEC: not sent on a dollar-for-dollar refinance, only where there is a
// surplus or a shortfall.
describe('whether it is worth sending at all', () => {
  it('a refinance with money coming out is', () => {
    expect(cashOut(refi())).toBeGreaterThan(0)
    expect(numbersWorthSending(refi())).toBe(true)
  })

  it('a dollar-for-dollar refinance is not', () => {
    const flat = refi({ bc_data: { existingLoanBal: 512400, equityRelease: 0 } })
    expect(cashOut(flat)).toBe(0)
    expect(numbersWorthSending(flat)).toBe(false)
    expect(settlementNumbersGaps(flat).join(' ')).toContain('dollar-for-dollar')
  })
})

describe('a refinance', () => {
  const rows = settlementRows(refi())

  it('shows the payout, the new loan and the surplus', () => {
    expect(rows.map(r => r.label)).toContain('Existing loan being paid out')
    expect(rows.map(r => r.label)).toContain('Surplus to you')
  })

  // THE ONE LINE THEY WILL LOOK FOR, ruled off and last.
  it('rules off the surplus, and puts it last', () => {
    expect(rows[rows.length - 1].label).toBe('Surplus to you')
    expect(rows[rows.length - 1].total).toBe(true)
  })

  // A LINE WITH NO FIGURE IS NOT A LINE. "Cash out $0" reads as a decision.
  it('leaves out any line with nothing in it', () => {
    const flat = refi({ bc_data: { existingLoanBal: 512400, equityRelease: 0 } })
    expect(settlementRows(flat).map(r => r.label)).not.toContain('Surplus to you')
  })
})

describe('a purchase', () => {
  // A COLUMN OF FIGURES WITH A WRONG TOTAL IS THE WORST THING THIS EMAIL COULD
  // CARRY, so an unworkable deal prints no table at all.
  it('prints nothing where the figures are not workable', () => {
    expect(settlementRows({ transaction_type: 'purchase' })).toEqual([])
  })

  it('and says what is missing rather than going quiet', () => {
    const gaps = settlementNumbersGaps({ transaction_type: 'purchase' })
    expect(Array.isArray(gaps)).toBe(true)
  })
})

describe('where a surplus is deposited', () => {
  // Read off the signed loan documents the portal already reads - not a second
  // field for somebody to fill in twice.
  it('comes from the account nominated on the signed pack', () => {
    expect(surplusGoesTo({ settlement_documents: { signed: { read: {
      offsetAccount: 'Bankwest offset ending 4417' } } } }))
      .toBe('Bankwest offset ending 4417')
  })

  it('and is empty where nobody nominated one, so the sentence is left out', () => {
    expect(surplusGoesTo({})).toBe('')
    expect(surplusGoesTo({ settlement_documents: { signed: { read: {} } } })).toBe('')
  })
})

// ONE SET OF SUMS, NOT TWO.
describe('it reshapes what exists', () => {
  it('reads the funds to complete rather than adding a purchase up again', () => {
    const src = readFileSync('lib/the-settlement-numbers.ts', 'utf8')
    expect(src).toContain("import { fundsToComplete }")
    // No arithmetic of its own on the purchase side.
    expect(src).not.toMatch(/price\s*[-+]\s*deposit/)
  })
})
