// ONE LOAN FIGURE ON A CLIENT EMAIL, AND IT IS THE ONE THEY BORROW.
//
// Fabio, 24 Sep 2026, on Ravi Kishore: "I dont want 561,000 than 570 includes
// lmi it should just say 570,000 includes LMI of 9,000 added to the loan...
// dont want any template to give me the base loan when we are capitalising LMI
// ok if paid at settlement."

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { clientLoan, lmiTrailingLines, lmiIsInTheLoan, LMI_CAPITALISED, LMI_SETTLEMENT } from './lmi'
import { purchaseRows } from './purchase-rows'
import { splitRows } from './split-cards'

// Ravi's Option 2.
const ravi = (extra: any = {}) => ({
  price: '640,000', duty: '35,000', dutyLabel: 'Stamp duty (VIC)',
  loan: '561,000', contribution: '114,000', contributionFrom: 'Savings',
  lmiApplicable: 'Applicable', lmi: '9,000',
  ...extra,
})
const labels = (rows: any[]) => rows.map(r => r.label)
const find = (rows: any[], starts: string) => rows.find(r => r.label.startsWith(starts))

describe('capitalised: the base loan never reaches the client', () => {
  const rows = purchaseRows(ravi({ lmiTreatment: LMI_CAPITALISED }))

  it('the loan line is $570,000 and $561,000 is nowhere on the page', () => {
    expect(find(rows, 'Loan amount').value).toBe('$570,000')
    expect(JSON.stringify(rows)).not.toContain('561,000')
  })

  it('one sentence under it says where the extra came from', () => {
    const i = rows.findIndex(r => r.label === 'Loan amount')
    expect(rows[i + 1]).toEqual({
      label: '', value: 'includes LMI of $9,000, added to the loan', note: true,
    })
  })

  it('it is marked as a note, so it is not right-aligned in the money column', () => {
    expect(rows.filter(r => r.note)).toHaveLength(1)
  })

  it('there is no second loan row of any kind', () => {
    expect(labels(rows).filter(l => /loan/i.test(l))).toEqual(['Loan amount'])
    expect(JSON.stringify(rows)).not.toContain('Total loan')
  })

  it('the contribution is untouched - the premium is not the client’s to find', () => {
    expect(find(rows, 'Your contribution').value).toBe('$114,000')
  })

  it('total cost stays purchase price plus stamp duty', () => {
    // Fabio's standing rule. The LMI is a cost of the LENDING, not the property.
    expect(find(rows, 'Total cost').value).toBe('$675,000')
  })
})

describe('paid at settlement: the base loan is what is borrowed, so it stays', () => {
  const rows = purchaseRows(ravi({ lmiTreatment: LMI_SETTLEMENT }))

  it('the loan line is $561,000 and nothing is added to it', () => {
    expect(find(rows, 'Loan amount').value).toBe('$561,000')
    expect(rows.some(r => r.note)).toBe(false)
  })

  it('the premium sits under the contribution, where the rest of what they must find is', () => {
    const i = rows.findIndex(r => r.label.startsWith('Your contribution'))
    expect(rows[i + 1]).toEqual({
      label: 'LMI (estimated)', value: '$9,000 - payable at settlement',
    })
  })
})

describe('what does not change', () => {
  it('nobody has answered yet: word for word what went out before today', () => {
    const rows = purchaseRows(ravi())
    expect(find(rows, 'Loan amount').value).toBe('$561,000')
    expect(find(rows, 'LMI (estimated)').value).toBe('$9,000')
    expect(rows.some(r => r.note)).toBe(false)
  })

  it('waived says nothing here - the LVR line has said it for months', () => {
    const rows = purchaseRows(ravi({ lmiApplicable: 'Waived', lmiTreatment: LMI_CAPITALISED }))
    expect(find(rows, 'Loan amount').value).toBe('$561,000')
    expect(JSON.stringify(rows)).not.toContain('LMI')
  })

  it('no LMI at all is the five lines it has always been', () => {
    const rows = purchaseRows({ price: '900,000', duty: '48,070', dutyLabel: 'Stamp duty',
                                loan: '720,000', contribution: '228,070', contributionFrom: 'Savings' })
    expect(rows).toHaveLength(5)
    expect(rows.some(r => r.note)).toBe(false)
  })

  it('an LMI status with no figure against it is a gap, not a number', () => {
    const rows = purchaseRows(ravi({ lmi: '', lmiTreatment: LMI_CAPITALISED }))
    expect(find(rows, 'Loan amount').value).toBe('$561,000')
  })
})

describe('the two pieces on their own', () => {
  it('clientLoan adds the premium only when it is capitalised', () => {
    expect(clientLoan({ lmiApplicable: 'Applicable', lmi: '9,000', lmiTreatment: LMI_CAPITALISED }, 561000))
      .toEqual({ amount: 570000, note: 'includes LMI of $9,000, added to the loan' })
    expect(clientLoan({ lmiApplicable: 'Applicable', lmi: '9,000', lmiTreatment: LMI_SETTLEMENT }, 561000))
      .toEqual({ amount: 561000, note: '' })
    expect(clientLoan({ lmiApplicable: 'Applicable', lmi: '9,000' }, 561000))
      .toEqual({ amount: 561000, note: '' })
    expect(clientLoan({}, 561000)).toEqual({ amount: 561000, note: '' })
    expect(clientLoan({ lmiApplicable: 'Applicable', lmi: '9,000', lmiTreatment: LMI_CAPITALISED }, null))
      .toEqual({ amount: null, note: '' })
  })

  it('lmiTrailingLines says nothing once the loan line has said it', () => {
    expect(lmiTrailingLines({ lmiApplicable: 'Applicable', lmi: '9,000', lmiTreatment: LMI_CAPITALISED })).toEqual([])
    expect(lmiTrailingLines({ lmiApplicable: 'Waived' })).toEqual([])
    expect(lmiTrailingLines({})).toEqual([])
  })

  it('lmiIsInTheLoan is what stops the LVR line repeating it', () => {
    expect(lmiIsInTheLoan({ lmiApplicable: 'Applicable', lmi: '9,000', lmiTreatment: LMI_CAPITALISED })).toBe(true)
    expect(lmiIsInTheLoan({ lmiApplicable: 'Applicable', lmi: '9,000', lmiTreatment: LMI_SETTLEMENT })).toBe(false)
    expect(lmiIsInTheLoan({ lmiApplicable: 'Applicable', lmi: '9,000' })).toBe(false)
  })
})

describe('the split card, where the split IS the whole loan', () => {
  const split = { amount: '561,000', rate: '6.95', type: 'P&I' }
  const bc = { lmiApplicable: 'Applicable', lmi: '9,000', lmiTreatment: LMI_CAPITALISED }

  it('a refinance with one split shows the loan they take, not the base', () => {
    const rows = splitRows(split, '30', { amountLabel: 'New loan amount', lmiBc: bc })
    expect(find(rows, 'New loan amount').value).toBe('$570,000')
    expect(rows.find(r => r.note)?.value).toBe('includes LMI of $9,000, added to the loan')
  })

  it('without the deal passed in it reads exactly as it did before', () => {
    const rows = splitRows(split, '30', { amountLabel: 'New loan amount' })
    expect(find(rows, 'New loan amount').value).toBe('$561,000')
    expect(rows.some(r => r.note)).toBe(false)
  })
})

describe('wired into every template that has a purchase breakdown', () => {
  const src = readFileSync(new URL('../app/api/generate-email/route.ts', import.meta.url), 'utf8')

  it('no purchase column prints a Total loan line under the LVR any more', () => {
    // The two purchase option columns used to append lmiLines() after the LVR.
    expect(src).not.toMatch(/lmiLines\(opt, opt\.lmiTreatment, loanNum\)/)
  })

  it('every purchase breakdown is handed the deal’s LMI', () => {
    // oo_purchase, investment_purchase, buy_sell, smsf, custom.
    expect((src.match(/lmiApplicable: d\.lmiApplicable, lmi: d\.lmi, lmiTreatment: d\.lmiTreatment,/g) || []).length)
      .toBeGreaterThanOrEqual(5)
  })

  it('the LVR line is told when a loan figure already carries the premium', () => {
    expect((src.match(/buildLVRLine\(d, lmiIsInTheLoan\(d\)\)/g) || []).length).toBe(5)
    // Nothing still calls it the old way from a template with a breakdown.
    expect(src).not.toMatch(/\}\) \+\n\s+buildLVRLine\(d\)\n/)
  })

  it('a note is rendered full width, never right-aligned in the money column', () => {
    expect((src.match(/colspan="2"[^`]*font-style:italic/g) || []).length).toBeGreaterThanOrEqual(2)
  })

  it('first home buyer is left exactly alone - that template is the scheme', () => {
    expect(src).toContain("row('LMI', 'Waived under Gov. Deposit Scheme')")
  })
})
