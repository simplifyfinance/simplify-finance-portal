import { describe, it, expect } from 'vitest'
import { incomeKind, incomeLabel, FORM_FILLED_DEFAULTS, KIND_EVIDENCE_FIELDS, DEFAULT_ASSESSMENT_METHOD } from './income-kind'
import { annualIncomeOf } from './income-calculations'

describe('what is in the entry beats what it is called', () => {
  // The bug, exactly: the AI extractor writes "Base salary", the rest of the
  // portal only knew "PAYG", and $300,000 counted as nothing.
  it('reads a salary as PAYG whatever the label says', () => {
    for (const incomeType of ['PAYG', 'Base salary', 'Rental', 'Other', 'Wages', '', undefined]) {
      expect(incomeKind({ incomeType, grossSalary: '300,000' }), String(incomeType)).toBe('payg')
    }
  })

  it('reads financial years as self-employed whatever the label says', () => {
    expect(incomeKind({ incomeType: 'Base salary', seYear1NetProfit: '180,000' })).toBe('self-employed')
    expect(incomeKind({ incomeType: '', seAssessmentMethod: 'One year in isolation' })).toBe('self-employed')
    // But the value every row is born with says nothing.
    expect(incomeKind({ incomeType: 'PAYG', seAssessmentMethod: DEFAULT_ASSESSMENT_METHOD, grossSalary: '90,000' })).toBe('payg')
  })

  // Self-employed wins: a director on a salary has both, and the assessment
  // method is the one that decides how the income is worked out.
  it('prefers self-employed when an entry carries both', () => {
    expect(incomeKind({ grossSalary: '90,000', seAssessmentMethod: "Director's salary" })).toBe('self-employed')
  })

  it('reads a standalone amount as other income', () => {
    expect(incomeKind({ incomeType: 'Other taxable', otherIncomeAmount: '18,000' })).toBe('other')
    expect(incomeKind({ incomeType: 'Centrelink', otherIncomeAmount: '12,000' })).toBe('other')
  })
})

describe('an entry with nothing filled in', () => {
  it('falls back to the label so the form still shows the right fields', () => {
    expect(incomeKind({ incomeType: 'PAYG' })).toBe('payg')
    expect(incomeKind({ incomeType: 'Base salary' })).toBe('payg')
    expect(incomeKind({ incomeType: 'Self-employed' })).toBe('self-employed')
    expect(incomeKind({ incomeType: 'Sole trader' })).toBe('self-employed')
    expect(incomeKind({ incomeType: 'Rental' })).toBe('other')
  })

  it('is nothing at all when there is nothing at all', () => {
    expect(incomeKind({})).toBe('none')
    expect(incomeKind(null)).toBe('none')
    expect(incomeKind({ incomeType: '', grossSalary: '' })).toBe('none')
  })

  // A zero is not an amount somebody typed to mean something.
  it('does not treat a zero as a filled field', () => {
    expect(incomeKind({ grossSalary: '0' })).toBe('none')
  })
})

describe('what to call it in a sentence', () => {
  it('says PAYG and Self-employed plainly', () => {
    expect(incomeLabel({ incomeType: 'Base salary', grossSalary: '300,000' })).toBe('PAYG')
    expect(incomeLabel({ incomeType: '', seYear1NetProfit: '180,000' })).toBe('Self-employed')
  })

  it('keeps the specific words on other income', () => {
    expect(incomeLabel({ incomeType: 'Other taxable', otherIncomeType: 'Centrelink', otherIncomeAmount: '12,000' }))
      .toBe('Centrelink')
    expect(incomeLabel({ incomeType: 'Rental', otherIncomeAmount: '33,800' })).toBe('Rental')
  })
})

// EVERY INCOME ROW THE FACT FIND CREATES, exactly as defaultIncome() makes it.
// If this shape is ever read as self-employed again, the whole portal reports
// zero income and nothing says so.
const newIncomeRow = (type = 'PAYG') => ({
  id: 'i1', incomeType: type, employmentId: 'e1',
  grossSalary: '', grossSalaryFrequency: 'Annually',
  bonusAmount: '', bonusFrequency: 'Annually',
  overtimeEssentialAmount: '', overtimeEssentialFrequency: 'Annually',
  overtimeNonEssentialAmount: '', overtimeNonEssentialFrequency: 'Annually',
  commissionAmount: '', commissionFrequency: 'Annually',
  allowanceAmount: '', allowanceFrequency: 'Annually',
  seBusinessName: '', seAbn: '', seAssessmentMethod: 'Last 2 financial years',
  seGrowthMethod: 'average', seGrowthPercentOption: '20', seGrowthPercentCustom: '',
  seYear1FY: '2023/24', seYear1Salary: '', seYear1NetProfit: '',
  seYear1Depreciation: '', seYear1Interest: '', seYear1Super: '', seYear1OneOff: '', seYear1Other: '',
  seYear2FY: '2024/25', seYear2Salary: '', seYear2NetProfit: '',
  seYear2Depreciation: '', seYear2Interest: '', seYear2Super: '', seYear2OneOff: '', seYear2Other: '',
  seDirectorSalary: '', seDirectorSalaryFrequency: 'Annually', seDirectorProfitable: 'Yes',
})

describe('a row the form made, not a person', () => {
  // ALEXIS JANES, 7 Sep 2026. $146,380 of salary reading as $0 everywhere.
  it('reads a PAYG salary as PAYG, even though the form pre-filled the self-employed dropdown', () => {
    const row = { ...newIncomeRow(), grossSalary: '146,380' }
    expect(incomeKind(row)).toBe('payg')
    expect(annualIncomeOf(row)).toBe(146380)
  })

  it('is not fooled by any of the defaults on an otherwise empty row', () => {
    // Nothing typed at all: it falls back to the label, which says PAYG.
    expect(incomeKind(newIncomeRow('PAYG'))).toBe('payg')
    expect(incomeKind(newIncomeRow('Self-employed'))).toBe('self-employed')
  })

  it('still reads a real self-employed row as self-employed', () => {
    const row = { ...newIncomeRow('Self-employed'), seYear1NetProfit: '180,000', seYear2NetProfit: '200,000' }
    expect(incomeKind(row)).toBe('self-employed')
    expect(annualIncomeOf(row)).toBe(190000)
  })

  it('reads a business name as self-employed even with nothing else typed', () => {
    expect(incomeKind({ ...newIncomeRow(), seBusinessName: 'Janes Consulting' })).toBe('self-employed')
  })

  // THE RULE. A field only counts as evidence if a person had to type it.
  it('never treats anything the form pre-fills as evidence of a kind', () => {
    for (const field of FORM_FILLED_DEFAULTS) {
      expect(KIND_EVIDENCE_FIELDS).not.toContain(field)
    }
    // The assessment method is the one exception, and only when somebody has
    // chosen a different one from the value it arrives with.
    expect(incomeKind({ seAssessmentMethod: DEFAULT_ASSESSMENT_METHOD })).toBe('none')
    expect(incomeKind({ seAssessmentMethod: "Director's salary" })).toBe('self-employed')
  })

  it('a row carrying only pre-filled defaults and a salary is never self-employed', () => {
    const row: any = { ...newIncomeRow(), grossSalary: '90,000' }
    for (const field of FORM_FILLED_DEFAULTS) {
      expect(String(row[field] ?? '')).not.toBe('')   // they really are filled in
    }
    expect(incomeKind(row)).toBe('payg')
  })
})

