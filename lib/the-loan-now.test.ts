import { describe, it, expect } from 'vitest'
import {
  seedFrom, loanNow, monthlyRepayment, rateWords, termWords, repaymentWords,
  loanDetailsNow, INTEREST_ONLY, PRINCIPAL_AND_INTEREST,
} from './the-loan-now'
import { minimumRepayment } from './repayment-analysis'

// A purchase that has been through the offer accepted step: the contract loan
// is answered, so loanAmount() is that figure and nothing else.
const deal = (over: any = {}) => ({
  contract_loan_amount: 900000,
  bc_data: {
    loanTerm: '30',
    splits: [{
      id: 's1', label: 'Loan 1', amount: '900000',
      repaymentType: 'IO', ioYears: '3', rate: '6.74',
    }],
  },
  lo_data: { lenders: [{ lenderName: 'ubank', productName: 'Neat Home Loan', lenderSplits: [] }] },
  ...over,
})

describe('the boxes open filled in', () => {
  it('seeds every one of them from the deal structure', () => {
    const s = seedFrom(deal())
    expect(s.product).toBe('Neat Home Loan')
    expect(s.rate).toBe(6.74)
    // The term is not on a split at all; it falls to the borrowing capacity's
    // one answer. Reading the per-lender splits for it - my first draft - left
    // this box empty on every deal in the book.
    expect(s.termYears).toBe(30)
    expect(s.repaymentType).toBe(INTEREST_ONLY)
    expect(s.ioYears).toBe(3)
  })

  it('folds the four split types into the two this box offers', () => {
    const io = seedFrom(deal({ bc_data: { loanTerm: '30',
      splits: [{ repaymentType: 'Fixed IO', ioYears: '5' }] } }))
    expect(io.repaymentType).toBe(INTEREST_ONLY)
    const pi = seedFrom(deal({ bc_data: { loanTerm: '30',
      splits: [{ repaymentType: 'Fixed P&I' }] } }))
    expect(pi.repaymentType).toBe(PRINCIPAL_AND_INTEREST)
    // Which matters because the dropdown only holds those two. A seed it cannot
    // show draws the first option while holding something else.
    expect([INTEREST_ONLY, PRINCIPAL_AND_INTEREST, '']).toContain(io.repaymentType)
  })

  it('says nothing where the deal says nothing', () => {
    const s = seedFrom({})
    expect(s).toEqual({ product: '', rate: 0, termYears: 0, repaymentType: '', ioYears: 0 })
  })
})

describe('the deal’s own answer wins, and nothing is compared', () => {
  it('takes the rate that was typed over the one that was seeded', () => {
    const d = deal({ offer_rate: 7.14 })
    expect(loanNow(d).rate).toBe(7.14)
    expect(rateWords(d)).toBe('7.14%')
  })

  it('takes the product, the term and the type too', () => {
    const d = deal({ offer_product: 'Flex Home Loan', offer_term_years: 25,
      offer_repayment_type: PRINCIPAL_AND_INTEREST })
    const now = loanNow(d)
    expect(now.product).toBe('Flex Home Loan')
    expect(now.termYears).toBe(25)
    expect(termWords(d)).toBe('25 years')
    expect(now.repaymentType).toBe(PRINCIPAL_AND_INTEREST)
  })

  it('drops the interest only years the moment the loan is not interest only', () => {
    // The column still holds 3 from before somebody changed the type. A P&I
    // loan has no interest only period, so neither the figure nor the words
    // survive the change.
    const d = deal({ offer_repayment_type: PRINCIPAL_AND_INTEREST, offer_io_years: 3 })
    expect(loanNow(d).ioYears).toBe(0)
    expect(repaymentWords(d)).toBe(PRINCIPAL_AND_INTEREST)
  })

  it('writes the interest only period out in words', () => {
    expect(repaymentWords(deal())).toBe(`${INTEREST_ONLY} — 3 years`)
    expect(repaymentWords(deal({ offer_io_years: 1 }))).toBe(`${INTEREST_ONLY} — 1 year`)
  })
})

describe('the repayment is worked out, never stored and never assumed', () => {
  it('interest only is the balance times the rate, over twelve', () => {
    // $900,000 at 6.74%. Nothing comes off the balance, so the term does not
    // enter it.
    expect(monthlyRepayment(deal())).toBe(Math.round((900000 * 0.0674) / 12))
    expect(monthlyRepayment(deal())).toBe(5055)
  })

  it('an interest only loan with no term still gets a figure', () => {
    const d = deal({ bc_data: { splits: [{ repaymentType: 'IO', rate: '6.74' }] } })
    expect(loanNow(d).termYears).toBe(0)
    expect(monthlyRepayment(d)).toBe(5055)
  })

  it('principal and interest goes through the same function as the analysis', () => {
    const d = deal({ offer_repayment_type: PRINCIPAL_AND_INTEREST })
    expect(monthlyRepayment(d)).toBe(Math.round(minimumRepayment(900000, 6.74, 30 * 12)))
    // And it is a bigger figure than the interest only one, which is the whole
    // reason the two are not one line of code.
    expect(monthlyRepayment(d)!).toBeGreaterThan(5055)
  })

  it('NEVER ASSUMES THIRTY YEARS. No term, no figure.', () => {
    // Fabio, 21 Oct 2026: "my fear is you always using 30 years on your
    // calculations". A principal and interest repayment needs a term and there
    // is no default for it anywhere in this file.
    const d = deal({
      offer_repayment_type: PRINCIPAL_AND_INTEREST,
      bc_data: { splits: [{ repaymentType: 'P&I', rate: '6.74' }] },
    })
    expect(loanNow(d).termYears).toBe(0)
    expect(monthlyRepayment(d)).toBe(null)
  })

  it('no loan and no rate are both no figure', () => {
    expect(monthlyRepayment(deal({ contract_loan_amount: 0, bc_data: {} }))).toBe(null)
    expect(monthlyRepayment(deal({ bc_data: { loanTerm: '30', splits: [{ repaymentType: 'IO' }] } })))
      .toBe(null)
  })
})

describe('what the client email prints', () => {
  it('prints the deal’s own answer, not the pre-approval’s', () => {
    const d = deal({ offer_product: 'Flex Home Loan', offer_rate: 7.14,
      offer_repayment_type: PRINCIPAL_AND_INTEREST, offer_term_years: 25 })
    expect(loanDetailsNow(d)).toEqual([
      { label: 'Product', value: 'Flex Home Loan' },
      { label: 'Interest rate', value: '7.14%' },
      { label: 'Repayments', value: PRINCIPAL_AND_INTEREST },
      { label: 'Loan term', value: '25 years' },
      { label: 'Monthly repayment',
        value: `$${Math.round(minimumRepayment(900000, 7.14, 300)).toLocaleString('en-AU')}` },
    ])
  })

  it('leaves a line out rather than printing a blank beside a label', () => {
    const rows = loanDetailsNow({ contract_loan_amount: 900000 })
    expect(rows).toEqual([])
  })

  it('never prints a zero rate or a zero term', () => {
    const rows = loanDetailsNow(deal({ bc_data: { splits: [{ repaymentType: 'P&I' }] } }))
    expect(rows.map(r => r.label)).toEqual(['Product', 'Repayments'])
    expect(rateWords(deal({ bc_data: {} }))).toBe('')
    expect(termWords(deal({ bc_data: {} }))).toBe('')
  })
})
