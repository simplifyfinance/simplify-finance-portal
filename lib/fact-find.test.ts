import { describe, it, expect } from 'vitest'
import { notWorking, selfEmployed, ageFrom, annualIncome, position, stillToConfirm, fullName , dateAU } from './fact-find'

// The Chapman file. Natasha is marked Not working; Richard earns.
const natasha = {
  firstName: 'Natasha', lastName: 'Chapman', dob: '14/03/1988', phoneMobile: '0412 345 678',
  addresses: [{ isCurrent: true, address: '6 Bella Vista Court', residentialStatus: 'Owner occupied with a mortgage' }],
  // A date even on "not working" — it is history, and a lender wants two years
  // of it whatever it is made of. See monthsBetween/totalHistoryMonths.
  employment: [{ isCurrent: true, employmentType: 'Not working', occupation: 'Domestic duties',
                 employmentPriority: 'Primary', startDate: '2021-06-01' }],
  income: [],
}
const richard = {
  firstName: 'Richard', lastName: 'Chapman', dob: '1984-11-02', emailPersonal: 'r@example.com',
  addresses: [{ isCurrent: true, address: '6 Bella Vista Court', residentialStatus: 'Owner occupied with a mortgage' }],
  employment: [{ isCurrent: true, employmentType: 'PAYG', occupation: 'Investment manager',
                 employmentBasis: 'Full time', employerName: 'Roc Partners',
                 employmentPriority: 'Primary', startDate: '2019-03-04' }],
  income: [{ grossSalary: '446,428.63', grossSalaryFrequency: 'Annually',
             bonusAmount: '120,000', bonusFrequency: 'Annually',
             allowanceAmount: '400', allowanceFrequency: 'Monthly' }],
}
const deal = {
  bc_data: { template: 'oo_purchase', purchasePrice: '5,250,000', deposit: '3,841,500', stampDuty: '291,500' },
  fact_find_data: {
    applicants: [natasha, richard],
    assets: [{ value: '142,000' }, { value: '318,400' }],
    properties: [{ value: '3,000,000', loans: [{ balance: '1,279,283.98' }] }],
    liabilities: [{ balance: '1,240' }],
  },
}

describe('reading the fact find', () => {
  it('knows who is not working, and who works for themselves', () => {
    expect(notWorking(natasha.employment[0])).toBe(true)
    expect(notWorking(richard.employment[0])).toBe(false)
    expect(selfEmployed({ employmentType: 'Self-employed' })).toBe(true)
  })

  it('reads a date of birth typed either way round', () => {
    const today = new Date(Date.UTC(2026, 8, 2))
    expect(ageFrom('14/03/1988', today)).toBe(38)   // Australian, day first
    expect(ageFrom('1984-11-02', today)).toBe(41)
    expect(ageFrom('', today)).toBe(null)
    expect(ageFrom('rubbish', today)).toBe(null)
  })

  it('adds up a year of income across every component', () => {
    // 446,428.63 + 120,000 + (400 x 12)
    expect(Math.round(annualIncome(richard))).toBe(571229)
    expect(annualIncome(natasha)).toBe(0)
  })

  it('works out the household position from comma-formatted strings', () => {
    const p = position(deal.fact_find_data)
    expect(Math.round(p.income)).toBe(571229)
    expect(p.assets).toBe(3460400)                       // 142,000 + 318,400 + 3,000,000
    expect(p.liabilities).toBeCloseTo(1280523.98, 2)     // the loan plus the card
    expect(Math.round(p.net)).toBe(2179876)
  })
})

describe('what is genuinely still to confirm', () => {
  const missing = stillToConfirm(deal)

  it('does not ask an employer of somebody marked Not working', () => {
    // The whole complaint: "we marked Natasha as not employed so why asking
    // that questions missing employment???"
    expect(missing.some(m => m.startsWith('Natasha') && /employer|basis|income/i.test(m))).toBe(false)
  })

  it('does not invent gaps on a file that is filled in', () => {
    expect(missing).toEqual([])
  })

  it('does not ask a home owner for a housing expense', () => {
    expect(missing.some(m => /housing expense/i.test(m))).toBe(false)
  })

  it('DOES ask a renter for one', () => {
    const renting = JSON.parse(JSON.stringify(deal))
    renting.fact_find_data.applicants[1].addresses[0].residentialStatus = 'Renting'
    expect(stillToConfirm(renting).some(m => /housing expense/i.test(m))).toBe(true)
  })

  it('asks a working applicant for their employer, and their income', () => {
    const d = JSON.parse(JSON.stringify(deal))
    d.fact_find_data.applicants[1].employment[0].employerName = ''
    d.fact_find_data.applicants[1].income = []
    const m = stillToConfirm(d)
    expect(m).toContain('Richard Chapman — employer')
    expect(m.some(x => /no income recorded/i.test(x))).toBe(true)
  })

  it('asks a self-employed applicant for a business, not an employer', () => {
    const d = JSON.parse(JSON.stringify(deal))
    d.fact_find_data.applicants[1].employment[0] = { isCurrent: true, employmentType: 'Self-employed', occupation: 'Consultant' }
    const m = stillToConfirm(d)
    expect(m).toContain('Richard Chapman — business name')
    expect(m).not.toContain('Richard Chapman — employer')
  })

  it('asks a purchase for its price and a refinance for its balance, never both', () => {
    const purchase = stillToConfirm({ ...deal, bc_data: { template: 'oo_purchase' } })
    expect(purchase).toContain('BC — purchase price')
    expect(purchase.some(m => /existing loan balance/i.test(m))).toBe(false)

    const refi = stillToConfirm({ ...deal, bc_data: { template: 'refinance_only' } })
    expect(refi).toContain('BC — existing loan balance')
    expect(refi.some(m => /purchase price/i.test(m))).toBe(false)
  })

  it('says when an applicant has no current job at all', () => {
    const d = JSON.parse(JSON.stringify(deal))
    d.fact_find_data.applicants[1].employment = []
    expect(stillToConfirm(d)).toContain('Richard Chapman — no current employment recorded')
  })

  it('names people properly', () => {
    expect(fullName(natasha)).toBe('Natasha Chapman')
    expect(fullName({ firstName: 'Prince' })).toBe('Prince')
    expect(fullName({})).toBe('')
  })
})

// A date is pasted into SalesTrekker as a date. Nothing else may ride along.
describe('dateAU', () => {
  it('turns a date-picker value into the Australian order', () => {
    expect(dateAU('1984-11-02')).toBe('02/11/1984')
  })
  it('pads a hand-typed date', () => {
    expect(dateAU('2/3/1988')).toBe('02/03/1988')
  })
  it('leaves an already-correct date alone', () => {
    expect(dateAU('14/03/1988')).toBe('14/03/1988')
  })
  it('leaves a month-and-year as written rather than inventing a day', () => {
    expect(dateAU('Mar 2019')).toBe('Mar 2019')
  })
  it('is blank for a blank', () => {
    expect(dateAU('')).toBe('')
    expect(dateAU(null)).toBe('')
  })
  it('drops the time off a timestamp', () => {
    expect(dateAU('2026-09-02T10:15:00Z')).toBe('02/09/2026')
  })
})

// THE DATE ON A PERIOD OF NOT WORKING.
//
// The form hid every date field on a "Not working" entry, so those applicants
// sat permanently at "0 months of employment history recorded" with nothing they
// could do about it. Fabio, 3 Sep 2026: "when someone is not working there's no
// date, we need to establish 24 months of history not working as well."
describe('a period of not working still needs its dates', () => {
  // The file's own way of taking a copy before poking at it.
  const copy = () => JSON.parse(JSON.stringify(deal))
  const withoutDate = () => {
    const d = copy()
    d.fact_find_data.applicants[0].employment[0].startDate = ''
    return d
  }

  it('asks for the date they stopped working', () => {
    expect(stillToConfirm(withoutDate())).toContain('Natasha Chapman — the date they stopped working')
  })

  // Not working is still an answer: no employer, no occupation, no income.
  it('asks for nothing else', () => {
    const out = stillToConfirm(withoutDate()).filter(x => x.startsWith('Natasha'))
    expect(out).toEqual(['Natasha Chapman — the date they stopped working'])
  })

  it('asks a working applicant for their start date too', () => {
    const d = copy()
    d.fact_find_data.applicants[1].employment[0].startDate = ''
    expect(stillToConfirm(d)).toContain('Richard Chapman — employment start date')
  })
})
