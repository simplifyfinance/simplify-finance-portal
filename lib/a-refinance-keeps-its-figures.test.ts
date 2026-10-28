import { describe, it, expect } from 'vitest'
import { milestoneRows, missingFigures, figuresAreComplete, loanDetails } from './milestone-figures'

// A REFINANCE KEEPS ITS FIGURES.
//
// 28 Oct 2026. Mellissa Sedin, on a formal approval that went out by hand
// because the portal would not fill it in: "Its not showing the loan amount or
// rate - I checked the BC and LO and its all been done as a refi."
//
// Both faults were the same shape: a question written for a purchase, asked of
// every deal, and answered "missing" every time on a refinance.
//
//   1. The money block is all or nothing, and completeness asked for a purchase
//      price and a deposit. A refinance has neither, so the block was dropped,
//      and the loan amount - the one line the client was waiting to read - went
//      with it.
//   2. The rate was read only from the lender's rate modules. The lending
//      options email reads the splits. A deal priced on its splits showed a
//      rate in one email and no rate in the other.
//
// Invented clients. The shapes are real.

const REFI = {
  bc_data: {
    template: 'Refinance only',
    // THE LOAN IS THE SUM OF THE BC'S SPLITS. See loanAmount() in
    // lib/funds-to-complete.ts - never a typed total, because a typed total
    // once beat the BC in front of a client by $1.7m.
    splits: [{ amount: '505000' }],
    existingLoanBal: '488000',
    equityRelease: '0',
  },
  fact_find_data: { properties: [
    { address: '45 Adams St, Muswellbrook NSW', loans: [{ status: 'To be refinanced' }] },
  ] },
}

const PURCHASE = {
  bc_data: { template: 'Purchase', purchasePrice: '740000', stampDuty: '28500',
             splits: [{ amount: '592000' }] },
  contract_deposit: '148000',
  fact_find_data: { properties: [] },
}

describe('WHAT A REFINANCE OWES BEFORE ITS EMAIL CAN CARRY FIGURES', () => {
  it('only the loan amount', () => {
    expect(missingFigures(REFI)).toEqual([])
    expect(figuresAreComplete(REFI)).toBe(true)
  })

  it('AND IT IS NEVER ASKED FOR A PURCHASE PRICE OR A DEPOSIT', () => {
    // The fault, stated. Asking a refinance for either is asking for something
    // that does not exist, so the answer is always "missing" and the block is
    // always dropped - on every refinance this portal has ever sent.
    const words = missingFigures(REFI).join(' ')
    expect(words).not.toContain('purchase price')
    expect(words).not.toContain('contribution')
  })

  it('and a refinance with no loan amount is still short of one', () => {
    const bare = { ...REFI, bc_data: { ...REFI.bc_data, splits: [] } }
    expect(missingFigures(bare)).toEqual(['the loan amount'])
    expect(figuresAreComplete(bare)).toBe(false)
  })

  it('and a purchase is asked exactly what it always was', () => {
    expect(missingFigures(PURCHASE)).toEqual([])
    const noPrice = { ...PURCHASE, bc_data: { ...PURCHASE.bc_data, purchasePrice: '' } }
    expect(missingFigures(noPrice)).toContain('the purchase price')
    // NOT THE DEPOSIT, because it does not have to be typed: with a price and
    // a loan the contribution is arithmetic, and depositAsAssessed() does it.
    // Taking the typed one away changes nothing, which is the right answer.
    const noDeposit = { ...PURCHASE, contract_deposit: '' }
    expect(missingFigures(noDeposit)).toEqual([])
    const noLoan = { ...PURCHASE, bc_data: { ...PURCHASE.bc_data, splits: [] } }
    expect(missingFigures(noLoan)).toContain('the loan amount')
  })

  it('and a deal is a refinance because a loan says so, not only a template', () => {
    const byLoanOnly = {
      bc_data: { splits: [{ amount: '505000' }] },
      fact_find_data: { properties: [{ loans: [{ status: 'To be refinanced' }] }] },
    }
    expect(missingFigures(byLoanOnly)).toEqual([])
  })
})

describe('THE THREE LINES A REFINANCE PRINTS', () => {
  it('the loan, what is being paid out, and nothing else', () => {
    const rows = milestoneRows(REFI)
    expect(rows.map(r => r.label)).toEqual(['Loan amount', 'Balance being refinanced'])
    expect(rows[0].value).toContain('505,000')
    expect(rows[1].value).toContain('488,000')
  })

  it('AND CASH OUT ONLY WHERE THERE IS CASH OUT', () => {
    // "$0" on a line called Cash out reads as a decision somebody made, not as
    // a figure nobody typed. Same rule the deposit line has followed since
    // September.
    expect(milestoneRows(REFI).map(r => r.label)).not.toContain('Cash out')
    const withCash = { ...REFI, bc_data: { ...REFI.bc_data, equityRelease: '60000' } }
    const rows = milestoneRows(withCash)
    expect(rows.map(r => r.label)).toContain('Cash out')
    expect(rows.find(r => r.label === 'Cash out')!.value).toContain('60,000')
  })

  it('and no purchase price, duty or total cost anywhere near it', () => {
    const labels = milestoneRows(REFI).map(r => r.label).join(' ')
    expect(labels).not.toContain('Purchase price')
    expect(labels).not.toContain('Total cost')
    expect(labels).not.toContain('duty')
  })

  it('and a purchase still prints the five it always did', () => {
    const labels = milestoneRows(PURCHASE).map(r => r.label)
    expect(labels).toContain('Purchase price')
    expect(labels).toContain('Loan amount')
  })
})

describe('THE INTEREST RATE', () => {
  const splits = (rate: string) => [{ rate, repaymentType: 'P&I' }]

  it('comes off the rate module where one is ticked', () => {
    const option = { productName: 'Complete Variable', variablePI: { enabled: true, rate: '6.34' } }
    const d = loanDetails(REFI, option, splits('6.44'))
    expect(d.find(x => x.label === 'Interest rate')!.value).toBe('6.34% p.a. variable')
  })

  it('AND OFF THE SPLITS WHEN NO MODULE IS TICKED', () => {
    // The fault Mellissa saw. The lending options email reads the splits and
    // showed the rate; this read only the modules and showed nothing.
    const option = { productName: 'Complete Variable' }
    const d = loanDetails(REFI, option, splits('6.44'))
    expect(d.find(x => x.label === 'Interest rate')!.value).toBe('6.44% p.a.')
  })

  it('and it does not claim fixed or variable off a split', () => {
    // A split does not record which, and the client cares a great deal.
    const d = loanDetails(REFI, { productName: 'X' }, splits('6.44'))
    const v = d.find(x => x.label === 'Interest rate')!.value
    expect(v).not.toContain('variable')
    expect(v).not.toContain('fixed')
  })

  it('and two splits on different rates print no rate at all', () => {
    const d = loanDetails(REFI, { productName: 'X' },
      [{ rate: '6.44' }, { rate: '5.99' }])
    expect(d.find(x => x.label === 'Interest rate')).toBeUndefined()
  })

  it('and nothing anywhere prints nothing, rather than a blank label', () => {
    const d = loanDetails(REFI, { productName: 'X' }, [{ rate: '' }])
    expect(d.find(x => x.label === 'Interest rate')).toBeUndefined()
    expect(d.find(x => x.label === 'Product')!.value).toBe('X')
  })
})
