// THE FIGURES A MILESTONE EMAIL PRINTS.
//
// Fabio's own templates carry "Purchase price $" with the number typed in by
// hand every time. A hand-typed figure is one that can disagree with the deal,
// and these emails go to clients with the loan amount in them.

import { describe, it, expect } from 'vitest'
import {
  milestoneRows, priceOf, dutyOf, contributionOf, figuresAreComplete,
  missingFigures, loanDetails,
} from './milestone-figures'

const BC_ONLY = {
  bc_data: { dutyState: 'NSW', purchasePrice: '1000000', stampDuty: '39000',
             deposit: '239000', splits: [{ id: 's1', amount: '800000' }] },
  lo_data: { loanAmount: '800000' },
}

// The same deal after a contract came in $50,000 lower and the team reworked it.
const CONTRACTED = {
  ...BC_ONLY,
  contract_price: 950000,
  contract_stamp_duty: 37000,
  contract_loan_amount: 748000,
  contract_deposit: 239000,
}

describe('newest wins, and the BC is what a pre-approval has', () => {
  it('a pre-approval prints the assessed figures', () => {
    expect(priceOf(BC_ONLY)).toBe(1000000)
    expect(dutyOf(BC_ONLY)).toBe(39000)
    expect(contributionOf(BC_ONLY)).toBe(239000)
  })

  it('a formal approval prints the contracted ones', () => {
    expect(priceOf(CONTRACTED)).toBe(950000)
    expect(dutyOf(CONTRACTED)).toBe(37000)
    expect(contributionOf(CONTRACTED)).toBe(239000)
  })

  it('the BC is never rewritten by either', () => {
    expect(CONTRACTED.bc_data.purchasePrice).toBe('1000000')
  })
})

describe('the five lines', () => {
  const rows = milestoneRows(CONTRACTED)
  const labels = rows.filter(r => !r.note).map(r => r.label)

  it('are the ones every purchase on this portal uses', () => {
    expect(labels[0]).toBe('Purchase price')
    expect(labels[1]).toBe('Stamp duty (NSW)')
    expect(labels[2]).toContain('Total cost')
    expect(labels).toContain('Loan amount')
    expect(labels.some(l => l.startsWith('Your contribution required'))).toBe(true)
  })

  it('name the state on the duty, because duty is a state tax', () => {
    const vic = milestoneRows({ ...CONTRACTED, bc_data: { ...CONTRACTED.bc_data, dutyState: 'VIC' } })
    expect(vic.map(r => r.label)).toContain('Stamp duty (VIC)')
  })

  it('add the total up rather than reading a box for it', () => {
    const total = rows.find(r => r.label.startsWith('Total cost'))!
    expect(total.value).toBe('$987,000')   // 950,000 + 37,000
  })
})

describe('an email with half the figures is worse than one with none', () => {
  it('knows when it has them all', () => {
    expect(figuresAreComplete(CONTRACTED)).toBe(true)
    expect(missingFigures(CONTRACTED)).toEqual([])
  })

  it('names what is missing, so the send screen can say so', () => {
    const bare = { bc_data: { dutyState: 'NSW' }, lo_data: {} }
    expect(figuresAreComplete(bare)).toBe(false)
    expect(missingFigures(bare))
      .toEqual(['the purchase price', 'the loan amount', "the clients' contribution"])
  })

  it('does not treat nil duty as missing — it is the answer on a first home buyer', () => {
    const fhb = { ...CONTRACTED, contract_stamp_duty: 0,
                  bc_data: { ...CONTRACTED.bc_data, stampDuty: '0' } }
    expect(dutyOf(fhb)).toBe(0)
    expect(missingFigures(fhb)).toEqual([])
    expect(figuresAreComplete(fhb)).toBe(true)
  })
})

describe("the loan's own details", () => {
  const OPTION = {
    productName: 'Complete Home Loan Package',
    variablePI: { enabled: true, rate: '5.94', repayment: '4452' },
  }
  const SPLITS = [{ repaymentType: 'P&I', termYears: '30' }]

  it('read off the option this deal is with', () => {
    expect(loanDetails({}, OPTION, SPLITS)).toEqual([
      { label: 'Product', value: 'Complete Home Loan Package' },
      { label: 'Interest rate', value: '5.94% p.a. variable' },
      { label: 'Repayments', value: 'P&I' },
      { label: 'Loan term', value: '30 years' },
      { label: 'Monthly repayment', value: '$4,452' },
    ])
  })

  it('leave a detail out rather than printing it blank', () => {
    // Six labels and three answers reads as a broken email.
    expect(loanDetails({}, { productName: 'Neat' }, []).map(d => d.label)).toEqual(['Product'])
  })

  it('print no rate at all when two modules disagree', () => {
    // There is no way to know which one a given split follows, and the wrong
    // rate in a client email is money.
    const two = { ...OPTION, fixedPI: { enabled: true, rate: '5.49', repayment: '4300' } }
    expect(loanDetails({}, two, SPLITS).find(d => d.label === 'Interest rate')).toBeUndefined()
    expect(loanDetails({}, two, SPLITS).find(d => d.label === 'Monthly repayment')).toBeUndefined()
  })

  it('say fixed when the fixed module is the one switched on', () => {
    const fixed = { productName: 'X', fixedPI: { enabled: true, rate: '5.49' } }
    expect(loanDetails({}, fixed, []).find(d => d.label === 'Interest rate')!.value)
      .toBe('5.49% p.a. fixed')
  })

  it('survive an option that is not there', () => {
    expect(loanDetails({}, null, [])).toEqual([])
  })
})
