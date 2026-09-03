import { describe, it, expect } from 'vitest'
import { brokerNotes, type Assessor } from './broker-notes'

const ASSESSOR: Assessor = { name: 'Sarah Nguyen', phone: '0412 345 678' }
const TODAY = new Date('2026-09-03')

const payg = (over: any = {}) => ({
  firstName: 'Matti', lastName: 'Hallanoro', dob: '1972-04-11',
  employment: [{ id: 'e1', isCurrent: true, employmentType: 'PAYG',
                 occupation: 'Software Engineer', employerName: 'ABC Pty Ltd' }],
  income: [{ incomeType: 'PAYG', employmentId: 'e1',
             grossSalary: '300,000', grossSalaryFrequency: 'Annually' }],
  ...over,
})

const purchase = (over: any = {}) => ({
  bc_data: { template: 'oo_purchase', purchasePrice: '5,250,000', stampDuty: '291,500',
             deposit: '3,841,500', suburb: 'Mosman', loanTerm: '30', lmiApplicable: 'No',
             depositSource: 'Savings', ...(over.bc_data || {}) },
  lo_data: { loanAmount: '1,700,000',
             refinanceSplits: [{ id: 'a', label: 'Loan', amount: '1,700,000', purpose: 'OO' }],
             ...(over.lo_data || {}) },
  compliance_data: over.compliance_data || { risks: {
    'Matti Hallanoro': { retirementAge: '67', repaymentMethod: 'Superannuation lump sum following retirement' } } },
  fact_find_data: over.fact_find_data || { applicants: [payg()] },
})

const notes = (deal: any, assessor: Assessor | null = ASSESSOR) => brokerNotes(deal, assessor, TODAY)
const para = (deal: any, key: string, assessor: Assessor | null = ASSESSOR) =>
  notes(deal, assessor).paragraphs.find(p => p.key === key)

describe('the contact line', () => {
  it('names the assessor and their number, first', () => {
    const n = notes(purchase())
    expect(n.paragraphs[0].key).toBe('contact')
    expect(n.paragraphs[0].lines[0]).toBe(
      'Should you have any questions regarding this application, please contact Sarah Nguyen on 0412 345 678.')
  })

  // The old habit was a block with everybody's name in it for the bank to sift.
  it('names one person, not the whole team', () => {
    expect(notes(purchase()).text).not.toMatch(/,\s*[A-Z][a-z]+ [A-Z][a-z]+ on 0.*,/)
  })

  it('refuses when no assessor is assigned', () => {
    const n = notes(purchase(), null)
    expect(n.ready).toBe(false)
    expect(n.missing.join(' ')).toContain('No credit assessor is assigned')
  })

  it('refuses when the assessor has no phone number, and says where to add it', () => {
    const n = notes(purchase(), { name: 'Sarah Nguyen', phone: '' })
    expect(n.ready).toBe(false)
    expect(n.missing.join(' ')).toContain('Settings, Credit team')
  })
})

describe('paragraph one — the deal', () => {
  it('is one sentence, with the amount and what it is for', () => {
    expect(para(purchase(), 'deal')!.lines[0]).toBe(
      'The applicant is seeking finance of $1,700,000 to purchase an owner-occupied property in Mosman.')
  })

  it('speaks in the plural for two applicants', () => {
    const d = purchase({ fact_find_data: { applicants: [payg(), payg({ firstName: 'Elizabeth' })] } })
    expect(para(d, 'deal')!.lines[0]).toContain('The applicants are seeking')
  })

  it('says refinance on a refinance', () => {
    const d = purchase({ bc_data: { template: 'refinance_only', purchasePrice: '' },
                         lo_data: { refinanceSplits: [{ id: 'a', amount: '520,000', purpose: 'INV' }] } })
    expect(para(d, 'deal')!.lines[0]).toContain('to refinance an investment property')
  })

  // The purpose comes from the splits, which is the whole reason it is recorded
  // per split - it used to be guessed from the scenario's name.
  it('will not guess owner occupied or investment', () => {
    const d = purchase({ lo_data: { loanAmount: '1,700,000',
      refinanceSplits: [{ id: 'a', amount: '1,700,000' }] } })
    expect(notes(d).missing.join(' ')).toContain('whether this is owner occupied or investment')
  })
})

describe('paragraph two — the income used', () => {
  it('gives the employer, the role and the figures for PAYG', () => {
    const line = para(purchase(), 'income')!.lines[0]
    expect(line).toContain('PAYG, Software Engineer at ABC Pty Ltd')
    expect(line).toContain('Gross salary $300,000 p.a.')
    expect(line).toContain('Income used: $300,000 p.a.')
  })

  it('adds a bonus without turning it into salary', () => {
    const d = purchase({ fact_find_data: { applicants: [payg({
      income: [{ incomeType: 'PAYG', employmentId: 'e1', grossSalary: '300,000', grossSalaryFrequency: 'Annually',
                 bonusAmount: '40,000', bonusFrequency: 'Annually' }] })] } })
    const line = para(d, 'income')!.lines[0]
    expect(line).toContain('bonus $40,000 p.a.')
    expect(line).toContain('Income used: $340,000 p.a.')
  })

  it('annualises a fortnightly salary', () => {
    const d = purchase({ fact_find_data: { applicants: [payg({
      income: [{ incomeType: 'PAYG', employmentId: 'e1', grossSalary: '4,200', grossSalaryFrequency: 'Fortnightly' }] })] } })
    expect(para(d, 'income')!.lines[0]).toContain('$4,200 per fortnight')
    expect(para(d, 'income')!.lines[0]).toContain('Income used: $109,200 p.a.')
  })

  // The whole point of paragraph two: HOW the income was arrived at, not just
  // the number.
  it('shows the working on a self-employed applicant', () => {
    const d = purchase({ fact_find_data: { applicants: [{
      firstName: 'Elizabeth', lastName: 'Hallanoro', dob: '1985-09-02',
      employment: [{ id: 'e2', isCurrent: true, employmentType: 'Self-employed',
                     selfEmployedStructure: 'Company', employerName: 'Hallanoro Consulting Pty Ltd' }],
      income: [{ incomeType: 'Self-employed', employmentId: 'e2', seAssessmentMethod: 'One year in isolation',
                 seYear1FY: '2024/25', seYear1Salary: '120,000', seYear1NetProfit: '180,000',
                 seYear1Depreciation: '12,000', seYear1Interest: '8,000' }] }] } })
    const line = para(d, 'income')!.lines[0]
    expect(line).toContain('Self-employed (Company), Hallanoro Consulting Pty Ltd')
    expect(line).toContain('Assessed on one year in isolation')
    expect(line).toContain('FY2024/25: net profit $180,000 and salary $120,000')
    expect(line).toContain('add-backs of $12,000 depreciation, $8,000 interest')
    expect(line).toContain('$320,000')
  })

  it('names the method when two years are averaged', () => {
    const d = purchase({ fact_find_data: { applicants: [{
      firstName: 'Elizabeth', lastName: 'Hallanoro', dob: '1985-09-02',
      employment: [{ id: 'e2', isCurrent: true, employmentType: 'Self-employed', selfEmployedStructure: 'Sole trader' }],
      income: [{ incomeType: 'Self-employed', employmentId: 'e2',
                 seAssessmentMethod: 'Last 2 financial years', seGrowthMethod: 'average',
                 seYear1FY: '2024/25', seYear1NetProfit: '180,000',
                 seYear2FY: '2023/24', seYear2NetProfit: '150,000' }] }] } })
    expect(para(d, 'income')!.lines[0]).toContain('average of the last two financial years')
  })

  it('counts rental income against the property that earns it', () => {
    const d = purchase({ fact_find_data: { applicants: [payg()],
      properties: [{ value: '900,000', rentalIncome: '650' }] } })
    const lines = para(d, 'income')!.lines
    expect(lines.some(l => l.includes('$33,800 p.a.'))).toBe(true)
    expect(lines[lines.length - 1]).toBe('Total income used: $333,800 p.a.')
  })

  it('will not write an income line with no employer', () => {
    const d = purchase({ fact_find_data: { applicants: [payg({
      employment: [{ id: 'e1', isCurrent: true, employmentType: 'PAYG', occupation: 'Teacher' }] })] } })
    expect(notes(d).missing.join(' ')).toContain('no employer recorded')
  })
})

describe('paragraph three — funds to complete', () => {
  it('lists the four figures and says where the money comes from', () => {
    const lines = para(purchase(), 'funds')!.lines
    expect(lines).toContain('Purchase price: $5,250,000')
    expect(lines).toContain('Stamp duty: $291,500')
    expect(lines).toContain('Loan: $1,700,000 (no LMI applicable)')
    expect(lines[lines.length - 1]).toBe(
      "Funds to complete: $3,841,500, met by the client's contribution from savings")
  })

  // Fabio was explicit that this has to be on the face of it - it changes the
  // figure the assessor is checking.
  it('says so when LMI is capitalised onto the loan', () => {
    const d = purchase({ bc_data: { lmi: '18,000', lmiApplicable: 'Applicable' } })
    expect(para(d, 'funds')!.lines.join(' ')).toContain('including capitalised LMI of $18,000')
  })

  it('does not appear on a refinance, because there is no completion to fund', () => {
    const d = purchase({ bc_data: { template: 'refinance_only', purchasePrice: '', stampDuty: '', deposit: '' },
                         lo_data: { refinanceSplits: [{ id: 'a', amount: '520,000', purpose: 'INV' }] } })
    expect(para(d, 'funds')).toBeUndefined()
  })

  it('refuses rather than quoting a total that leaves stamp duty out', () => {
    const d = purchase({ bc_data: { stampDuty: '' } })
    expect(notes(d).ready).toBe(false)
    expect(notes(d).missing.join(' ')).toContain('Stamp duty has not been recorded')
  })
})

describe('paragraph four — retirement', () => {
  it('appears for an applicant over fifty', () => {
    // Born 1972, so 54 on 3 Sep 2026.
    expect(para(purchase(), 'retirement')!.lines[0]).toBe(
      'Matti Hallanoro is 54 and intends to retire at 67. The loan term of 30 years ends when they are 84. '
      + 'Repayment beyond retirement is by superannuation lump sum following retirement.')
  })

  it('does not appear when nobody is over fifty', () => {
    const d = purchase({ fact_find_data: { applicants: [payg({ dob: '1990-02-14' })] },
                         compliance_data: { risks: {} } })
    expect(para(d, 'retirement')).toBeUndefined()
    expect(notes(d).ready).toBe(true)
  })

  it('refuses when an applicant is over fifty and the Risks tab is blank', () => {
    const d = purchase({ compliance_data: { risks: {} } })
    const m = notes(d).missing.join(' ')
    expect(m).toContain('Matti Hallanoro is 54')
    expect(m).toContain('Risks tab')
  })

  it('says nothing about age when there is no date of birth', () => {
    const d = purchase({ fact_find_data: { applicants: [payg({ dob: '' })] },
                         compliance_data: { risks: {} } })
    expect(para(d, 'retirement')).toBeUndefined()
  })
})

describe('what it refuses to do', () => {
  it('writes nothing at all when anything is missing', () => {
    const n = notes(purchase({ bc_data: { stampDuty: '' } }))
    expect(n.text).toBe('')
    expect(n.ready).toBe(false)
  })

  // A placeholder is how [employer name] ends up in a bank's portal.
  it('leaves no square brackets in anything it does write', () => {
    expect(notes(purchase()).text).not.toMatch(/\[|\]/)
  })

  it('names each gap once, however many paragraphs trip over it', () => {
    const n = notes(purchase({ bc_data: { stampDuty: '' } }))
    expect(new Set(n.missing).size).toBe(n.missing.length)
  })

  it('is plain text — no markdown, no bullets', () => {
    const t = notes(purchase()).text
    expect(t).not.toMatch(/[*_#•]/)
  })
})
