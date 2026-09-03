import { describe, it, expect } from 'vitest'
import { fundsToComplete, loanAmount, lvrOf, refinancedDebt, securityValue } from './funds-to-complete'

const purchase = (over: any = {}) => ({
  bc_data: {
    purchasePrice: '850,000', deposit: '170,000', depositSource: 'Savings',
    stampDuty: '45,000', splits: [{ amount: '680,000' }], ...over,
  },
  lo_data: {},
})

const amountOf = (f: any, label: string) => f.lines.find((l: any) => l.label === label)?.amount

describe('a straightforward purchase', () => {
  const f = fundsToComplete(purchase())

  it('adds up what it costs and where it comes from', () => {
    expect(f.costs).toBe(895_000)      // 850,000 + 45,000
    expect(f.sources).toBe(850_000)    // 170,000 + 680,000
    expect(f.shortfall).toBe(45_000)
    expect(f.usable).toBe(true)
  })

  it('names the deposit source on the line, since that is the compliance question', () => {
    expect(f.lines.find(l => l.label.startsWith('Deposit'))!.label).toBe('Deposit — Savings')
  })

  it('says where every figure came from', () => {
    for (const l of f.lines) expect(l.from).toBeTruthy()
  })
})

// THE POINT OF THE WHOLE FILE. Fabio, 3 Sep 2026: "I do not want to invent
// things ever." A missing number is named, never assumed to be zero and never
// estimated.
describe('what it refuses to do', () => {
  it('never treats missing stamp duty as zero', () => {
    const f = fundsToComplete(purchase({ stampDuty: '' }))
    expect(amountOf(f, 'Stamp duty')).toBeUndefined()
    expect(f.missing).toContain('Stamp duty has not been recorded')
  })

  it('says so when LMI applies but no figure was typed', () => {
    const f = fundsToComplete(purchase({ lmi: '', lmiApplicable: 'Yes' }))
    expect(f.missing).toContain('LMI applies but no amount has been recorded')
    expect(amountOf(f, 'Lenders mortgage insurance')).toBeUndefined()
  })

  it('says nothing about LMI when it does not apply', () => {
    const f = fundsToComplete(purchase({ lmi: '', lmiApplicable: 'No' }))
    expect(f.missing.some(m => m.includes('LMI'))).toBe(false)
  })

  it('notices there is no deposit', () => {
    expect(fundsToComplete(purchase({ deposit: '' })).missing).toContain('No deposit has been recorded')
  })

  it('notices there is no loan', () => {
    expect(fundsToComplete(purchase({ splits: [] })).missing).toContain('No loan amount has been recorded')
  })

  it('refuses to show anything at all on an empty deal', () => {
    for (const d of [{}, null, undefined, { bc_data: {} }]) {
      expect(fundsToComplete(d).usable).toBe(false)
    }
  })
})

describe('the money that comes from somewhere other than savings', () => {
  it('counts the grant, extra savings and sale proceeds', () => {
    const f = fundsToComplete(purchase({
      fhog: '10,000', additionalSavings: '5,000', netProceeds: '120,000',
    }))
    expect(amountOf(f, 'First home owner grant')).toBe(10_000)
    expect(amountOf(f, 'Additional savings')).toBe(5_000)
    expect(amountOf(f, 'Net proceeds of sale')).toBe(120_000)
    expect(f.sources).toBe(985_000)
  })

  // Released equity is part of the new lending, so counting it as its own
  // source would add the same dollars twice.
  it('does not count released equity twice', () => {
    const f = fundsToComplete(purchase({ equityRelease: '80,000' }))
    expect(f.lines.some(l => l.label.includes('Equity'))).toBe(false)
    expect(f.sources).toBe(850_000)
  })

  it('leaves out anything that is zero or blank rather than showing a $0 line', () => {
    const f = fundsToComplete(purchase({ fhog: '0', netProceeds: '' }))
    expect(f.lines.some(l => l.label.includes('grant'))).toBe(false)
    expect(f.lines.some(l => l.label.includes('proceeds'))).toBe(false)
  })
})

describe('lender fees come from the recommended product, not typed again', () => {
  const withFees = {
    bc_data: { purchasePrice: '850,000', deposit: '170,000', stampDuty: '45,000' },
    lo_data: {
      loanAmount: '680,000', recommendedLender: 'Macquarie',
      lenders: [
        { lenderName: 'CBA', applicationFee: '600' },
        { lenderName: 'Macquarie', applicationFee: '395', valuationFee: '250',
          legalFee: '350', legalFeeLabel: 'Legal fee' },
      ],
    },
  }

  it('takes the fees off the recommended lender, not the first one', () => {
    const f = fundsToComplete(withFees)
    expect(amountOf(f, 'Application fee')).toBe(395)
    expect(amountOf(f, 'Valuation fee')).toBe(250)
  })

  it('calls the settlement charge whatever that bank calls it', () => {
    expect(amountOf(fundsToComplete(withFees), 'Legal fee')).toBe(350)
  })

  it('falls back to the only lender when none is marked recommended', () => {
    const one = { ...withFees, lo_data: { ...withFees.lo_data, recommendedLender: '' } }
    expect(amountOf(fundsToComplete(one), 'Application fee')).toBe(600)
  })
})

describe('a refinance', () => {
  const refi = {
    bc_data: { existingLoanBal: '520,000', splits: [{ amount: '600,000' }], propertyValue: '900,000' },
    lo_data: {},
  }

  it('treats the loan being paid out as the cost', () => {
    const f = fundsToComplete(refi)
    expect(amountOf(f, 'Existing debt being refinanced')).toBe(520_000)
    expect(f.shortfall).toBe(-80_000)   // money left over
  })

  it('does not ask for stamp duty on a refinance', () => {
    expect(fundsToComplete(refi).missing.some(m => m.includes('Stamp duty'))).toBe(false)
  })
})

describe('the loan amount', () => {
  it('prefers the LO figure', () => {
    expect(loanAmount({ lo_data: { loanAmount: '700,000' }, bc_data: { splits: [{ amount: '680,000' }] } }))
      .toBe(700_000)
  })

  it('falls back to the BC splits added up', () => {
    expect(loanAmount({ bc_data: { splits: [{ amount: '520,000' }, { amount: '180,000' }] } }))
      .toBe(700_000)
  })

  it('copes with comma formatted money, which Number() alone cannot', () => {
    expect(loanAmount({ lo_data: { loanAmount: '5,250,000' } })).toBe(5_250_000)
  })

  it('is zero when nothing is recorded', () => {
    expect(loanAmount({})).toBe(0)
  })
})

describe('LVR', () => {
  it('works it out against the purchase price', () => {
    expect(lvrOf({ bc_data: { purchasePrice: '850,000', splits: [{ amount: '680,000' }] } })).toBe(80)
  })

  it('uses the property value on a refinance', () => {
    expect(lvrOf({ bc_data: { propertyValue: '900,000', splits: [{ amount: '600,000' }] } })).toBe(66.7)
  })

  // Absent, not wrong. An LVR is a number people act on.
  it('says nothing rather than guessing when either half is missing', () => {
    expect(lvrOf({ bc_data: { splits: [{ amount: '680,000' }] } })).toBeNull()
    expect(lvrOf({ bc_data: { purchasePrice: '850,000' } })).toBeNull()
    expect(lvrOf({})).toBeNull()
  })
})


describe('a deal that is both a purchase and a refinance', () => {
  // The one that produced a $624,000 surplus that did not exist, because the
  // new lending counted as money in and the debt it repaid counted as nothing.
  const mixed = {
    bc_data: {
      purchasePrice: '850,000', deposit: '170,000', stampDuty: '45,000',
      splits: [
        { label: 'Existing loan refinanced', amount: '520,000' },
        { label: 'Equity access', amount: '180,000' },
        { label: 'New purchase', amount: '650,000' },
      ],
    },
    lo_data: { loanAmount: '1,350,000' },
    fact_find_data: { properties: [{ value: '620,000',
      loans: [{ lenderName: 'CBA', balance: '380,000', status: 'To be refinanced' }] }] },
  }

  it('counts the debt being paid out as a cost, even though there is a purchase', () => {
    const f = fundsToComplete(mixed)
    expect(amountOf(f, 'Existing debt being refinanced')).toBe(380_000)
  })

  it('reads the payout off the fact find when the BC has no figure', () => {
    expect(refinancedDebt(mixed)).toBe(380_000)
  })

  it('prefers the BC figure when somebody typed one', () => {
    expect(refinancedDebt({ ...mixed, bc_data: { ...mixed.bc_data, existingLoanBal: '400,000' } }))
      .toBe(400_000)
  })

  it('counts every security, not just the one being bought', () => {
    const s = securityValue(mixed)
    expect(s.count).toBe(2)
    expect(s.total).toBe(1_470_000)
    expect(s.lvr).toBe(91.8)
  })

  // Measured against the purchase alone this read 158.8%, which would have gone
  // into a compliance note as fact.
  it('does not produce an LVR above 100 by ignoring a security', () => {
    expect(lvrOf(mixed)!).toBeLessThan(100)
  })

  it('ignores a property whose loan is untouched by this deal', () => {
    const untouched = { ...mixed, fact_find_data: { properties: [{ value: '620,000',
      loans: [{ balance: '380,000', status: 'Remain open' }] }] } }
    expect(securityValue(untouched).count).toBe(1)
    expect(refinancedDebt(untouched)).toBe(0)
  })
})
