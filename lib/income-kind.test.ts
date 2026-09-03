import { describe, it, expect } from 'vitest'
import { incomeKind, incomeLabel } from './income-kind'

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
