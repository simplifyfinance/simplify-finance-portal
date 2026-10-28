import { describe, it, expect } from 'vitest'
import { factFindFormItems } from './factfind-form-content'
import { factFindSections, handoverSections } from './handover-view'
import { relationshipLine } from './relationship'
import { securityAddressOf } from './security-address'
import { boxNine } from './box-security'

// A DEFAULT IS NOT AN ANSWER.
//
// 28 Oct 2026. Nader Gharsa's fact find went to the compliance team and came
// back with seven corrections. Six of them were the same bug wearing different
// clothes, and not one of them was anybody typing the wrong thing.
//
//   "INCOME 1 - ASSESSMENT METHOD: Last 2 financial years"  on a PAYG client
//   "INCOME 2 - ASSESSMENT METHOD: Last 2 financial years"  on his Centrelink
//   "LOAN 2 - MORTGAGE TYPE: Owner occupied"                on an investment
//   "STATE: VIC"  and  "PURCHASE PRICE: $575,000"           on a NSW refinance
//   "Relationship of applicants: Not recorded"              when it said Single
//   "Security address: Not recorded"                        when it was on file
//
// THE FORM DECIDES WHAT IS RELEVANT. THE DOCUMENTS DID NOT. Every fact find
// record is born with values in it - an assessment method, a mortgage type, a
// valuation method - and the form hides the boxes that do not apply. The
// documents printed every box that had a value, and a default has a value.
//
// A blank box is obviously blank. A default reads as an answer somebody gave,
// which is why an audit cannot catch it and why these reached a client-facing
// team six at a time. Fabio, 28 Oct 2026: "why are we making these mistakes?"
//
// This is the test that would have caught all six. It builds one fact find -
// PAYG plus Centrelink, an investment property with two loans, a refinance
// scenario, one applicant who is single - and reads what every document says
// about it.
//
// Every name and figure is invented.

const APPLICANT = {
  id: 'a1', firstName: 'Nadia', lastName: 'Okonkwo',
  relationshipStatus: 'Single',
  addresses: [{ id: 'ad1', address: '14 Fictional Street, Nowhere NSW 2000', isCurrent: true }],
  employment: [{ id: 'e1', isCurrent: true, employerName: 'Harrow Partners',
                 employmentBasis: 'Full time', employmentType: 'PAYG', startDate: '2024-02-01' }],
  income: [
    // PAYG, carrying the self-employed defaults every income row is born with.
    { id: 'i1', incomeType: 'PAYG', employmentId: 'e1',
      grossSalary: '107000', grossSalaryFrequency: 'Annually',
      bonusAmount: '8452', bonusFrequency: 'Annually',
      seAssessmentMethod: 'Last 2 financial years',
      seGrowthMethod: 'average', seYear1FY: '2023/24', seYear2FY: '2024/25',
      seDirectorProfitable: 'Yes', seDirectorSalaryFrequency: 'Annually' },
    // Centrelink, carrying exactly the same ones.
    { id: 'i2', incomeType: 'Other non-taxable',
      otherIncomeType: 'Centrelink', otherIncomeAmount: '8455',
      seAssessmentMethod: 'Last 2 financial years',
      seGrowthMethod: 'average', seYear1FY: '2023/24', seYear2FY: '2024/25' },
  ],
}

const DEAL = {
  id: 'd1', deal_name: 'Okonkwo_refinance',
  fact_find_data: {
    applicants: [APPLICANT],
    assets: [{ id: 'as1', assetType: 'Super', description: 'SMSF', value: '493646', ownership: { a1: '100' } }],
    properties: [{
      id: 'p1', address: '59 Invented Parade, Nowhere NSW 2000',
      ownershipType: 'Investment', value: '1300000',
      futureUse: 'Ongoing', zoning: 'Residential', propertySubtype: 'Fully detached house',
      ownership: { a1: '100' },
      loans: [
        // Both born 'Owner occupied', on an investment property.
        // 'To be refinanced' is the portal's own word for it - lib/box-security.ts
        // reads that status to decide what this deal is actually secured against.
        { id: 'l1', lenderName: 'Pepper Money', mortgageType: 'Owner occupied',
          balance: '444600', status: 'To be refinanced', remainingLoanTermYears: '29' },
        { id: 'l2', lenderName: 'Pepper Money', mortgageType: 'Owner occupied',
          balance: '203470', status: 'To be refinanced', remainingLoanTermYears: '29' },
      ],
    }],
    liabilities: [],
  },
  // A refinance that used to be a Victorian purchase, months ago.
  bc_data: {
    template: 'refinance_equity', suburb: 'Nowhere', propertyType: 'Investment',
    loanTerm: '30', existingLoanBal: '643970.60', propertyValue: '1300000',
    equityRelease: '245500',
    purchasePrice: '575000', dutyState: 'VIC', deposit: '115000', stampDuty: '30895',
  },
  lo_data: {}, compliance_data: {},
}

const sheet = () => factFindFormItems({
  factFind: DEAL.fact_find_data, bc: DEAL.bc_data, lo: DEAL.lo_data,
  loanAmount: 893800, lvr: 68.8, toConfirm: [],
} as any)

const sheetText = () => JSON.stringify(sheet())
const copyPageText = () => JSON.stringify([...factFindSections(DEAL), ...handoverSections(DEAL)])

// Every document, so a fix in one of them is never mistaken for a fix.
const EVERY_DOCUMENT = (): Array<[string, string]> => [
  ['the fact find sheet', sheetText()],
  ['the copy page and handover', copyPageText()],
]

describe('A PAYG CLIENT IS NOT SELF-EMPLOYED ON ANY DOCUMENT', () => {
  it('no document prints an assessment method against him', () => {
    for (const [what, text] of EVERY_DOCUMENT()) {
      expect(text.includes('Last 2 financial years'),
        `${what} prints a self-employed assessment method on a PAYG client`).toBe(false)
    }
  })

  it('and none of the other self-employed boxes either', () => {
    for (const [what, text] of EVERY_DOCUMENT()) {
      for (const leak of ['Assessment method', 'Business ABN', "Director's salary", 'Director salary']) {
        expect(text.includes(leak), `${what} prints "${leak}" on a PAYG client`).toBe(false)
      }
    }
  })

  it('while still printing what he actually earns', () => {
    for (const [what, text] of EVERY_DOCUMENT()) {
      expect(text.includes('Gross base salary'), `${what} dropped the salary`).toBe(true)
    }
  })

  it('and still printing the Centrelink payment', () => {
    expect(sheetText()).toContain('Centrelink')
  })
})

describe('A LOAN ON AN INVESTMENT PROPERTY IS AN INVESTMENT LOAN', () => {
  it('no document calls it owner occupied', () => {
    // The property is Investment. Both loans were born 'Owner occupied' and
    // nobody ever had a reason to touch them.
    for (const [what, text] of EVERY_DOCUMENT()) {
      expect(text.includes('Owner occupied'),
        `${what} calls a loan on an investment property owner occupied`).toBe(false)
    }
  })

  it('and the mortgage type row is still there, saying Investment', () => {
    expect(sheetText()).toContain('mortgage type')
    expect(sheetText()).toContain('Investment')
  })
})

describe('NOTHING IS BEING BOUGHT, SO NO PURCHASE IS PRINTED', () => {
  it('the purchase price from the old scenario is gone', () => {
    for (const [what, text] of EVERY_DOCUMENT()) {
      expect(text.includes('575,000'), `${what} prints a purchase price on a refinance`).toBe(false)
      expect(text.includes('Purchase price'), `${what} asks for a purchase price on a refinance`).toBe(false)
    }
  })

  it('and so are the deposit, the stamp duty and the duty state', () => {
    for (const [what, text] of EVERY_DOCUMENT()) {
      for (const leak of ['Stamp duty', 'Deposit', 'VIC']) {
        expect(text.includes(leak), `${what} prints "${leak}" on a refinance`).toBe(false)
      }
    }
  })

  it('while still printing what the refinance IS', () => {
    const t = sheetText()
    expect(t).toContain('Existing loan balance')
    expect(t).toContain('Equity release')
  })
})

describe('THE VALUATION BOX IS GONE EVERYWHERE', () => {
  // Fabio: "remove that box completely because it doesn't matter. It's just
  // confusing people." There was never a control for it - it was a default.
  it('no document asks how the value was arrived at', () => {
    for (const [what, text] of EVERY_DOCUMENT()) {
      for (const leak of ['Valuation method', 'RP Data', 'Applicant estimate']) {
        expect(text.includes(leak), `${what} still carries "${leak}"`).toBe(false)
      }
    }
  })

  it('and the compliance pack no longer says whose estimate the value is', () => {
    expect(boxNine(DEAL).text).not.toMatch(/own estimate/)
  })

  it('while the value itself is still printed', () => {
    expect(sheetText()).toContain('1,300,000')
  })
})

describe('NOT RECORDED HAS TO MEAN NOT RECORDED', () => {
  it('a sole applicant who said Single is reported as Single', () => {
    expect(relationshipLine([APPLICANT])).toBe('Single')
  })

  it('and the security address is found on the fact find', () => {
    expect(securityAddressOf(DEAL)).toContain('59 Invented Parade')
  })

  it('but nothing is invented when there really is nothing', () => {
    // The guard rail on the two fixes above. A document that prints something
    // reassuring over a genuine gap is worse than one that says Not recorded.
    expect(relationshipLine([{ id: 'x', firstName: 'A', lastName: 'B' }])).toBe('')
    expect(securityAddressOf({ fact_find_data: { properties: [] }, bc_data: {}, compliance_data: {} })).toBe('')
  })

  it('and a typed address still beats the fact find', () => {
    // Somebody typing into Compliance is answering directly, and a deal can be
    // secured against something that is not on the fact find at all.
    expect(securityAddressOf({ ...DEAL, compliance_data: { securityAddress: '1 Typed Street' } }))
      .toBe('1 Typed Street')
  })
})

describe('the documents are still documents', () => {
  // A test that passes because everything came out empty would be the worst
  // possible outcome here - it would hide the next fault completely.
  it('the fact find sheet still has its sections', () => {
    const t = sheetText()
    for (const band of ['Income', 'Properties', 'Borrowing capacity', 'Other assets']) {
      expect(t.includes(band), `the sheet lost its ${band} section`).toBe(true)
    }
    expect(sheet().length).toBeGreaterThan(40)
  })

  it('and the copy page still has content', () => {
    expect(copyPageText().length).toBeGreaterThan(2000)
  })
})
