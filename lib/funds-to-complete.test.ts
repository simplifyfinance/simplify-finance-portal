import { describe, it, expect } from 'vitest'
import { fundsToComplete, fundsApply, isConstruction, loanAmount, lvrOf,
         securityValue, refinancedDebt } from './funds-to-complete'

const amountOf = (f: any, label: string) => f.lines.find((l: any) => l.label === label)?.amount

const purchase = (over: any = {}) => ({
  bc_data: { purchasePrice: '850,000', stampDuty: '45,000', deposit: '170,000',
             splits: [{ amount: '680,000' }], ...over },
  lo_data: {},
})

describe('a purchase — three numbers, nothing else', () => {
  const f = fundsToComplete(purchase({ deposit: '215,000' }))

  it('is price plus duty, less the loan', () => {
    expect(amountOf(f, 'Purchase price')).toBe(850_000)
    expect(amountOf(f, 'Stamp duty')).toBe(45_000)
    expect(amountOf(f, 'Loan')).toBe(680_000)
    expect(f.toFind).toBe(215_000)
    expect(f.applies).toBe(true)
  })

  // Fabio, 3 Sep 2026: "missed that funds to complete IS deposit not one or the
  // other!" Subtracting it answered nil on a deal where the client has to find
  // $3,841,500. It is the same money seen from the other end, so it is a check.
  it('never subtracts the deposit', () => {
    expect(f.lines.some(l => l.label === 'Deposit')).toBe(false)
    expect(f.deposit).toBe(215_000)
    expect(f.depositAgrees).toBe(true)
  })

  it('says so when the recorded deposit does not match', () => {
    const off = fundsToComplete(purchase({ deposit: '170,000' }))
    expect(off.toFind).toBe(215_000)
    expect(off.deposit).toBe(170_000)
    expect(off.depositAgrees).toBe(false)
  })

  it('has nothing to disagree with when no deposit is recorded', () => {
    const none = fundsToComplete(purchase({ deposit: '' }))
    expect(none.deposit).toBeNull()
    expect(none.depositAgrees).toBe(true)
    expect(none.toFind).toBe(215_000)
  })

  // Everything the first version added, gone. Each was a way to be wrong.
  it('has no lender fees, LMI, grant or sale proceeds', () => {
    const rich = fundsToComplete({
      bc_data: { purchasePrice: '850,000', stampDuty: '45,000', deposit: '170,000',
        lmi: '18,000', fhog: '10,000', netProceeds: '120,000', additionalSavings: '5,000',
        equityRelease: '80,000', splits: [{ amount: '680,000' }] },
      lo_data: { lenders: [{ lenderName: 'ING', applicationFee: '600', legalFee: '350' }] },
    })
    expect(rich.lines).toHaveLength(3)
    expect(rich.toFind).toBe(215_000)
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
    expect(f.toFind).toBe(244_500)
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

describe('a deal that refinances AND buys — only the purchase money counts', () => {
  // The deal that reported "$625,000 over". $1,350,000 of lending against an
  // $850,000 purchase — but $520,000 pays out the old loan and $180,000 is
  // equity released. Only $650,000 ever reaches the purchase.
  const mixed = (funds: [string, string, string] | null) => ({
    bc_data: { purchasePrice: '850,000', stampDuty: '45,000', deposit: '170,000' },
    lo_data: { loanAmount: '1,350,000', refinanceSplits: [
      { id: 'a', label: 'Existing loan refinanced', amount: '520,000', funds: funds?.[0] ?? '' },
      { id: 'b', label: 'Equity access', amount: '180,000', funds: funds?.[1] ?? '' },
      { id: 'c', label: 'New purchase', amount: '650,000', funds: funds?.[2] ?? '' },
    ] },
    fact_find_data: { properties: [{ value: '620,000',
      loans: [{ balance: '380,000', status: 'To be refinanced' }] }] },
  })

  it('counts only the split that funds the purchase', () => {
    const f = fundsToComplete(mixed(['payout', 'equity', 'purchase']))
    expect(amountOf(f, 'Loan funding the purchase')).toBe(650_000)
    // 850,000 + 45,000 − 650,000
    expect(f.toFind).toBe(245_000)
    expect(f.workable).toBe(true)
  })

  it('no longer reports a nonsense surplus', () => {
    expect(fundsToComplete(mixed(['payout', 'equity', 'purchase'])).toFind).not.toBe(0)
  })

  // A partial sum would look finished and be wrong.
  it('offers no total at all until every split has been answered', () => {
    const f = fundsToComplete(mixed(['payout', '', 'purchase']))
    expect(f.workable).toBe(false)
    expect(f.toFind).toBe(0)
    expect(f.missing.join(' ')).toContain('both refinances and buys')
  })

  it('still applies — the purchase has to settle', () => {
    expect(fundsApply(mixed(null))).toBe(true)
  })

  it('leaves a plain purchase alone, whole loan counted', () => {
    const f = fundsToComplete({ bc_data: { purchasePrice: '850,000', stampDuty: '45,000',
      deposit: '170,000' }, lo_data: { loanAmount: '680,000' } })
    expect(amountOf(f, 'Loan')).toBe(680_000)
    expect(f.workable).toBe(true)
  })

  it('a pure refinance still shows nothing', () => {
    expect(fundsApply({ bc_data: { existingLoanBal: '520,000' } })).toBe(false)
  })
})

describe('it never reports a negative', () => {
  it('says nil when the loan covers the price and the duty', () => {
    const over = fundsToComplete({ bc_data: { purchasePrice: '500,000', stampDuty: '20,000',
      deposit: '0' }, lo_data: { loanAmount: '560,000' } })
    expect(over.toFind).toBe(0)
  })
})

describe('LMI is shown but never counted', () => {
  // Capitalised onto the loan. The client does not find it at settlement, so it
  // must not move the total - but it must be visible, or people wonder.
  const withLmi = { bc_data: { purchasePrice: '850,000', stampDuty: '45,000',
    deposit: '170,000', lmi: '18,000' }, lo_data: { loanAmount: '680,000' } }

  it('appears on its own list', () => {
    const f = fundsToComplete(withLmi)
    expect(f.capitalised.map(l => l.label)).toEqual(['LMI'])
    expect(f.capitalised[0].amount).toBe(18_000)
  })

  it('does not change what the client has to find', () => {
    const without = fundsToComplete({ ...withLmi, bc_data: { ...withLmi.bc_data, lmi: '' } })
    expect(fundsToComplete(withLmi).toFind).toBe(without.toFind)
    expect(fundsToComplete(withLmi).toFind).toBe(215_000)
  })

  it('is not in the added-up lines', () => {
    expect(fundsToComplete(withLmi).lines.some(l => l.label === 'LMI')).toBe(false)
  })

  it('still says so when LMI applies and no figure was typed', () => {
    const f = fundsToComplete({ ...withLmi, bc_data: { ...withLmi.bc_data, lmi: '', lmiApplicable: 'Yes' } })
    expect(f.missing).toContain('LMI applies but no amount has been recorded')
    expect(f.capitalised).toHaveLength(0)
  })

  it('says nothing about LMI when it does not apply', () => {
    const f = fundsToComplete({ ...withLmi, bc_data: { ...withLmi.bc_data, lmi: '', lmiApplicable: 'No' } })
    expect(f.missing.some(m => m.includes('LMI'))).toBe(false)
  })
})

// Chapman's OO purchase carried $1,279,283.98 in the BC's existing loan box -
// the mortgage on the home they are selling out of. Read as refinanced debt it
// turned a plain purchase into a deal that "both refinances and buys", which
// withheld the funds to complete total behind a question the deal cannot answer.
describe('an existing balance on a purchase is not refinanced debt', () => {
  const chapman = {
    bc_data: { template: 'oo_purchase', purchasePrice: '5,250,000', stampDuty: '295,000',
               deposit: '3,841,500', existingLoanBal: '1279283.98' },
    lo_data: { loanAmount: '1,700,000' },
  }

  it('is ignored on a purchase-only scenario', () => {
    expect(refinancedDebt(chapman)).toBe(0)
  })

  it('so the whole loan counts and a total is offered', () => {
    const f = fundsToComplete(chapman)
    expect(f.workable).toBe(true)
    expect(amountOf(f, 'Loan')).toBe(1_700_000)
    expect(f.missing.join(' ')).not.toContain('both refinances and buys')
  })

  it('counts again as soon as the fact find flags the loan', () => {
    expect(refinancedDebt({ ...chapman, fact_find_data: { properties: [{ value: '1,900,000',
      loans: [{ balance: '1,279,283', status: 'To be refinanced' }] }] } })).toBe(1_279_283)
  })

  it('leaves every refinancing scenario exactly as it was', () => {
    for (const template of ['refinance_only', 'refinance_equity', 'investment_equity', 'bridging', 'buy_sell', '']) {
      expect(refinancedDebt({ bc_data: { template, existingLoanBal: '520,000' } })).toBe(520_000)
    }
  })
})
