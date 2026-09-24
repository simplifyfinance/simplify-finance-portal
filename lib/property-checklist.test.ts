// Ravi Kishore's property, exactly as the Fact Find screen holds it.
// Fabio, 24 Sep 2026: "see the properties details are not being wired to html
// templates...we had this issue fixed before."

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  propertyChecklist, statusBadge, loanTermsLine, loanTermLine, loanFigure,
  futureUseLine, per,
} from './property-checklist'

const ravi = (propExtra: any = {}, loanExtra: any = {}) => ({
  applicants: [{ id: 'a1', firstName: 'Ravi' }, { id: 'a2', firstName: 'Priya' }],
  properties: [{
    address: 'Rush St, Aintree VIC 3336, Australia',
    value: '1,120,000',
    ownershipType: 'Owner occupied', zoning: 'Residential', propertySubtype: 'House',
    futureUse: 'Ongoing', ownership: { a1: '100' },
    loans: [{
      lenderName: 'Macquarie', interestRate: '6.04', rateType: 'Variable',
      balance: '415,000', limitAmount: '415,000',
      repaymentAmount: '2,499', repaymentFrequency: 'Monthly',
      repaymentType: 'Principal and interest',
      interestOnlyExpiryDate: '2026-09-24',
      remainingLoanTermYears: '30', status: 'Ongoing',
      ...loanExtra,
    }],
    ...propExtra,
  }],
  liabilities: [],
})

const only = (ff: any) => propertyChecklist(ff)[0]

describe('the eight boxes Fabio named', () => {
  const block = only(ravi())

  it('the value is there', () => {
    expect(block).toContain('Value $1,120,000')
  })

  it('the rate and the rate type are there', () => {
    expect(block).toContain('6.04% variable')
  })

  it('the repayment and the repayment type are there', () => {
    expect(block).toContain('principal and interest')
    expect(block).toContain('$2,499 per month')
  })

  it('all three sit on one line, in that order', () => {
    expect(block).toContain('6.04% variable, principal and interest, $2,499 per month')
  })

  it('the remaining term is on its own line', () => {
    expect(block).toContain('30 years remaining')
  })

  it('the balance is there and the limit is not, because there is a balance', () => {
    expect(block).toContain('Balance $415,000')
    expect(block).not.toContain('Limit')
  })

  it('the interest only expiry is NOT printed', () => {
    // Fabio, 24 Sep 2026: "Interest only expires - DONT PRINT".
    expect(block).not.toContain('2026')
    expect(block.toLowerCase()).not.toContain('interest only expir')
  })

  it('the header still reads as it did', () => {
    expect(block).toContain('<strong>Rush St, Aintree VIC 3336, Australia</strong> — House, Residential (Owner occupied)')
  })
})

describe('the status dropdown, which had never printed once', () => {
  // statusBadge only knew the LIABILITY words. A property loan cannot be set to
  // any of them, so all three of its own options came out blank.
  it('knows every option on the property loan dropdown', () => {
    expect(statusBadge('Ongoing')).toContain('Ongoing')
    expect(statusBadge('Refinance')).toContain('Refinance')
    expect(statusBadge('To be paid out')).toContain('To be paid out')
  })

  it('Ongoing is grey, Refinance green, To be paid out amber', () => {
    expect(statusBadge('Ongoing')).toContain('#EFEFED')
    expect(statusBadge('Refinance')).toContain('#D1FAE5')
    expect(statusBadge('To be paid out')).toContain('#FEF3C7')
  })

  it('shows on the loan line in the block', () => {
    expect(only(ravi({}, { status: 'Refinance' }))).toContain('>Refinance</span>')
    expect(only(ravi({}, { status: 'To be paid out' }))).toContain('>To be paid out</span>')
  })

  it('still knows the liability words, unchanged', () => {
    expect(statusBadge('To be closed')).toContain('To be closed')
    expect(statusBadge('To be refinanced')).toContain('To be refinanced')
    expect(statusBadge('To be consolidated')).toContain('To be consolidated')
  })

  it('Remain open stays blank - it is the do-nothing answer on that list', () => {
    expect(statusBadge('Remain open')).toBe('')
    expect(statusBadge('')).toBe('')
    expect(statusBadge(undefined)).toBe('')
  })
})

describe('the rent says what the fact find says', () => {
  const investment = (freq: string) => only(ravi({
    ownershipType: 'Investment', rentalIncome: '2,600', rentalIncomeFrequency: freq,
  }))

  it('monthly rent is not printed as weekly', () => {
    // It printed "/week" whatever was recorded. $2,600 a month went out as
    // $2,600 a week - four times the real figure, in writing.
    expect(investment('Monthly')).toContain('rental income $2,600 per month')
    expect(investment('Monthly')).not.toContain('per week')
  })

  it('weekly, fortnightly and annually each say themselves', () => {
    expect(investment('Weekly')).toContain('per week')
    expect(investment('Fortnightly')).toContain('per fortnight')
    expect(investment('Annually')).toContain('per year')
  })

  it('nothing recorded falls back to weekly, which is what the form collects', () => {
    expect(investment('')).toContain('per week')
    expect(per('', 'per week')).toBe('per week')
  })

  it('an owner occupied property has no rent, whatever is in the box', () => {
    expect(only(ravi({ rentalIncome: '620' }))).not.toContain('rental income')
  })

  it('value and rent share a line', () => {
    expect(investment('Weekly')).toContain('Value $1,120,000 · rental income $2,600 per week')
  })
})

describe('future use, only when it is not Ongoing', () => {
  it('Ongoing says nothing - that is not news', () => {
    // Careful: the LOAN's status badge also says Ongoing. This is the
    // property's own line, which must not appear at all.
    expect(only(ravi({ futureUse: 'Ongoing' }))).not.toContain('<strong>Ongoing</strong>')
    expect(futureUseLine('Ongoing')).toBe('')
    expect(futureUseLine('')).toBe('')
  })

  it('to be sold is said, and said loudly', () => {
    expect(only(ravi({ futureUse: 'To be sold' }))).toContain('<strong>To be sold</strong>')
  })

  it('the two "will become" answers read as sentences', () => {
    expect(futureUseLine('Will become investment')).toBe('Will become an investment after settlement')
    expect(futureUseLine('Will become owner occupied')).toBe('Will become owner occupied after settlement')
  })

  it('a value nobody planned for is printed as recorded rather than dropped', () => {
    expect(futureUseLine('Knocked down')).toBe('Knocked down')
  })
})

describe('an empty box prints nothing - never $0, never a dangling comma', () => {
  it('no rate: the line starts with what is there', () => {
    expect(loanTermsLine({ rateType: 'Variable', repaymentType: 'Interest only' }))
      .toBe('Variable, interest only')
  })

  it('no repayment: no trailing comma', () => {
    expect(loanTermsLine({ interestRate: '6.04', rateType: 'Fixed', repaymentType: 'Interest only' }))
      .toBe('6.04% fixed, interest only')
  })

  it('nothing at all: no line', () => {
    expect(loanTermsLine({})).toBe('')
    expect(loanTermLine({})).toBe('')
    expect(loanTermLine({ remainingLoanTermYears: '0' })).toBe('')
  })

  it('one year is a year, not years', () => {
    expect(loanTermLine({ remainingLoanTermYears: '1' })).toBe('1 year remaining')
  })

  it('a balance of nothing falls back to the limit, and never prints $0', () => {
    expect(loanFigure({ balance: '', limitAmount: '488,000' })).toBe('Limit $488,000')
    expect(loanFigure({ balance: '0', limitAmount: '488,000' })).toBe('Limit $488,000')
    expect(loanFigure({})).toBe('')
  })

  it('a property with no value and no loans is still its own line', () => {
    const block = only(ravi({ value: '', loans: [] }))
    expect(block).toContain('Rush St')
    expect(block).not.toContain('Value')
    expect(block).not.toContain('$0')
  })

  it('an untouched loan row is not a loan', () => {
    expect(only(ravi({}, { lenderName: '', balance: '', limitAmount: '' })))
      .not.toContain('Linked loan')
  })
})

describe('liabilities are untouched', () => {
  const ff = {
    applicants: [{ id: 'a1', firstName: 'Ravi' }],
    properties: [],
    liabilities: [
      { liabilityType: 'Credit card', limitAmount: '15,000', status: 'To be closed', ownership: { a1: 'Yes' } },
      { liabilityType: 'HECS', balance: '24,000', status: 'Remain open', ownership: {} },
      { liabilityType: 'Car loan', repaymentAmount: '640', repaymentFrequency: 'Monthly', balance: '31,000', status: 'To be refinanced', ownership: {} },
    ],
  }
  const items = propertyChecklist(ff)

  it('reads exactly as it did before today', () => {
    expect(items[0]).toContain('<strong>Credit card</strong>')
    expect(items[0]).toContain('To be closed')
    expect(items[0]).toContain('Limit $15,000')
    expect(items[1]).toContain('Balance $24,000')
    expect(items[2]).toContain('Repayment $640/month, Balance $31,000')
  })

  it('properties come first, liabilities after', () => {
    const both = propertyChecklist({ ...ff, properties: ravi().properties })
    expect(both[0]).toContain('Rush St')
    expect(both[1]).toContain('Credit card')
  })
})

describe('nothing at all is not an error', () => {
  it('an empty fact find is an empty list', () => {
    expect(propertyChecklist({})).toEqual([])
    expect(propertyChecklist(null)).toEqual([])
    expect(propertyChecklist({ properties: [], liabilities: [] })).toEqual([])
  })
})

describe('the form calls the shared builder and keeps no copy of its own', () => {
  const src = readFileSync(new URL('../app/(app)/deals/[id]/BCForm.tsx', import.meta.url), 'utf8')

  it('BCForm builds the checklist from lib', () => {
    expect(src).toContain('propertyChecklist')
    expect(src).not.toContain('function buildPropertyLiabilityChecklist')
  })

  it('the old private copies are gone, so there is one truth', () => {
    expect(src).not.toContain('function statusBadge')
    expect(src).not.toContain('function getOwnerNamesFromPercent')
  })
})
