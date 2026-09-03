import { describe, it, expect } from 'vitest'
import { fundsToComplete, fundsApply, isConstruction, loanAmount, lvrOf,
         securityValue, refinancedDebt } from './funds-to-complete'

const amountOf = (f: any, label: string) => f.lines.find((l: any) => l.label === label)?.amount

const purchase = (over: any = {}) => ({
  bc_data: { purchasePrice: '850,000', stampDuty: '45,000', deposit: '170,000',
             splits: [{ amount: '680,000' }], ...over },
  lo_data: {},
})

describe('a purchase — four numbers, nothing else', () => {
  const f = fundsToComplete(purchase())

  it('is price plus duty, less deposit and loan', () => {
    expect(amountOf(f, 'Purchase price')).toBe(850_000)
    expect(amountOf(f, 'Stamp duty')).toBe(45_000)
    expect(amountOf(f, 'Deposit')).toBe(170_000)
    expect(amountOf(f, 'Loan')).toBe(680_000)
    expect(f.toFind).toBe(45_000)
    expect(f.applies).toBe(true)
  })

  // Everything the first version added, gone. Each was a way to be wrong.
  it('has no lender fees, LMI, grant or sale proceeds', () => {
    const rich = fundsToComplete({
      bc_data: { purchasePrice: '850,000', stampDuty: '45,000', deposit: '170,000',
        lmi: '18,000', fhog: '10,000', netProceeds: '120,000', additionalSavings: '5,000',
        equityRelease: '80,000', splits: [{ amount: '680,000' }] },
      lo_data: { lenders: [{ lenderName: 'ING', applicationFee: '600', legalFee: '350' }] },
    })
    expect(rich.lines).toHaveLength(4)
    expect(rich.toFind).toBe(45_000)
  })
})

describe('a refinance — nothing at all', () => {
  const refi = { bc_data: { existingLoanBal: '520,000', propertyValue: '900,000',
                            splits: [{ amount: '600,000' }] }, lo_data: {} }

  it('does not apply', () => {
    expect(fundsApply(refi)).toBe(false)
    const f = fundsToComplete(refi)
    expect(f.applies).toBe(false)
    expect(f.lines).toHaveLength(0)
  })

  it('says nothing is missing, because nothing is asked for', () => {
    expect(fundsToComplete(refi).missing).toHaveLength(0)
  })

  it('still knows the debt being paid out, for the deal row', () => {
    expect(refinancedDebt(refi)).toBe(520_000)
  })

  it('reads the payout off the fact find when the BC has no figure', () => {
    expect(refinancedDebt({ fact_find_data: { properties: [{ loans:
      [{ balance: '380,000', status: 'To be refinanced' }] }] } })).toBe(380_000)
  })
})

describe('construction', () => {
  const con = {
    bc_data: { template: 'construction', landValue: '480,000', constructionCost: '620,000',
               stampDuty: '24,500', deposit: '180,000' },
    lo_data: { loanAmount: '880,000' },
  }

  it('is land plus build plus duty', () => {
    const f = fundsToComplete(con)
    expect(amountOf(f, 'Land value')).toBe(480_000)
    expect(amountOf(f, 'Construction cost')).toBe(620_000)
    expect(amountOf(f, 'Purchase price')).toBeUndefined()
    expect(f.toFind).toBe(64_500)
  })

  it('applies even with no purchase price', () => {
    expect(isConstruction(con)).toBe(true)
    expect(fundsApply(con)).toBe(true)
  })

  it('names a missing build cost', () => {
    const f = fundsToComplete({ ...con, bc_data: { ...con.bc_data, constructionCost: '' } })
    expect(f.missing).toContain('Construction cost has not been recorded')
  })
})

// Fabio, 3 Sep 2026: "I do not want to invent things ever."
describe('what it refuses to do', () => {
  it('never treats missing stamp duty as zero', () => {
    const f = fundsToComplete(purchase({ stampDuty: '' }))
    expect(amountOf(f, 'Stamp duty')).toBeUndefined()
    expect(f.missing).toContain('Stamp duty has not been recorded')
  })

  it('notices a missing deposit and a missing loan', () => {
    expect(fundsToComplete(purchase({ deposit: '' })).missing).toContain('No deposit has been recorded')
    expect(fundsToComplete(purchase({ splits: [] })).missing).toContain('No loan amount has been recorded')
  })

  it('shows nothing at all on an empty deal', () => {
    for (const d of [{}, null, undefined, { bc_data: {} }]) {
      expect(fundsToComplete(d).applies).toBe(false)
    }
  })
})

describe('LVR', () => {
  it('works it out against the purchase price', () => {
    expect(lvrOf(purchase())).toBe(80)
  })

  it('counts every security, not just the one being bought', () => {
    const s = securityValue({
      bc_data: { purchasePrice: '850,000' }, lo_data: { loanAmount: '1,350,000' },
      fact_find_data: { properties: [{ value: '620,000',
        loans: [{ balance: '380,000', status: 'To be refinanced' }] }] },
    })
    expect(s.count).toBe(2)
    expect(s.total).toBe(1_470_000)
    expect(s.lvr).toBe(91.8)
  })

  it('says nothing rather than guessing when either half is missing', () => {
    expect(lvrOf({ bc_data: { purchasePrice: '850,000' } })).toBeNull()
    expect(lvrOf({})).toBeNull()
  })
})

describe('the loan amount', () => {
  it('prefers the LO figure, falls back to the BC splits', () => {
    expect(loanAmount({ lo_data: { loanAmount: '700,000' }, bc_data: { splits: [{ amount: '680,000' }] } })).toBe(700_000)
    expect(loanAmount({ bc_data: { splits: [{ amount: '520,000' }, { amount: '180,000' }] } })).toBe(700_000)
  })

  it('copes with comma formatted money, which Number() alone cannot', () => {
    expect(loanAmount({ lo_data: { loanAmount: '5,250,000' } })).toBe(5_250_000)
  })
})

describe('a deal that refinances AND buys — the sum does not hold', () => {
  // Reported "$625,000 over" on a real-shaped deal: $1,350,000 of lending
  // against an $850,000 purchase, because $520,000 of that loan repays existing
  // debt the purchase never sees.
  const mixed = {
    bc_data: { purchasePrice: '850,000', stampDuty: '45,000', deposit: '170,000' },
    lo_data: { loanAmount: '1,350,000' },
    fact_find_data: { properties: [{ value: '620,000',
      loans: [{ balance: '380,000', status: 'To be refinanced' }] }] },
  }

  it('shows nothing rather than a figure that is not true', () => {
    expect(fundsApply(mixed)).toBe(false)
    expect(fundsToComplete(mixed).applies).toBe(false)
  })

  it('switches off on the BC figure too, not just the fact find', () => {
    expect(fundsApply({ bc_data: { purchasePrice: '850,000', existingLoanBal: '520,000' } })).toBe(false)
  })

  it('leaves a plain purchase alone', () => {
    expect(fundsApply({ bc_data: { purchasePrice: '850,000' } })).toBe(true)
  })
})

describe('it never reports a negative', () => {
  it('says nil when the loan and deposit cover everything', () => {
    const over = fundsToComplete({ bc_data: { purchasePrice: '500,000', stampDuty: '20,000',
      deposit: '200,000' }, lo_data: { loanAmount: '400,000' } })
    expect(over.toFind).toBe(0)
  })
})
