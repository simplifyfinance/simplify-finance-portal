// THE FACT FIND, ON FABIO'S FORM.
//
// Fabio, 24 Sep 2026: "i want the same style coming out of the fact find button
// on compliance tab" - option A, every section kept - and then "sorry need
// typeable boxes".
//
// The old document was react-pdf and could only be checked by looking at it.
// This one is a list of items, so the sections, the boxes and the page edges
// are all testable.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { factFindFormItems, owners, words } from './factfind-form-content'
import { layout, allFields, duplicateFieldNames, offThePage } from './assessment-form'

const deal = {
  factFind: {
    dependants: '2',
    applicants: [
      { id: 'a1', firstName: 'Ravi', lastName: 'Kishore', dob: '1984-03-14',
        phoneMobile: '0412 887 331', emailPersonal: 'ravi@example.com',
        addresses: [
          { isCurrent: true, address: 'Rush St, Aintree VIC 3336', residentialStatus: 'Owner occupied', startDate: '2022-06-01' },
          { isCurrent: false, address: '21 Ely Cr, Caroline Springs VIC 3023', residentialStatus: 'Renting',
            startDate: '2020-05-01', endDate: '2022-06-01', housingExpenseAmount: '480', housingExpenseFrequency: 'Weekly' }],
        employment: [{ isCurrent: true, employerName: 'Linfox', occupation: 'Operations Manager',
          employmentBasis: 'Full time', startDate: '2019-02-01', onProbation: false }],
        income: [{ incomeType: 'PAYG', grossSalary: '135,000', grossSalaryFrequency: 'Annually',
          bonusAmount: '16,000', bonusFrequency: 'Annually' }],
        assets: [] },
      { id: 'a2', firstName: 'Priya', lastName: 'Kishore', dob: '1986-11-02',
        addresses: [], employment: [], income: [], assets: [] }],
    assets: [{ assetType: 'Savings', value: '150,000', bsb: '063-000', accountNumber: '1234567', ownership: { a1: '100' } }],
    properties: [{ address: 'Rush St, Aintree VIC 3336, Australia', value: '1,120,000',
      ownershipType: 'Owner occupied', futureUse: 'Ongoing', zoning: 'Residential', propertySubtype: 'House',
      ownership: { a1: '50', a2: '50' },
      loans: [{ lenderName: 'Macquarie', interestRate: '6.04', rateType: 'Variable', balance: '415,000',
        limitAmount: '415,000', repaymentAmount: '2,499', repaymentFrequency: 'Monthly',
        repaymentType: 'Principal and interest', remainingLoanTermYears: '30', status: 'Ongoing',
        interestOnlyExpiryDate: '2026-09-24', fixedRateExpiryDate: '2027-03-12',
        loanTermExpiryDate: '2052-06-01', ownership: { a1: '50' } }] }],
    liabilities: [{ liabilityType: 'Credit card', lenderName: 'ANZ', limitAmount: '15,000',
      balance: '2,300', status: 'To be closed', ownership: { a1: 'Yes' } }],
  },
  bc: { template: 'investment_purchase', dutyState: 'VIC', loanTerm: '30',
    purchasePrice: '640,000', deposit: '114,000', stampDuty: '35,000',
    lmiApplicable: 'Applicable', lmi: '9,000', lmiTreatment: 'Capitalised',
    splits: [{ label: 'Investment loan', amount: '561,000', rate: '6.95', type: 'P&I' }] },
  lo: { recommendedLender: 'Macquarie', recommendationNote: 'Macquarie is the pick on rate and on offset.',
    lenders: [{ lenderName: 'Macquarie', variablePI: { enabled: true, rate: '6.04', repayment: '2,499', loanTerm: '30' } },
              { lenderName: 'ANZ', variablePI: { enabled: true, rate: '6.14', repayment: '2,530', loanTerm: '30' } }] },
  loanAmount: 570000, lvr: 89.1,
  toConfirm: ['Priya Kishore — no current address', 'Priya Kishore — employer'],
  internalNotes: 'Cold call from Fairway Investing leads.',
}

const items = factFindFormItems(deal as any)
const bands = items.filter(i => i.kind === 'band').map((i: any) => i.title)
const labels = items.filter(i => i.kind === 'row').map((i: any) => i.label)
const has = (label: string) => labels.some(l => l.toLowerCase() === label.toLowerCase())
// Two sections can both hold a row called "Value" - an asset and a property -
// so a lookup says which band it is under.
const valuesIn = (label: string, under?: string) => {
  let band = ''
  for (const i of items as any[]) {
    if (i.kind === 'band') band = i.title
    if (i.kind === 'row' && i.label === label && (!under || band === under)) {
      return i.cols.flatMap((c: any) => c.flatMap((l: any) => l.map((s: any) => s.value)))
    }
  }
  return undefined
}

describe('nothing from the old document was dropped', () => {
  it('all eleven sections are here, in the order the tabs run', () => {
    expect(bands).toEqual([
      'Applicants', 'Address history', 'Employment', 'Income',
      'Other assets', 'Properties', 'Liabilities',
      'Borrowing capacity', 'Our recommendation - Macquarie', 'Lending options',
      'Loan purpose and notes', 'Still to confirm (2)',
    ])
  })

  it('carries the applicant facts', () => {
    expect(valuesIn('Full name')).toEqual(['Ravi Kishore', 'Priya Kishore'])
    expect(valuesIn('Date of birth')).toEqual(['14/03/1984', '02/11/1986'])
    expect(valuesIn('Mobile')).toEqual(['0412 887 331', ''])
  })

  it('carries address history, current and previous, per applicant', () => {
    expect(valuesIn('Current address')).toEqual(['Rush St, Aintree VIC 3336', ''])
    expect(valuesIn('Previous address')).toEqual(['21 Ely Cr, Caroline Springs VIC 3023', ''])
    // Only a renter or a boarder is asked this.
    expect(valuesIn('Previous - housing expense')![0]).toContain('480')
  })

  it('carries employment and income', () => {
    expect(valuesIn('Current - employer or business')).toEqual(['Linfox', ''])
    expect(valuesIn('Gross base salary')![0]).toContain('135,000')
    expect(valuesIn('Bonus')![0]).toContain('16,000')
    expect(valuesIn('Total, annualised')![0]).toBe('151,000')
  })

  it('carries the property and every field on its loan', () => {
    expect(valuesIn('Address', 'Properties')![0]).toBe('Rush St, Aintree VIC 3336, Australia')
    expect(valuesIn('Value', 'Properties')![0]).toBe('1,120,000')
    expect(valuesIn('Value', 'Other assets')).toEqual(['150,000'])
    expect(valuesIn('Loan - lender')![0]).toBe('Macquarie')
    expect(valuesIn('Loan - interest rate')![0]).toBe('6.04%')
    expect(valuesIn('Loan - remaining term')![0]).toBe('30 yrs')
    // BOTH dates, not just the interest-only one.
    expect(valuesIn('Loan - fixed rate expires')![0]).toBe('12/03/2027')
    expect(valuesIn('Loan - interest only expires')![0]).toBe('24/09/2026')
    expect(valuesIn('Loan - loan term expires')![0]).toBe('01/06/2052')
  })

  // Fabio, 24 Sep 2026: "why properties are like that and not side by side like
  // the settlement". Because one property made one column, and one column is
  // the whole page.
  it('lays properties across the page, four at a time, like the settlement form', () => {
    const headings = items.filter((i: any) => i.kind === 'heads').map((i: any) => i.titles)
    expect(headings).toContainEqual(['Property 1', 'Property 2', 'Property 3', 'Property 4'])
    // Four columns whether or not there are four properties - the empty ones
    // are there to be written in.
    expect(valuesIn('Address', 'Properties')).toHaveLength(4)
    expect(valuesIn('Address', 'Properties')!.slice(1)).toEqual(['', '', ''])
  })

  it('names the owners short enough to fit a quarter-width column', () => {
    // 83 points does not hold "Ravi Kishore, Priya Kishore" - it printed as
    // "Ravi Kishore, Priya Ki". The box still holds it all; the paper does not.
    expect(valuesIn('Owned by', 'Properties')![0]).toBe('Ravi, Priya')
    expect(valuesIn('Loan - owned by')![0]).toBe('Ravi')
    // Elsewhere, where a column is half the page, full names stay.
    expect(valuesIn('Owned by', 'Other assets')![0]).toBe('Ravi Kishore')
  })

  it('keeps each loan in the column of the property it is secured against', () => {
    // It used to be lifted into a band of its own, which put a property in one
    // place and its mortgage in another.
    expect(bands).not.toContain('Linked loans')
    const lender = valuesIn('Loan - lender')
    expect(lender).toHaveLength(4)
    expect(lender![0]).toBe('Macquarie')
  })

  it('carries the borrowing capacity, including the one LMI answer', () => {
    expect(valuesIn('Purchase price')).toEqual(['640,000'])
    // From loanFigureRows in lib/lmi.ts, the same rows the handover prints.
    expect(has('Total loan')).toBe(true)
    expect(has('LMI (capitalised)')).toBe(true)
    expect(valuesIn('LVR')![0]).toContain('89.1%')
    expect(valuesIn('Investment loan')![0]).toContain('561,000')
  })

  it('carries the lending options, recommendation first', () => {
    const headRow = items.find((i: any) => i.kind === 'heads' && i.titles.includes('RECOMMENDED')) as any
    expect(headRow.titles[0]).toBe('RECOMMENDED')
    expect(valuesIn('Lender', 'Lending options')).toContain('Macquarie')
    expect(valuesIn('Variable P&I')![0]).toContain('6.04% p.a.')
  })

  it('carries the notes and what is still to confirm', () => {
    expect(valuesIn('Internal notes')![0]).toContain('Fairway')
    const todo = items[items.length - 1] as any
    expect(todo.cols[0][0][0].value).toContain('no current address')
  })
})

describe('every box is a box', () => {
  const pages = layout(items)

  it('every value sits in a field somebody can type into', () => {
    const fields = allFields(pages)
    expect(fields.length).toBeGreaterThan(40)
    expect(fields.some(f => f.value === 'Ravi Kishore')).toBe(true)
    expect(fields.some(f => f.value === 'Macquarie')).toBe(true)
  })

  it('a gap is an empty box, not a missing one - it can be filled in by hand', () => {
    const fields = allFields(pages)
    expect(fields.filter(f => f.value === '').length).toBeGreaterThan(5)
  })

  it('no two boxes share a name, because two boxes with one name ARE one box', () => {
    expect(duplicateFieldNames(pages)).toEqual([])
  })

  it('nothing is drawn off the paper', () => {
    expect(offThePage(pages)).toEqual([])
  })

  it('it is more than one page, and every page has something on it', () => {
    expect(pages.length).toBeGreaterThan(1)
    for (const p of pages) expect(p.fills.length + p.texts.length).toBeGreaterThan(0)
  })
})

describe('an empty row is not printed', () => {
  it('a section nobody filled in does not print a heading over a blank', () => {
    const bare = factFindFormItems({
      factFind: { applicants: [{ id: 'a1', firstName: 'Solo' }] },
      bc: {}, lo: {}, loanAmount: null, lvr: null, toConfirm: [],
    } as any)
    const b = bare.filter(i => i.kind === 'band').map((i: any) => i.title)
    // Properties always print - four blank columns of questions, the way the
    // paper form does it, so somebody can fill them in by hand.
    expect(b).toEqual(['Applicants', 'Properties'])
    expect(b).not.toContain('Lending options')
    expect(b).not.toContain('Other assets')
  })

  it('a deal with nothing at all on it still builds', () => {
    const empty = factFindFormItems({ factFind: {}, bc: {}, lo: {}, loanAmount: null, lvr: null, toConfirm: [] } as any)
    expect(() => layout(empty)).not.toThrow()
    expect(offThePage(layout(empty))).toEqual([])
  })

  it('a row where one applicant has an answer and the other does not is still printed', () => {
    // The empty box is the point - somebody writes in it.
    expect(valuesIn('Mobile')).toEqual(['0412 887 331', ''])
  })
})

describe('the small pieces', () => {
  it('owners reads a percentage split and a tick list the same way', () => {
    const apps = [{ id: 'a1', firstName: 'Ravi' }, { id: 'a2', firstName: 'Priya' }]
    expect(owners({ a1: '50', a2: '50' }, apps)).toBe('Ravi Kishore, Priya Kishore'.replace(' Kishore', '').replace(' Kishore', ''))
    expect(owners({ a1: 'Yes' }, apps)).toBe('Ravi')
    expect(owners({ a1: '0' }, apps)).toBe('')
    expect(owners(undefined, apps)).toBe('')
  })

  it('oo_purchase is not a word', () => {
    expect(words('investment_purchase')).toBe('Investment purchase')
    expect(words('')).toBe('')
  })
})

describe('one document, one drawing', () => {
  it('the route builds it from the shared pieces and draws nothing itself', () => {
    const src = readFileSync(new URL('../app/api/generate-summary-pdf/route.tsx', import.meta.url), 'utf8')
    expect(src).toContain('factFindFormItems')
    expect(src).toContain('renderFormPdf')
    // The coloured react-pdf document is gone.
    expect(src).not.toContain('@react-pdf/renderer')
    expect(src).not.toContain('StyleSheet')
  })

  it('the assessment form and the fact find draw through the same file', () => {
    const shared = readFileSync(new URL('./form-pdf.ts', import.meta.url), 'utf8')
    expect(shared).toContain('createTextField')
    expect(shared).toContain('setFontSize(7)')
  })

  it('the SalesTrekker push still gets the same document', () => {
    const src = readFileSync(new URL('../app/api/notify-salestrekker/route.ts', import.meta.url), 'utf8')
    expect(src).toContain('generateSummaryPdfBuffer')
  })
})
